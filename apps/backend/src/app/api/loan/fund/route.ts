import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildFundLoanTx } from "@/lib/iota-move";

const schema = z.object({
  loan_request_id: z.string().min(1),
  lender_did: z.string().min(1),
  lender_address: z.string().min(1),
  on_chain_loan_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loan_request_id, lender_did, lender_address, on_chain_loan_id } =
      schema.parse(body);

    const loan = await prisma.loanRequest.findUnique({
      where: { id: loan_request_id },
      include: { pool: true },
    });
    if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    if (loan.status !== 0)
      return NextResponse.json({ error: "Loan not in requested state" }, { status: 400 });

    // Ensure lender exists
    await prisma.lender.upsert({
      where: { did: lender_did },
      update: { address: lender_address },
      create: { did: lender_did, address: lender_address },
    });

    const interestRateBps = BigInt(loan.pool.interestRateBps);
    const principal = loan.principal;
    const totalDue = principal + (principal * interestRateBps) / BigInt(10000);

    // Build tx payload for fund_loan
    const objectId = on_chain_loan_id ?? loan.onChainId ?? loan_request_id;
    const txPayload = buildFundLoanTx(objectId);

    // Update loan status to funded (optimistic — wait for tx confirmation in production)
    await prisma.loanRequest.update({
      where: { id: loan_request_id },
      data: {
        status: 1,
        totalDue,
        fundedAt: new Date(),
        onChainId: on_chain_loan_id ?? loan.onChainId,
      },
    });

    // Reduce pool liquidity
    await prisma.pool.update({
      where: { id: loan.poolId },
      data: { availableLiquidity: { decrement: principal } },
    });

    return NextResponse.json({
      loan_id: loan_request_id,
      total_due: totalDue.toString(),
      tx_payload: txPayload,
      message: "Sign and submit tx_payload with your IOTA wallet to fund_loan on-chain",
    });
  } catch (err) {
    console.error("[POST /api/loan/fund]", err);
    return NextResponse.json({ error: "Failed to fund loan" }, { status: 500 });
  }
}
