// ===== DID & Identity =====
export interface DIDDocument {
  id: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod: string[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyJwk?: Record<string, unknown>;
}

// ===== Verifiable Credentials =====
export interface RiskAttestationVC {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: RiskAttestationSubject;
  proof?: VCProof;
}

export interface RiskAttestationSubject {
  id: string; // borrower DID
  riskScore: number;
  riskBand: RiskBand;
  metrics: RiskMetrics;
  consentHash: string;
}

export interface VCProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofValue: string;
}

// ===== Risk =====
export type RiskBand = "A" | "B" | "C" | "D";

export interface RiskMetrics {
  revenueStability: number;
  paymentReliability: number;
  financialCushion: number;
  leverageExposure: number;
  operatingHistory: number;
  riskContext: number;
}

// ===== Pools =====
export interface Pool {
  pool_id: string;
  on_chain_id: string;
  name: string;
  description: string;
  interest_rate_bps: number;
  apr_percent: string;
  available_liquidity: string;
  total_liquidity: string;
  min_score: number;
  risk_band: RiskBand;
}

// ===== Loans =====
export type LoanStatus = 0 | 1 | 2; // requested | funded | repaid

export interface LoanRequest {
  loan_id: string;
  on_chain_id: string | null;
  borrower_did: string;
  borrower_address: string;
  principal: string;
  status: LoanStatus;
  requested_at: string;
  score: number | null;
  risk_band: RiskBand | null;
  vc_hash: string | null;
  vc_issued_at: string | null;
  vc_metadata: VCMetadata | null;
}

export interface VCMetadata {
  id: string;
  type: string[];
  issuer: string;
  issuance_date: string;
  expiration_date: string;
}

// ===== Move TX Payloads =====
export interface TxPayload {
  packageId: string;
  module: string;
  function: string;
  typeArguments: string[];
  arguments: (string | number)[];
  description: string;
}

// ===== API Request/Response types =====
export interface ScoreRequest {
  borrower_did: string;
}

export interface ScoreResponse {
  score: number;
  risk_band: RiskBand;
  metrics: RiskMetrics;
  composite_breakdown: Record<string, number>;
}

export interface IssueVCRequest {
  borrower_did: string;
}

export interface IssueVCResponse {
  vc: RiskAttestationVC;
  vc_hash: string;
  anchored_tx: string | null;
}

export interface LoanRequestPayload {
  borrower_did: string;
  borrower_address: string;
  pool_id: string;
  principal: number;
}

export interface LoanRequestResponse {
  loan_request_id: string;
  tx_payload: TxPayload;
  message: string;
}

export interface FundLoanPayload {
  loan_request_id: string;
  lender_did: string;
  lender_address: string;
  on_chain_loan_id?: string;
}

export interface FundLoanResponse {
  loan_id: string;
  total_due: string;
  tx_payload: TxPayload;
  message: string;
}

// ===== Move on-chain structs (mirrors Move code) =====
export interface OnChainPool {
  id: string;
  liquidity: bigint;
  interest_rate_bps: bigint;
}

export interface OnChainLoanPosition {
  id: string;
  pool_id: string;
  borrower: string;
  principal: bigint;
  interest_rate_bps: bigint;
  total_due: bigint;
  outstanding_balance: bigint;
  status: LoanStatus;
}

export interface OnChainLPPosition {
  id: string;
  pool_id: string;
  lender: string;
  deposited_amount: bigint;
  share_bps: bigint;
}
