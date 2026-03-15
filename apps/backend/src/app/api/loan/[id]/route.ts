/**
 * GET /api/loan/[id]
 *
 * Restituisce i dettagli di una loan request, inclusi:
 *  - status (0=requested, 1=funded, 2=repaid)
 *  - on_chain_loan_id (LoanPosition object ID su IOTA, se disponibile)
 *  - pool on_chain_id (per la TX di repay)
 *  - total_due, outstanding_balance (calcolato)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const loan = await prisma.loanRequest.findUnique({
      where: { id: params.id },
      include: { pool: true },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const principal = Number(loan.principal);
    const totalDue = loan.totalDue ? Number(loan.totalDue) : null;

    const STATUS_LABELS = ["requested", "funded", "repaid", "cancelled"] as const;

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
      tx_hash: loan.txHash ?? null,
      requested_at: loan.requestedAt.toISOString(),
      funded_at: loan.fundedAt?.toISOString() ?? null,
      repaid_at: loan.repaidAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[GET /api/loan/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch loan" }, { status: 500 });
  }
}
