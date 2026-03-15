import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const pools = await prisma.pool.findMany({
      orderBy: { interestRateBps: "asc" },
    });
    return NextResponse.json(
      pools.map((p) => ({
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
    console.error("[GET /api/pools]", err);
    return NextResponse.json({ error: "Failed to fetch pools" }, { status: 500 });
  }
}
