import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateRiskScore } from "@/lib/risk-engine";
import { issueRiskAttestationVC } from "@/lib/vc-issuer";
import { prisma } from "@/lib/prisma";

const schema = z.object({ borrower_did: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { borrower_did } = schema.parse(body);

    // Get latest score or compute fresh
    const latest = await prisma.scoreCard.findFirst({
      where: { borrowerDid: borrower_did },
      orderBy: { createdAt: "desc" },
    });

    const scoreResult = latest
      ? {
          score: latest.score,
          riskBand: latest.riskBand,
          metrics: latest.metrics as Record<string, number>,
        }
      : calculateRiskScore(borrower_did);

    const { vc, vcHash, anchoredTx } = await issueRiskAttestationVC(
      borrower_did,
      scoreResult.score,
      scoreResult.riskBand,
      scoreResult.metrics
    );

    // Ensure borrower exists
    await prisma.borrower.upsert({
      where: { did: borrower_did },
      update: {},
      create: {
        did: borrower_did,
        address: `0x${Buffer.from(borrower_did).toString("hex").slice(0, 40)}`,
      },
    });

    const expiresAt = new Date(vc.expirationDate);
    await prisma.verifiableCredential.create({
      data: {
        borrowerDid: borrower_did,
        vcHash,
        vcJson: vc as object,
        anchoredTx,
        expiresAt,
      },
    });

    return NextResponse.json({
      vc,
      vc_hash: vcHash,
      anchored_tx: anchoredTx,
    });
  } catch (err) {
    console.error("[POST /api/issue-vc]", err);
    return NextResponse.json({ error: "Failed to issue VC" }, { status: 500 });
  }
}
