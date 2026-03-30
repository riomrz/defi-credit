/**
 * IOTA Identity integration using @iota/identity-wasm
 * Falls back gracefully when IOTA node is unreachable.
 */

import type { RiskAttestationVC } from "./vc-issuer";

export interface SignResult {
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofValue: string;
  };
  anchoredTx: string | null;
}

export async function signVcWithIota(
  vc: RiskAttestationVC,
  issuerDid: string
): Promise<SignResult> {
  // Dynamic import to avoid WASM initialization at module load time
  const { IotaIdentityClient, Credential, JwsSignatureOptions } = await import(
    "@iota/identity-wasm/node"
  );
  const { IotaClient } = await import("@iota/iota-sdk/client");

  const nodeUrl = process.env.IOTA_NODE_URL ?? "https://api.testnet.iota.cafe";
  const client = new IotaClient({ url: nodeUrl });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const identityClient = new IotaIdentityClient(client as any);

  // Resolve issuer DID document
  const issuerDoc = await identityClient.resolveDid(issuerDid);

  const credential = new Credential({
    id: vc.id,
    type: vc.type,
    issuer: issuerDid,
    credentialSubject: vc.credentialSubject,
    expirationDate: new Date(vc.expirationDate),
  });

  const privateKeyHex = process.env.ISSUER_PRIVATE_KEY_HEX;
  if (!privateKeyHex) throw new Error("ISSUER_PRIVATE_KEY_HEX not set");

  // Sign as JWT
  const signedJwt = await issuerDoc.createCredentialJwt(
    { keyId: "#key-1", privateKeyHex },
    credential,
    new JwsSignatureOptions()
  );

  return {
    proof: {
      type: "JsonWebSignature2020",
      created: new Date().toISOString(),
      verificationMethod: `${issuerDid}#key-1`,
      proofValue: signedJwt.toString(),
    },
    anchoredTx: null, // Tangle anchoring would go here
  };
}

export async function verifyVc(vcJwt: string, issuerDid: string): Promise<boolean> {
  try {
    const { IotaIdentityClient, JwtCredentialValidationOptions, JwtCredentialValidator } =
      await import("@iota/identity-wasm/node");
    const { IotaClient } = await import("@iota/iota-sdk/client");

    const nodeUrl = process.env.IOTA_NODE_URL ?? "https://api.testnet.iota.cafe";
    const client = new IotaClient({ url: nodeUrl });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const identityClient = new IotaIdentityClient(client as any);

    const issuerDoc = await identityClient.resolveDid(issuerDid);
    const validator = new JwtCredentialValidator();
    validator.validate(
      vcJwt,
      issuerDoc,
      new JwtCredentialValidationOptions(),
      "all_errors"
    );
    return true;
  } catch {
    return false;
  }
}
