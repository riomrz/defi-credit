/**
 * IOTA wallet utilities — balance formatting and DID derivation.
 * Hooks (useCurrentAccount, useIotaClientQuery, etc.) are used
 * directly in components via @iota/dapp-kit.
 */

/** 1 IOTA = 1_000_000_000 NANO */
export const NANO_PER_IOTA = BigInt(1_000_000_000);

/**
 * Converts a nano balance string (from the IOTA RPC) to a human-readable
 * IOTA string with up to 4 decimal places.
 */
export function nanosToIota(nanos: string | bigint): string {
  const n = typeof nanos === "string" ? BigInt(nanos) : nanos;
  const whole = n / NANO_PER_IOTA;
  const remainder = n % NANO_PER_IOTA;
  const decimal = remainder.toString().padStart(9, "0").slice(0, 4);
  return `${whole.toLocaleString()}.${decimal}`;
}

/**
 * Converts an IOTA amount (entered by the user) to nanos (bigint).
 */
export function iotaToNanos(iota: number): bigint {
  return BigInt(Math.round(iota * 1_000_000_000));
}

/**
 * Derives a deterministic DID from an IOTA wallet address.
 * In production this would be a published IOTA Identity DID.
 */
export function didFromAddress(address: string): string {
  return `did:iota:tst:${address}`;
}

/**
 * Shortens an IOTA address for display: 0xabcd...ef12
 */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
