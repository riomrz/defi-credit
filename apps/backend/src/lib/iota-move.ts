/**
 * IOTA Move smart contract interaction helpers.
 * Uses @iota/iota-sdk to call pool.move and loan.move functions.
 */

import { IotaClient } from "@iota/iota-sdk/client";
import { Transaction } from "@iota/iota-sdk/transactions";

const PACKAGE_ID = process.env.MOVE_PACKAGE_ID ?? "0x_DEPLOY_PACKAGE_ID";
const POOL_MODULE = "pool";
const LOAN_MODULE = "loan";

function getClient(): IotaClient {
  const url = process.env.IOTA_NODE_URL ?? "https://api.testnet.iota.cafe";
  return new IotaClient({ url });
}

export interface TxPayload {
  packageId: string;
  module: string;
  function: string;
  typeArguments: string[];
  arguments: (string | number | bigint)[];
  description: string;
}

/** Build unsigned tx payload for request_loan — to be signed by borrower wallet */
export function buildRequestLoanTx(
  poolObjectId: string,
  principal: bigint
): TxPayload {
  return {
    packageId: PACKAGE_ID,
    module: LOAN_MODULE,
    function: "request_loan",
    typeArguments: [],
    arguments: [poolObjectId, principal.toString()],
    description: `Request loan of ${principal} from pool ${poolObjectId}`,
  };
}

/** Build unsigned tx payload for fund_loan — to be signed by lender wallet */
export function buildFundLoanTx(loanObjectId: string): TxPayload {
  return {
    packageId: PACKAGE_ID,
    module: LOAN_MODULE,
    function: "fund_loan",
    typeArguments: [],
    arguments: [loanObjectId],
    description: `Fund loan ${loanObjectId}`,
  };
}

/** Build unsigned tx payload for repay_loan — to be signed by borrower wallet */
export function buildRepayLoanTx(loanObjectId: string, amount: bigint): TxPayload {
  return {
    packageId: PACKAGE_ID,
    module: LOAN_MODULE,
    function: "repay_loan",
    typeArguments: [],
    arguments: [loanObjectId, amount.toString()],
    description: `Repay ${amount} on loan ${loanObjectId}`,
  };
}

/** Fetch pool object state from chain */
export async function fetchPoolState(poolObjectId: string) {
  try {
    const client = getClient();
    const obj = await client.getObject({
      id: poolObjectId,
      options: { showContent: true },
    });
    return obj.data?.content;
  } catch {
    return null;
  }
}

/** Fetch loan position from chain */
export async function fetchLoanState(loanObjectId: string) {
  try {
    const client = getClient();
    const obj = await client.getObject({
      id: loanObjectId,
      options: { showContent: true },
    });
    return obj.data?.content;
  } catch {
    return null;
  }
}
