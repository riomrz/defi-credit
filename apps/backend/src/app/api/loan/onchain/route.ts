/**
 * PATCH /api/loan/onchain
 *
 * Salva l'on-chain object ID del LoanPosition NFT creato da request_loan.
 * Il frontend chiama questo endpoint subito dopo che la TX è confermata,
 * passando il digest della TX e l'object ID del LoanPosition creato.
 * Il lender usa poi questo ID per chiamare fund_loan on-chain.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  loan_request_id: z.string().min(1),
  on_chain_loan_id: z.string().min(1),  // LoanPosition object ID
  tx_digest: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { loan_request_id, on_chain_loan_id, tx_digest } = schema.parse(body);

    const loan = await prisma.loanRequest.findUnique({
      where: { id: loan_request_id },
    });
    if (!loan) {
      return NextResponse.json({ error: "Loan request not found" }, { status: 404 });
    }

    await prisma.loanRequest.update({
      where: { id: loan_request_id },
      data: {
        onChainId: on_chain_loan_id,
        ...(tx_digest ? { txHash: tx_digest } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      loan_request_id,
      on_chain_loan_id,
    });
  } catch (err) {
    console.error("[PATCH /api/loan/onchain]", err);
    return NextResponse.json({ error: "Failed to save on-chain ID" }, { status: 500 });
  }
}
