/**
 * GET /api/loan/borrower?address={address}
 *
 * Restituisce il prestito attivo più recente per un borrower address.
 * "Attivo" = status 0 (requested) o 1 (funded) — non repaid.
 * Usato dal frontend per il "resume loan" dopo un re-login.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address");
    if (!address) {
      return NextResponse.json({ error: "address query param required" }, { status: 400 });
    }

    const loan = await prisma.loanRequest.findFirst({
      where: {
        borrowerAddr: address,
        status: { in: [0, 1] },  // requested or funded — non ancora ripagato
      },
      include: { pool: true },
      orderBy: { requestedAt: "desc" },
    });

    if (!loan) {
      // Nessun prestito attivo — risposta vuota (null), non un errore
      return NextResponse.json(null);
    }

    const STATUS_LABELS = ["requested", "funded", "repaid", "cancelled"] as const;
    const principal = Number(loan.principal);
    const totalDue = loan.totalDue ? Number(loan.totalDue) : null;

    return NextResponse.json({
      loan_request_id: loan.id,
      status: loan.status,
      status_label: STATUS_LABELS[loan.status] ?? "unknown",
      on_chain_loan_id: loan.onChainId ?? null,
      pool_on_chain_id: loan.pool.onChainId,
      pool_name: loan.pool.name,
      pool_id: loan.poolId,
      principal,
      total_due: totalDue,
      term_years: loan.termYears ?? 1,
      vc_hash: loan.vcHash ?? null,
      interest_rate_bps: loan.pool.interestRateBps,
      requested_at: loan.requestedAt.toISOString(),
      funded_at: loan.fundedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[GET /api/loan/borrower]", err);
    return NextResponse.json({ error: "Failed to fetch borrower loan" }, { status: 500 });
  }
}
