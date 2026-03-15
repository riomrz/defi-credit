import { randomUUID } from "crypto";
import { createHash } from "crypto";

export interface RiskAttestationVC {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: {
    id: string;
    riskScore: number;
    riskBand: string;
    metrics: Record<string, number>;
    consentHash: string;
  };
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofValue: string;
  };
}

export async function issueRiskAttestationVC(
  borrowerDid: string,
  score: number,
  riskBand: string,
  metrics: Record<string, number>
): Promise<{ vc: RiskAttestationVC; vcHash: string; anchoredTx: string | null }> {
  const issuerDid = process.env.ISSUER_DID ?? "did:iota:tst:0xissuer_mock";
  const now = new Date();
  const expiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Build the credential
  const consentData = `${borrowerDid}:${score}:${now.toISOString()}`;
  const consentHash = createHash("sha256").update(consentData).digest("hex");

  const vc: RiskAttestationVC = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://deficredit.io/credentials/v1",
    ],
    id: `urn:uuid:${randomUUID()}`,
    type: ["VerifiableCredential", "RiskAttestationCredential"],
    issuer: issuerDid,
    issuanceDate: now.toISOString(),
    expirationDate: expiry.toISOString(),
    credentialSubject: {
      id: borrowerDid,
      riskScore: score,
      riskBand,
      metrics,
      consentHash,
    },
  };

  // Attempt real IOTA Identity signing
  let anchoredTx: string | null = null;
  try {
    const { signVcWithIota } = await import("./iota-identity");
    const result = await signVcWithIota(vc, issuerDid);
    vc.proof = result.proof;
    anchoredTx = result.anchoredTx;
  } catch (err) {
    // Fallback: mock proof for development
    console.warn(
      "[vc-issuer] IOTA signing unavailable, using mock proof:",
      (err as Error).message
    );
    vc.proof = {
      type: "JsonWebSignature2020",
      created: now.toISOString(),
      verificationMethod: `${issuerDid}#key-1`,
      proofValue: createHash("sha256")
        .update(JSON.stringify(vc.credentialSubject))
        .digest("base64url"),
    };
  }

  const vcHash = createHash("sha256").update(JSON.stringify(vc)).digest("hex");

  return { vc, vcHash, anchoredTx };
}
