import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const did = searchParams.get("did");
  if (!did) return NextResponse.json({ error: "did parameter required" }, { status: 400 });

  try {
    const { IotaIdentityClient } = await import("@iota/identity-wasm/node");
    const { IotaClient } = await import("@iota/iota-sdk/client");
    const nodeUrl = process.env.IOTA_NODE_URL ?? "https://api.testnet.iota.cafe";
    const client = new IotaClient({ url: nodeUrl });
    const identityClient = new IotaIdentityClient(client);
    const doc = await identityClient.resolveDid(did);
    return NextResponse.json({ did_document: doc.toJSON() });
  } catch (err) {
    // Mock fallback
    return NextResponse.json({
      did_document: {
        id: did,
        verificationMethod: [
          {
            id: `${did}#key-1`,
            type: "JsonWebKey2020",
            controller: did,
          },
        ],
        authentication: [`${did}#key-1`],
        assertionMethod: [`${did}#key-1`],
      },
      mock: true,
      error: (err as Error).message,
    });
  }
}
