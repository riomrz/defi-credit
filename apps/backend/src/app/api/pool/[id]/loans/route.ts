import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pool = await prisma.pool.findUnique({ where: { id: params.id } });
    if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });

    const loans = await prisma.loanRequest.findMany({
      where: { poolId: params.id, status: 0 },
      orderBy: { requestedAt: "desc" },
      include: {
        borrower: {
          include: {
            scoreCards: { orderBy: { createdAt: "desc" }, take: 1 },
            vcs: { orderBy: { issuedAt: "desc" }, take: 1 },
          },
        },
      },
    });

    return NextResponse.json(
      loans.map((l) => ({
        loan_id: l.id,
        on_chain_id: l.onChainId,
        borrower_did: l.borrowerDid,
        borrower_address: l.borrowerAddr,
        principal: l.principal.toString(),
        status: l.status,
        requested_at: l.requestedAt,
        score: l.borrower.scoreCards[0]?.score ?? null,
        risk_band: l.borrower.scoreCards[0]?.riskBand ?? null,
        vc_hash: l.borrower.vcs[0]?.vcHash ?? null,
        vc_issued_at: l.borrower.vcs[0]?.issuedAt ?? null,
        vc_metadata: l.borrower.vcs[0]
          ? {
              id: (l.borrower.vcs[0].vcJson as { id: string }).id,
              type: (l.borrower.vcs[0].vcJson as { type: string[] }).type,
              issuer: (l.borrower.vcs[0].vcJson as { issuer: string }).issuer,
              issuance_date: (l.borrower.vcs[0].vcJson as { issuanceDate: string })
                .issuanceDate,
              expiration_date: (l.borrower.vcs[0].vcJson as { expirationDate: string })
                .expirationDate,
            }
          : null,
      }))
    );
  } catch (err) {
    console.error("[GET /api/pool/:id/loans]", err);
    return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 });
  }
}
