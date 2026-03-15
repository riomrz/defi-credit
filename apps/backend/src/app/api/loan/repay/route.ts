import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildRepayLoanTx } from "@/lib/iota-move";

const schema = z.object({
  loan_request_id: z.string().min(1),
  amount: z.number().positive(),
  on_chain_loan_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loan_request_id, amount, on_chain_loan_id } = schema.parse(body);

    const loan = await prisma.loanRequest.findUnique({
      where: { id: loan_request_id },
      include: { pool: true },
    });
    if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    if (loan.status !== 1)
      return NextResponse.json({ error: "Loan not in funded state" }, { status: 400 });

    const amountBig = BigInt(amount);
    const objectId = on_chain_loan_id ?? loan.onChainId ?? loan_request_id;
    const txPayload = buildRepayLoanTx(objectId, amountBig);

    const totalDue = loan.totalDue ?? loan.principal;
    const newBalance = totalDue - amountBig;
    const fullyRepaid = newBalance <= BigInt(0);

    await prisma.loanRequest.update({
      where: { id: loan_request_id },
      data: {
        status: fullyRepaid ? 2 : 1,
        repaidAt: fullyRepaid ? new Date() : null,
      },
    });

    if (fullyRepaid) {
      await prisma.pool.update({
        where: { id: loan.poolId },
        data: { availableLiquidity: { increment: totalDue } },
      });
    }

    return NextResponse.json({
      loan_id: loan_request_id,
      amount_repaid: amount,
      remaining_balance: newBalance > BigInt(0) ? newBalance.toString() : "0",
      fully_repaid: fullyRepaid,
      tx_payload: txPayload,
    });
  } catch (err) {
    console.error("[POST /api/loan/repay]", err);
    return NextResponse.json({ error: "Failed to repay loan" }, { status: 500 });
  }
}
