/**
 * Move transaction building utilities
 */
import type { TxPayload } from "@deficredit/shared-types";
import { createIotaClient } from "./client";

export async function getObjectFields(objectId: string, network: string = "testnet") {
  try {
    const client = await createIotaClient({ network: network as "testnet" });
    const obj = await client.getObject({ id: objectId, options: { showContent: true } });
    return obj.data?.content;
  } catch {
    return null;
  }
}

export async function waitForTransaction(txHash: string, network: string = "testnet") {
  try {
    const client = await createIotaClient({ network: network as "testnet" });
    const result = await client.waitForTransaction({ digest: txHash });
    return result;
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export function serializeTxPayload(payload: TxPayload): string {
  return JSON.stringify(payload);
}
