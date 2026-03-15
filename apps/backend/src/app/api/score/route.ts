import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateRiskScore } from "@/lib/risk-engine";
import { prisma } from "@/lib/prisma";

const schema = z.object({ borrower_did: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { borrower_did } = schema.parse(body);

    const result = calculateRiskScore(borrower_did);

    // Upsert borrower record
    await prisma.borrower.upsert({
      where: { did: borrower_did },
      update: {},
      create: {
        did: borrower_did,
        address: `0x${Buffer.from(borrower_did).toString("hex").slice(0, 40)}`,
      },
    });

    // Save score card
    await prisma.scoreCard.create({
      data: {
        borrowerDid: borrower_did,
        score: result.score,
        riskBand: result.riskBand,
        metrics: result.metrics as object,
      },
    });

    return NextResponse.json({
      score: result.score,
      risk_band: result.riskBand,
      metrics: result.metrics,
      composite_breakdown: result.compositeBreakdown,
    });
  } catch (err) {
    console.error("[POST /api/score]", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
