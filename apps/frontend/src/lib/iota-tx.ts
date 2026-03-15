/**
 * IOTA Move transaction builders for DefiCredit.
 * Builds Transaction objects ready to be signed with useSignAndExecuteTransaction().
 *
 * Requires MOVE_PACKAGE_ID to be set in NEXT_PUBLIC_MOVE_PACKAGE_ID.
 * When not set, functions throw an informative error (contracts not deployed yet).
 */
import { Transaction } from "@iota/iota-sdk/transactions";

const PACKAGE_ID = process.env.NEXT_PUBLIC_MOVE_PACKAGE_ID ?? "";
const POOL_MODULE = "pool";
const LOAN_MODULE = "loan";

function requirePackage(): string {
  if (!PACKAGE_ID) {
    throw new Error(
      "Move contracts not deployed yet. Set NEXT_PUBLIC_MOVE_PACKAGE_ID in apps/frontend/.env.local after deploying contracts."
    );
  }
  return PACKAGE_ID;
}

/**
 * Lender: deposit IOTA into a pool.
 * Splits the gas coin and passes a Coin<IOTA> to pool::deposit_liquidity.
 */
export function buildDepositLiquidityTx(
  poolObjectId: string,
  amountNano: bigint
): Transaction {
  const pkg = requirePackage();
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountNano)]);
  tx.moveCall({
    target: `${pkg}::${POOL_MODULE}::deposit_liquidity`,
    arguments: [tx.object(poolObjectId), coin],
  });
  return tx;
}

/**
 * Borrower: request a loan from a pool, attaching the VC hash on-chain.
 */
export function buildRequestLoanTx(
  poolObjectId: string,
  principalNano: bigint,
  vcHashHex: string
): Transaction {
  const pkg = requirePackage();
  const tx = new Transaction();
  // Convert hex VC hash to byte array
  const vcHashBytes = Array.from(Buffer.from(vcHashHex.replace("0x", ""), "hex"));
  tx.moveCall({
    target: `${pkg}::${LOAN_MODULE}::request_loan`,
    arguments: [
      tx.object(poolObjectId),
      tx.pure.u64(principalNano),
      tx.pure.vector("u8", vcHashBytes),
    ],
  });
  return tx;
}

/**
 * Lender: approve a loan request on-chain.
 * Creates a LoanApproval capability that is sent to the borrower.
 *
 * loanObjectId  — the LoanPosition object ID (passed as a pure ID value, not &mut)
 * borrowerAddr  — the borrower's address (recipient of the LoanApproval)
 */
export function buildApproveLoanTx(
  loanObjectId: string,
  borrowerAddr: string
): Transaction {
  const pkg = requirePackage();
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg}::${LOAN_MODULE}::approve_loan`,
    arguments: [
      // loan_id: ID — passed as a pure address value (ID is BCS-compatible with address)
      tx.pure.address(loanObjectId),
      tx.pure.address(borrowerAddr),
    ],
  });
  return tx;
}

/**
 * Borrower: claim funds by presenting the lender's LoanApproval.
 * The approval object is consumed (deleted) inside the Move function.
 *
 * loanObjectId     — the LoanPosition object ID (owned by borrower)
 * approvalObjectId — the LoanApproval object ID (sent by lender to borrower)
 * poolObjectId     — the shared Pool object ID
 */
export function buildFundLoanTx(
  loanObjectId: string,
  approvalObjectId: string,
  poolObjectId: string
): Transaction {
  const pkg = requirePackage();
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg}::${LOAN_MODULE}::fund_loan`,
    arguments: [
      tx.object(loanObjectId),    // &mut LoanPosition (owned by borrower)
      tx.object(approvalObjectId), // LoanApproval by value (consumed)
      tx.object(poolObjectId),    // &mut Pool (shared)
    ],
  });
  return tx;
}

/**
 * Borrower: repay a loan (partial or full).
 * Splits gas coin for the repayment amount.
 */
export function buildRepayLoanTx(
  loanObjectId: string,
  poolObjectId: string,
  amountNano: bigint
): Transaction {
  const pkg = requirePackage();
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountNano)]);
  tx.moveCall({
    target: `${pkg}::${LOAN_MODULE}::repay_loan`,
    arguments: [tx.object(loanObjectId), coin, tx.object(poolObjectId)],
  });
  return tx;
}

/** Whether contracts are deployed (MOVE_PACKAGE_ID is set) */
export function contractsDeployed(): boolean {
  return Boolean(PACKAGE_ID);
}

/** The Move package ID (or empty string if not deployed) */
export function getPackageId(): string {
  return PACKAGE_ID;
}
