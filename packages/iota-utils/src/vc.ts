/**
 * Verifiable Credential utilities using IOTA Identity
 */
import type { RiskAttestationVC } from "@deficredit/shared-types";
import { createIdentityClient } from "./client";

export async function verifyCredentialJwt(
  vcJwt: string,
  issuerDid: string,
  network: string = "testnet"
): Promise<{ valid: boolean; error?: string }> {
  try {
    const {
      JwtCredentialValidator,
      JwtCredentialValidationOptions,
      FailFast,
      Resolver,
      IotaIdentityClient,
    } = await import("@iota/identity-wasm/node");

    const identityClient = await createIdentityClient({ network: network as "testnet" });
    const issuerDoc = await identityClient.resolveDid(issuerDid);
    const validator = new JwtCredentialValidator();
    validator.validate(
      vcJwt,
      issuerDoc,
      new JwtCredentialValidationOptions(),
      FailFast.AllErrors
    );
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

export function extractVCSubject(vc: RiskAttestationVC) {
  return {
    borrowerDid: vc.credentialSubject.id,
    score: vc.credentialSubject.riskScore,
    riskBand: vc.credentialSubject.riskBand,
    metrics: vc.credentialSubject.metrics,
    issuedAt: vc.issuanceDate,
    expiresAt: vc.expirationDate,
  };
}

export function isVCExpired(vc: RiskAttestationVC): boolean {
  return new Date(vc.expirationDate) < new Date();
}
