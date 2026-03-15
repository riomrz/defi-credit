import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

const schema = z.object({ vc_hash: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vc_hash } = schema.parse(body);
    const record = await prisma.verifiableCredential.findUnique({
      where: { vcHash: vc_hash },
    });
    if (!record)
      return NextResponse.json({ valid: false, reason: "VC not found" });

    const now = new Date();
    if (record.expiresAt < now)
      return NextResponse.json({ valid: false, reason: "VC expired" });

    const recomputedHash = createHash("sha256")
      .update(JSON.stringify(record.vcJson))
      .digest("hex");
    const intact = recomputedHash === vc_hash;

    return NextResponse.json({
      valid: intact,
      borrower_did: record.borrowerDid,
      issued_at: record.issuedAt,
      expires_at: record.expiresAt,
      anchored_tx: record.anchoredTx,
      reason: intact ? "Valid" : "Hash mismatch",
    });
  } catch (err) {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
