import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildRequestLoanTx } from "@/lib/iota-move";

const schema = z.object({
  borrower_did: z.string().min(1),
  borrower_address: z.string().min(1),
  pool_id: z.string().min(1),
  principal: z.number().positive(),
  term_years: z.number().int().positive().optional().default(1),
  vc_hash: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { borrower_did, borrower_address, pool_id, principal, term_years, vc_hash } =
      schema.parse(body);

    const pool = await prisma.pool.findUnique({ where: { id: pool_id } });
    if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });

    if (BigInt(principal) > pool.availableLiquidity) {
      return NextResponse.json({ error: "Insufficient pool liquidity" }, { status: 400 });
    }

    // Ensure borrower exists
    await prisma.borrower.upsert({
      where: { did: borrower_did },
      update: { address: borrower_address },
      create: { did: borrower_did, address: borrower_address },
    });

    // Create off-chain loan request record
    const loanReq = await prisma.loanRequest.create({
      data: {
        borrowerDid: borrower_did,
        borrowerAddr: borrower_address,
        poolId: pool_id,
        principal: BigInt(principal),
        termYears: term_years,
        vcHash: vc_hash ?? null,
        status: 0,
      },
    });

    // Build unsigned tx payload for on-chain request_loan
    const txPayload = buildRequestLoanTx(pool.onChainId, BigInt(principal));

    return NextResponse.json({
      loan_request_id: loanReq.id,
      tx_payload: txPayload,
      message: "Sign and submit the tx_payload with your IOTA wallet to request_loan on-chain",
    });
  } catch (err) {
    console.error("[POST /api/loan/request]", err);
    return NextResponse.json({ error: "Failed to create loan request" }, { status: 500 });
  }
}
