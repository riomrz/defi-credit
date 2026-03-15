/**
 * DID creation and resolution utilities
 */
import { createIotaClient, createIdentityClient } from "./client";

export interface CreateDIDResult {
  did: string;
  document: Record<string, unknown>;
  publishTxHash: string;
}

/**
 * Creates a new IOTA DID. Requires a funded wallet.
 * In development/demo, returns a mock DID.
 */
export async function createDID(
  privateKeyHex: string,
  network: string = "testnet"
): Promise<CreateDIDResult> {
  try {
    const { IotaDocument, IotaVerificationMethod, MethodScope, KeyType, Storage, JwkMemStore, KeyIdMemStore } =
      await import("@iota/identity-wasm/node");

    const { IotaClient } = await import("@iota/iota-sdk/client");
    const { Transaction } = await import("@iota/iota-sdk/transactions");
    const identityClient = await createIdentityClient({ network: network as "testnet" });

    const networkName = await identityClient.getNetworkHrp();
    const storage = new Storage(new JwkMemStore(), new KeyIdMemStore());

    const document = new IotaDocument(networkName);
    const verificationMethod = await document.generateMethod(
      storage,
      KeyType.Ed25519,
      "#key-1",
      MethodScope.VerificationMethod()
    );
    document.insertMethod(verificationMethod, MethodScope.VerificationMethod());
    document.insertMethod(verificationMethod, MethodScope.Authentication());
    document.insertMethod(verificationMethod, MethodScope.AssertionMethod());

    // Note: Publishing requires a funded wallet and signing
    // This is a placeholder for the actual publish flow
    const did = document.id().toString();

    return {
      did,
      document: document.toJSON() as Record<string, unknown>,
      publishTxHash: "0xmock_publish_tx",
    };
  } catch (err) {
    // Mock fallback for development
    const mockDid = `did:iota:tst:0x${privateKeyHex.slice(0, 40)}`;
    return {
      did: mockDid,
      document: {
        id: mockDid,
        verificationMethod: [{ id: `${mockDid}#key-1`, type: "Ed25519VerificationKey2020", controller: mockDid }],
        authentication: [`${mockDid}#key-1`],
        assertionMethod: [`${mockDid}#key-1`],
      },
      publishTxHash: "0xmock",
    };
  }
}

export async function resolveDID(did: string, network: string = "testnet") {
  try {
    const identityClient = await createIdentityClient({ network: network as "testnet" });
    const document = await identityClient.resolveDid(did);
    return document.toJSON();
  } catch (err) {
    return {
      id: did,
      error: (err as Error).message,
      mock: true,
    };
  }
}
