# DefiCredit Smart Contracts

Move contracts deployed on **IOTA testnet** implementing the complete lifecycle of a DeFi loan with decentralised identity verification.

---

## General Architecture

The system consists of two distinct Move modules with separate responsibilities:

- **`pool.move`** — manages liquidity: lender deposits, loan disbursements, and withdrawal of capital with accrued interest.
- **`loan.move`** — manages the lifecycle of each loan: borrower request, lender approval, fund disbursement, and repayment.

The separation is enforced by the `public(package)` modifier: the internal pool functions that move funds (`withdraw_for_loan`, `receive_repayment`) can only be called **from `loan.move`**, never directly by an external user.

---

## Module `pool.move`

### Main Objects

**`Pool`** — shared object (`key`, shared). One exists per risk tier (Alpha, Beta, Gamma). Fields:

| Field | Type | Description |
|---|---|---|
| `liquidity` | `Balance<IOTA>` | Funds available for lending (in nanos) |
| `interest_rate_bps` | `u64` | Interest rate in basis points (e.g. 520 = 5.20%) |
| `total_shares` | `u64` | Sum of all lender shares (in basis points) |
| `admin` | `address` | Address of the pool creator |

**`LPPosition`** — owned object (`key`), transferred to the lender upon deposit. Represents the lender's share in the pool. Fields:

| Field | Type | Description |
|---|---|---|
| `pool_id` | `ID` | ID of the pool it belongs to |
| `lender` | `address` | Address of the owning lender |
| `deposited_amount` | `u64` | Originally deposited amount (in nanos) |
| `share_bps` | `u64` | Percentage share of the pool (in basis points) |

### Public Functions

#### `create_pool(interest_rate_bps, ctx)`
Creates a new pool with the specified interest rate. The pool is made a shared object (`transfer::share_object`) so anyone can interact with it. A `PoolAdminCap` is also created and transferred to the admin.

#### `deposit_liquidity(pool, payment, ctx)`
The lender deposits `Coin<IOTA>` into the pool. The contract:
1. Calculates the `share_bps` proportional to the deposit relative to total liquidity.
2. Merges the funds into the pool balance (`balance::join`).
3. Creates and transfers an `LPPosition` NFT to the lender as a deposit receipt.

The first depositor always receives 100% of shares (`share_bps = 10000`), since no prior shares exist.

#### `withdraw_liquidity(pool, lp_pos, ctx)`
The lender redeems their `LPPosition` to withdraw their proportional share of the current pool balance — which includes both the original deposit and any interest accrued from borrower repayments.

The withdrawable amount is calculated as:

```
amount = (lp_pos.share_bps * pool_balance) / pool.total_shares
```

This ensures that if the pool has earned interest, the lender receives more than they originally deposited. The `LPPosition` is consumed (deleted) at the end of the operation.

