const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "API error");
  }

  return res.json();
}

export const api = {
  score: (borrowerDid: string) =>
    apiFetch<{
      score: number;
      risk_band: string;
      metrics: Record<string, number>;
      composite_breakdown: Record<string, number>;
    }>("/api/score", {
      method: "POST",
      body: JSON.stringify({ borrower_did: borrowerDid }),
    }),

  issueVC: (borrowerDid: string) =>
    apiFetch<{
      vc: object;
      vc_hash: string;
      anchored_tx: string | null;
    }>("/api/issue-vc", {
      method: "POST",
      body: JSON.stringify({ borrower_did: borrowerDid }),
    }),

  eligiblePools: (score: number, riskBand: string) =>
    apiFetch<
      Array<{
        pool_id: string;
        on_chain_id: string;
        name: string;
        description: string;
        interest_rate_bps: number;
        apr_percent: string;
        available_liquidity: string;
        total_liquidity: string;
        min_score: number;
        risk_band: string;
      }>
    >(`/api/pools/eligible?score=${score}&risk_band=${riskBand}`),

  allPools: () =>
    apiFetch<
      Array<{
        pool_id: string;
        name: string;
        description: string;
        interest_rate_bps: number;
        apr_percent: string;
        available_liquidity: string;
        total_liquidity: string;
        min_score: number;
        risk_band: string;
        on_chain_id: string;
      }>
    >("/api/pools"),

  requestLoan: (data: {
    borrower_did: string;
    borrower_address: string;
    pool_id: string;
    principal: number;
    term_years?: number;
  }) =>
    apiFetch<{
      loan_request_id: string;
      tx_payload: object;
      message: string;
    }>("/api/loan/request", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  poolLoans: (poolId: string) =>
    apiFetch<
      Array<{
        loan_id: string;
        borrower_did: string;
        borrower_address: string;
        principal: string;
        status: number;
        requested_at: string;
        score: number | null;
        risk_band: string | null;
        vc_hash: string | null;
        vc_metadata: object | null;
      }>
    >(`/api/pool/${poolId}/loans`),

  fundLoan: (data: {
    loan_request_id: string;
    lender_did: string;
    lender_address: string;
  }) =>
    apiFetch<{
      loan_id: string;
      total_due: string;
      tx_payload: object;
      message: string;
    }>("/api/loan/fund", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  repayLoan: (data: {
    loan_request_id: string;
    amount: number;
    on_chain_loan_id?: string;
  }) =>
    apiFetch<{
      loan_id: string;
      amount_repaid: number;
      remaining_balance: string;
      fully_repaid: boolean;
    }>("/api/loan/repay", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Cancella una loan request (status → 3) */
  cancelLoan: (loanRequestId: string) =>
    apiFetch<{ success: boolean; loan_request_id: string }>(
      "/api/loan/cancel",
      { method: "POST", body: JSON.stringify({ loan_request_id: loanRequestId }) }
    ),

  /** Recupera i dettagli di una loan request (status, on_chain_id, ecc.) */
  getLoan: (loanRequestId: string) =>
    apiFetch<{
      loan_request_id: string;
      status: number;
      status_label: "requested" | "funded" | "repaid" | "cancelled";
      on_chain_loan_id: string | null;
      pool_on_chain_id: string;
      pool_name: string;
      principal: number;
      total_due: number | null;
      interest_rate_bps: number;
      tx_hash: string | null;
      requested_at: string;
      funded_at: string | null;
      repaid_at: string | null;
    }>(`/api/loan/${loanRequestId}`),

  /** Recupera l'eventuale prestito attivo (status 0 o 1) per un borrower address */
  getBorrowerActiveLoan: (address: string) =>
    apiFetch<{
      loan_request_id: string;
      status: number;
      status_label: "requested" | "funded" | "repaid";
      on_chain_loan_id: string | null;
      pool_on_chain_id: string;
      pool_name: string;
      pool_id: string;
      principal: number;
      total_due: number | null;
      term_years: number;
      vc_hash: string | null;
      tx_hash: string | null;
      interest_rate_bps: number;
      requested_at: string;
      funded_at: string | null;
    } | null>(`/api/loan/borrower?address=${encodeURIComponent(address)}`),

  /** Salva il LoanPosition on-chain object ID dopo che request_loan TX è confermata */
  saveLoanOnChainId: (data: {
    loan_request_id: string;
    on_chain_loan_id: string;
    tx_digest?: string;
  }) =>
    apiFetch<{ success: boolean; loan_request_id: string; on_chain_loan_id: string }>(
      "/api/loan/onchain",
      { method: "PATCH", body: JSON.stringify(data) }
    ),
};
