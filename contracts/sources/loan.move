/// DefiCredit Loan Module
/// Manages loan lifecycle: request → approve (lender) → fund (borrower) → repay
#[allow(duplicate_alias)]
module deficredit::loan {
    use iota::object::{Self, UID, ID};
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};
    use iota::coin::{Self, Coin};
    use iota::iota::IOTA;
    use iota::event;
    use deficredit::pool::{Self, Pool};

    // ===== Constants =====
    const STATUS_REQUESTED: u8 = 0;
    const STATUS_FUNDED: u8 = 1;
    const STATUS_REPAID: u8 = 2;

    // ===== Error codes =====
    const ENotBorrower: u64 = 1;
    const ENotFundedState: u64 = 2;
    const EInvalidRepayAmount: u64 = 4;
    const ELoanNotRequested: u64 = 5;
    const EBadApproval: u64 = 7;   // approval.loan_id != loan object ID
    const EWrongPool: u64 = 8;     // pool passed does not match loan.pool_id

    // ===== Structs =====

    /// A loan position NFT — represents a loan agreement on-chain.
    /// Owned by the borrower.
    public struct LoanPosition has key {
        id: UID,
        pool_id: ID,
        borrower: address,
        principal: u64,
        interest_rate_bps: u64,
        /// principal + (principal * interest_rate_bps / 10000)
        total_due: u64,
        outstanding_balance: u64,
        /// 0=requested, 1=funded, 2=repaid
        status: u8,
        /// VC hash for off-chain verification (stored as bytes)
        vc_hash: vector<u8>,
    }

    /// Lender approval capability — created by the lender and sent to the borrower.
    /// The borrower presents this when calling fund_loan to prove the lender approved.
    /// Consumed (deleted) inside fund_loan.
    public struct LoanApproval has key, store {
        id: UID,
        /// The LoanPosition object ID this approval is for
        loan_id: ID,
        lender: address,
        borrower: address,
    }

    // ===== Events =====

    public struct LoanRequested has copy, drop {
        loan_id: ID,
        pool_id: ID,
        borrower: address,
        principal: u64,
    }

    public struct LoanApproved has copy, drop {
        approval_id: ID,
        loan_id: ID,
        lender: address,
        borrower: address,
    }

    public struct LoanFunded has copy, drop {
        loan_id: ID,
        pool_id: ID,
        borrower: address,
        principal: u64,
        total_due: u64,
    }

    public struct LoanRepaid has copy, drop {
        loan_id: ID,
        borrower: address,
        amount: u64,
        outstanding_balance: u64,
        fully_repaid: bool,
    }

    // ===== Functions =====

    /// Borrower requests a loan from a pool, attaching the VC hash on-chain.
    /// Creates a LoanPosition NFT owned by the borrower.
    public entry fun request_loan(
        pool: &Pool,
        principal: u64,
        vc_hash: vector<u8>,
        ctx: &mut TxContext
    ) {
        let borrower = tx_context::sender(ctx);
        let pool_id = pool::get_pool_id(pool);
        let interest_rate_bps = pool::get_interest_rate(pool);

        let total_due = principal + (principal * interest_rate_bps / 10000);

        let loan_uid = object::new(ctx);
        let loan_id = object::uid_to_inner(&loan_uid);

        let loan = LoanPosition {
            id: loan_uid,
            pool_id,
            borrower,
            principal,
            interest_rate_bps,
            total_due,
            outstanding_balance: total_due,
            status: STATUS_REQUESTED,
            vc_hash,
        };

        event::emit(LoanRequested { loan_id, pool_id, borrower, principal });

        transfer::transfer(loan, borrower);
    }

    /// Lender approves a loan request by creating a LoanApproval capability
    /// and sending it to the borrower. This is the on-chain record of approval.
    ///
    ///   loan_id  — object ID of the LoanPosition being approved
    ///   borrower — recipient of the approval (must match loan.borrower)
    public entry fun approve_loan(
        loan_id: ID,
        borrower: address,
        ctx: &mut TxContext
    ) {
        let lender = tx_context::sender(ctx);

        let approval_uid = object::new(ctx);
        let approval_id = object::uid_to_inner(&approval_uid);

        let approval = LoanApproval {
            id: approval_uid,
            loan_id,
            lender,
            borrower,
        };

        event::emit(LoanApproved { approval_id, loan_id, lender, borrower });

        // Transfer the one-time approval capability to the borrower
        transfer::transfer(approval, borrower);
    }

    /// Borrower claims their funds by presenting the lender's LoanApproval.
    /// The approval is verified and consumed; principal is transferred from the pool.
    ///
    /// Requires:
    ///   - loan in STATUS_REQUESTED
    ///   - approval.loan_id == this loan's object ID
    ///   - pool matches loan.pool_id (prevents draining the wrong pool)
    public entry fun fund_loan(
        loan: &mut LoanPosition,
        approval: LoanApproval,
        pool: &mut Pool,
        ctx: &mut TxContext
    ) {
        assert!(loan.status == STATUS_REQUESTED, ELoanNotRequested);

        // Verify the pool passed matches the one recorded in the loan
        assert!(loan.pool_id == pool::get_pool_id(pool), EWrongPool);

        // Verify the approval is for THIS specific loan
        let loan_id = object::uid_to_inner(&loan.id);
        assert!(approval.loan_id == loan_id, EBadApproval);

        // Consume (destroy) the one-time use approval capability
        let LoanApproval { id: approval_uid, loan_id: _, lender: _, borrower: _ } = approval;
        object::delete(approval_uid);

        let borrower = loan.borrower;
        let principal = loan.principal;
        let total_due = loan.total_due;

        loan.status = STATUS_FUNDED;

        event::emit(LoanFunded {
            loan_id,
            pool_id: loan.pool_id,
            borrower,
            principal,
            total_due,
        });

        // Transfer principal from pool to borrower
        pool::withdraw_for_loan(pool, principal, borrower, ctx);
    }

    /// Borrower repays (partial or full) a funded loan.
    /// Overpayment is automatically refunded to the borrower.
    public entry fun repay_loan(
        loan: &mut LoanPosition,
        mut payment: Coin<IOTA>,
        pool: &mut Pool,
        ctx: &mut TxContext
    ) {
        assert!(loan.status == STATUS_FUNDED, ENotFundedState);

        // Verify the pool passed matches the one recorded in the loan
        assert!(loan.pool_id == pool::get_pool_id(pool), EWrongPool);

        let amount = coin::value(&payment);
        assert!(amount > 0, EInvalidRepayAmount);

        let loan_id = object::uid_to_inner(&loan.id);
        let borrower = loan.borrower;
        assert!(tx_context::sender(ctx) == borrower, ENotBorrower);

        // Refund any overpayment so the borrower never loses excess funds
        let pay_amount = if (amount > loan.outstanding_balance) {
            let excess = coin::split(&mut payment, amount - loan.outstanding_balance, ctx);
            transfer::public_transfer(excess, borrower);
            loan.outstanding_balance
        } else {
            amount
        };

        loan.outstanding_balance = loan.outstanding_balance - pay_amount;

        let fully_repaid = loan.outstanding_balance == 0;
        if (fully_repaid) {
            loan.status = STATUS_REPAID;
        };

        event::emit(LoanRepaid {
            loan_id,
            borrower,
            amount: pay_amount,
            outstanding_balance: loan.outstanding_balance,
            fully_repaid,
        });

        pool::receive_repayment(pool, payment);
    }

    // ===== View functions =====

    public fun get_status(loan: &LoanPosition): u8 { loan.status }
    public fun get_borrower(loan: &LoanPosition): address { loan.borrower }
    public fun get_principal(loan: &LoanPosition): u64 { loan.principal }
    public fun get_total_due(loan: &LoanPosition): u64 { loan.total_due }
    public fun get_outstanding_balance(loan: &LoanPosition): u64 { loan.outstanding_balance }
    public fun get_pool_id(loan: &LoanPosition): ID { loan.pool_id }
    public fun get_vc_hash(loan: &LoanPosition): &vector<u8> { &loan.vc_hash }

    public fun get_approval_loan_id(approval: &LoanApproval): ID { approval.loan_id }
    public fun get_approval_lender(approval: &LoanApproval): address { approval.lender }
    public fun get_approval_borrower(approval: &LoanApproval): address { approval.borrower }
}
