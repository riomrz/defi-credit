/**
 * POST /api/loan/cancel
 * Body: { loan_request_id: string }
 *
 * Cancella una loan request in stato "requested" (0).
 * Status → 3 (cancelled) — escluso dalla resume detection.
 * Ripristina la liquidità del pool.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  loan_request_id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { loan_request_id } = schema.parse(await req.json());

    const loan = await prisma.loanRequest.findUnique({
      where: { id: loan_request_id },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Solo "requested" o "funded" possono essere cancellati
    if (loan.status > 2) {
      return NextResponse.json({ error: "Loan already cancelled or completed" }, { status: 400 });
    }

    if (loan.status === 2) {
      return NextResponse.json({ error: "Cannot cancel a repaid loan" }, { status: 400 });
    }

    // Aggiorna a status=3 (cancelled)
    await prisma.loanRequest.update({
      where: { id: loan_request_id },
      data: { status: 3 },
    });

    // Se era in status=1 (funded), ripristina liquidità del pool
    if (loan.status === 1) {
      await prisma.pool.update({
        where: { id: loan.poolId },
        data: { availableLiquidity: { increment: loan.principal } },
      });
    }

    return NextResponse.json({ success: true, loan_request_id, status: 3 });
  } catch (err) {
    console.error("[POST /api/loan/cancel]", err);
    return NextResponse.json({ error: "Failed to cancel loan" }, { status: 500 });
  }
}