Security checks:
- `ENotPoolOwner` — only the lender who owns the `LPPosition` can redeem it.
- `EWrongPool` — the `LPPosition` must belong to the pool passed as argument (prevents using one pool's position to drain another).
- `EInsufficientLiquidity` — the pool balance must be sufficient to cover the lender's share.

### Internal Functions (`public(package)`)

These functions can only be called from `loan.move` and are not directly accessible from outside the package.

#### `withdraw_for_loan(pool, amount, recipient, ctx)`
Withdraws `amount` nanos from the pool and transfers them to the borrower. Called by `loan::fund_loan`. Aborts with `EInsufficientLiquidity` (abort code 1) if the balance is insufficient.

#### `receive_repayment(pool, payment)`
Adds the repayment `Coin<IOTA>` to the pool balance. Called by `loan::repay_loan`.

---

## Module `loan.move`

### Main Objects

**`LoanPosition`** — owned object (`key`), created for the borrower upon loan request. It is the on-chain record of the loan. Fields:

| Field | Type | Description |
|---|---|---|
| `pool_id` | `ID` | ID of the pool that will provide the funds |
| `borrower` | `address` | Borrower's address |
| `principal` | `u64` | Requested capital (in nanos) |
| `interest_rate_bps` | `u64` | Rate applied at the time of the request |
| `total_due` | `u64` | Total to repay: `principal + (principal * rate / 10000)` |
| `outstanding_balance` | `u64` | Remaining balance to repay |
| `status` | `u8` | 0 = requested, 1 = funded, 2 = repaid |
| `vc_hash` | `vector<u8>` | Hash of the identity Verifiable Credential (off-chain) |

**`LoanApproval`** — owned object (`key, store`), created by the lender and transferred to the borrower as a spending capability. Single-use: consumed (deleted) inside `fund_loan`. Fields:

| Field | Type | Description |
|---|---|---|
| `loan_id` | `ID` | ID of the `LoanPosition` this approval refers to |
| `lender` | `address` | Address of the approving lender |
| `borrower` | `address` | Address of the recipient borrower |

### Loan Lifecycle

```
borrower                    lender                     contract
   │                           │                           │
   │──request_loan()──────────────────────────────────────►│
   │  (creates LoanPosition, status=0)                     │
   │◄──────────────────────────────────── LoanPosition ────│
   │                           │                           │
   │                           │──approve_loan()──────────►│
   │                           │  (creates LoanApproval)   │
   │◄──────────────────────────────────── LoanApproval ────│
   │                           │                           │
   │──fund_loan()─────────────────────────────────────────►│
   │  (verifies approval, withdraws from pool, status=1)   │
   │◄──────────────────────────────── principal in IOTA ───│
   │                           │                           │
   │──repay_loan()────────────────────────────────────────►│
   │  (partial/full repayment, funds → pool, status=2)     │
   │                           │                           │
```

### Public Functions

#### `request_loan(pool, principal, vc_hash, ctx)`
The borrower opens a loan request. The contract:
1. Reads `pool_id` and `interest_rate_bps` from the pool.
2. Calculates `total_due = principal + (principal * rate / 10000)`.
3. Creates and transfers a `LoanPosition` NFT to the borrower in `STATUS_REQUESTED` state.
4. Stores the `vc_hash` on-chain: the hash of the Verifiable Credential proves the borrower's identity was verified off-chain without exposing any personal data.

#### `approve_loan(loan_id, borrower, ctx)`
The lender creates a `LoanApproval` and transfers it to the specified borrower. The capability is bound to the ID of a specific `LoanPosition`: it cannot be used for any other loan.

#### `fund_loan(loan, approval, pool, ctx)`
The borrower presents the `LoanApproval` received from the lender to unlock the funds. The contract:
1. Verifies the loan is in `STATUS_REQUESTED` state.
2. Verifies the pool passed matches `loan.pool_id` (`EWrongPool`).
3. Verifies `approval.loan_id` matches the ID of this `LoanPosition` (`EBadApproval`).
4. Consumes (deletes) the `LoanApproval` — it is single-use.
5. Updates the status to `STATUS_FUNDED`.
6. Calls `pool::withdraw_for_loan` to transfer the `principal` to the borrower.

#### `repay_loan(loan, payment, pool, ctx)`
The borrower repays the loan, in one or more partial payments. The contract:
1. Verifies the loan is in `STATUS_FUNDED` state and that the caller is the borrower.
2. Verifies the pool matches `loan.pool_id` (`EWrongPool`).
3. If the payment exceeds the outstanding balance, **automatically refunds the excess** to the borrower via `coin::split`.
4. Updates `outstanding_balance`.
5. If the outstanding balance reaches zero, sets the status to `STATUS_REPAID`.
6. Calls `pool::receive_repayment` to credit the funds to the pool.

---

## Security and Design Choices

**Capability pattern for approval**
`LoanApproval` is a single-use capability object. The lender does not disburse funds directly — they create a cryptographic proof of approval that only the intended borrower can present. Deleting the object inside `fund_loan` guarantees it cannot be reused.

**Identity verification via VC hash**
The `vc_hash` stored in the `LoanPosition` is the SHA-256 hash of the Verifiable Credential issued off-chain by the identity provider. No personal data is exposed on-chain: the contract only records proof that a valid verified credential exists, linking the loan to the borrower's identity in a privacy-preserving way.

**Pool/loan separation via `public(package)`**
The functions that move funds in the pool (`withdraw_for_loan`, `receive_repayment`) are declared `public(package)`: visible only to other modules within the same package, not externally. This prevents anyone from calling them directly to drain the pool without going through `loan.move`'s verification logic.

**Cross-module pool_id verification**
Both `fund_loan` and `repay_loan` verify that the pool passed as an argument matches the `pool_id` recorded in the `LoanPosition` at request time. Likewise, `withdraw_liquidity` verifies that the `LPPosition` belongs to the specified pool. These checks prevent attacks where a malicious user passes the wrong pool to drain someone else's funds.

**Overpayment refund**
If the borrower sends a payment larger than the outstanding balance, the contract calculates the excess with `coin::split` and immediately returns it to the borrower within the same transaction. It is impossible to lose funds through a mistake.

---

## Prerequisites and Deployment

**Prerequisites**

- IOTA CLI installed: `cargo install --locked iota`
- Testnet wallet with funds (faucet: https://faucet.testnet.iota.cafe)

**Build and deploy**

```bash
cd contracts/

# Build
iota move build

# Deploy to testnet
iota client publish --gas-budget 100000000
```

After deployment, update the environment variables with the returned Package ID:

```
# apps/backend/.env
MOVE_PACKAGE_ID=0x<PACKAGE_ID>

# apps/frontend/.env.local
NEXT_PUBLIC_MOVE_PACKAGE_ID=0x<PACKAGE_ID>
```

Then recreate the pools on-chain and update the database:

```bash
cd apps/backend
node scripts/init-pools-autofund.mjs
```

> ⚠️ After every redeploy, `init-pools-autofund.mjs` must be re-run. Pool object IDs change with each deployment: if the database contains stale IDs, transactions will fail with a type error (`Invalid command argument`).

---

## Error Codes

| Module | Code | Constant | Meaning |
|--------|------|----------|---------|
| pool | 1 | `EInsufficientLiquidity` | Pool balance insufficient for the operation |
| pool | 2 | `EInvalidAmount` | Invalid amount (e.g. zero) |
| pool | 3 | `ENotPoolOwner` | Caller is not the owner of the LPPosition |
| pool | 5 | `EWrongPool` | LPPosition does not belong to the specified pool |
| loan | 1 | `ENotBorrower` | Only the original borrower can repay |
| loan | 2 | `ENotFundedState` | Loan is not in FUNDED state |
| loan | 4 | `EInvalidRepayAmount` | Repayment amount is zero |
| loan | 5 | `ELoanNotRequested` | Loan is not in REQUESTED state |
| loan | 7 | `EBadApproval` | LoanApproval does not match this loan |
| loan | 8 | `EWrongPool` | Pool does not match the loan's recorded pool |
