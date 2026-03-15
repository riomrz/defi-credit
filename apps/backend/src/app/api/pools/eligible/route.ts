import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const score = parseInt(searchParams.get("score") ?? "0");
  const riskBand = searchParams.get("risk_band") ?? "";

  const bandOrder: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
  const borrowerBandLevel = bandOrder[riskBand] ?? 0;

  try {
    const pools = await prisma.pool.findMany({
      where: { minScore: { lte: score } },
      orderBy: { interestRateBps: "asc" },
    });

    const eligible = pools.filter((p) => {
      const poolBandLevel = bandOrder[p.riskBand] ?? 0;
      return borrowerBandLevel >= poolBandLevel;
    });

    return NextResponse.json(
      eligible.map((p) => ({
        pool_id: p.id,
        on_chain_id: p.onChainId,
        name: p.name,
        description: p.description,
        interest_rate_bps: p.interestRateBps,
        apr_percent: (p.interestRateBps / 100).toFixed(2),
        available_liquidity: p.availableLiquidity.toString(),
        total_liquidity: p.totalLiquidity.toString(),
        min_score: p.minScore,
        risk_band: p.riskBand,
      }))
    );
  } catch (err) {
    console.error("[GET /api/pools/eligible]", err);
    return NextResponse.json({ error: "Failed to fetch pools" }, { status: 500 });
  }
}
