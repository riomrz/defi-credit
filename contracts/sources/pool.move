/// DefiCredit Pool Module
/// Manages liquidity pools and LP positions on IOTA
module deficredit::pool {
    use iota::object::{Self, UID, ID};
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};
    use iota::coin::{Self, Coin};
    use iota::iota::IOTA;
    use iota::balance::{Self, Balance};
    use iota::event;
    use std::vector;

    // ===== Error codes =====
    const EInsufficientLiquidity: u64 = 1;
    const EInvalidAmount: u64 = 2;
    const ENotPoolOwner: u64 = 3;
    const EInsufficientShareBalance: u64 = 4;

    // ===== Structs =====

    /// A lending pool holding liquidity from multiple LPs
    public struct Pool has key {
        id: UID,
        /// Total liquidity available for lending (in NANOS, smallest IOTA unit)
        liquidity: Balance<IOTA>,
        /// Interest rate in basis points (e.g. 1000 = 10%)
        interest_rate_bps: u64,
        /// Total shares issued (in basis points * 1000 for precision)
        total_shares: u64,
        /// Pool creator/admin
        admin: address,
    }

    /// Represents a lender's share in a pool
    public struct LPPosition has key {
        id: UID,
        pool_id: ID,
        lender: address,
        deposited_amount: u64,
        /// Share in basis points (10000 = 100%)
        share_bps: u64,
    }

    /// Admin capability for pool management
    public struct PoolAdminCap has key, store {
        id: UID,
        pool_id: ID,
    }

    // ===== Events =====

    public struct PoolCreated has copy, drop {
        pool_id: ID,
        interest_rate_bps: u64,
        admin: address,
    }

    public struct LiquidityDeposited has copy, drop {
        pool_id: ID,
        lender: address,
        amount: u64,
        share_bps: u64,
    }

    public struct LiquidityWithdrawn has copy, drop {
        pool_id: ID,
        lender: address,
        amount: u64,
    }

    public struct LoanFunded has copy, drop {
        pool_id: ID,
        borrower: address,
        amount: u64,
    }

    public struct LoanRepaid has copy, drop {
        pool_id: ID,
        amount: u64,
    }

    // ===== Functions =====

    /// Create a new lending pool
    public entry fun create_pool(
        interest_rate_bps: u64,
        ctx: &mut TxContext
    ) {
        let pool_uid = object::new(ctx);
        let pool_id = object::uid_to_inner(&pool_uid);
        let admin = tx_context::sender(ctx);

        let pool = Pool {
            id: pool_uid,
            liquidity: balance::zero<IOTA>(),
            interest_rate_bps,
            total_shares: 0,
            admin,
        };

        let admin_cap = PoolAdminCap {
            id: object::new(ctx),
            pool_id,
        };

        event::emit(PoolCreated { pool_id, interest_rate_bps, admin });

        transfer::share_object(pool);
        transfer::transfer(admin_cap, admin);
    }

    /// Deposit liquidity into the pool and receive an LP position
    public entry fun deposit_liquidity(
        pool: &mut Pool,
        payment: Coin<IOTA>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);
        assert!(amount > 0, EInvalidAmount);

        let lender = tx_context::sender(ctx);
        let pool_id = object::uid_to_inner(&pool.id);
        let current_liquidity = balance::value(&pool.liquidity);

        // Calculate share in basis points (proportional to deposit)
        let share_bps = if (pool.total_shares == 0 || current_liquidity == 0) {
            10000 // First depositor gets 100%
        } else {
            (amount * 10000) / (current_liquidity + amount)
        };

        // Adjust existing shares proportionally
        // (simplified: in production use share token approach)
        pool.total_shares = pool.total_shares + share_bps;

        balance::join(&mut pool.liquidity, coin::into_balance(payment));

        let lp_position = LPPosition {
            id: object::new(ctx),
            pool_id,
            lender,
            deposited_amount: amount,
            share_bps,
        };

        event::emit(LiquidityDeposited { pool_id, lender, amount, share_bps });

        transfer::transfer(lp_position, lender);
    }

    /// Withdraw liquidity (simplified: withdraw exact deposited amount if available)
    public entry fun withdraw_liquidity(
        pool: &mut Pool,
        lp_pos: LPPosition,
        ctx: &mut TxContext
    ) {
        let lender = tx_context::sender(ctx);
        assert!(lp_pos.lender == lender, ENotPoolOwner);

        let amount = lp_pos.deposited_amount;
        let available = balance::value(&pool.liquidity);
        assert!(available >= amount, EInsufficientLiquidity);

        let LPPosition { id, pool_id, lender: _, deposited_amount: _, share_bps } = lp_pos;
        object::delete(id);

        pool.total_shares = if (pool.total_shares >= share_bps) {
            pool.total_shares - share_bps
        } else { 0 };

        let withdrawn = coin::from_balance(balance::split(&mut pool.liquidity, amount), ctx);
        event::emit(LiquidityWithdrawn { pool_id, lender, amount });
        transfer::public_transfer(withdrawn, lender);
    }

    // ===== Friend functions (called by loan module) =====

    /// Withdraw funds for a loan (called by loan::fund_loan)
    public(package) fun withdraw_for_loan(
        pool: &mut Pool,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let available = balance::value(&pool.liquidity);
        assert!(available >= amount, EInsufficientLiquidity);
        let pool_id = object::uid_to_inner(&pool.id);
        let funds = coin::from_balance(balance::split(&mut pool.liquidity, amount), ctx);
        event::emit(LoanFunded { pool_id, borrower: recipient, amount });
        transfer::public_transfer(funds, recipient);
    }

    /// Receive repayment back into pool
    public(package) fun receive_repayment(
        pool: &mut Pool,
        payment: Coin<IOTA>,
    ) {
        let amount = coin::value(&payment);
        let pool_id = object::uid_to_inner(&pool.id);
        balance::join(&mut pool.liquidity, coin::into_balance(payment));
        event::emit(LoanRepaid { pool_id, amount });
    }

    // ===== View functions =====

    public fun get_liquidity(pool: &Pool): u64 {
        balance::value(&pool.liquidity)
    }

    public fun get_interest_rate(pool: &Pool): u64 {
        pool.interest_rate_bps
    }

    public fun get_pool_id(pool: &Pool): ID {
        object::uid_to_inner(&pool.id)
    }
}
