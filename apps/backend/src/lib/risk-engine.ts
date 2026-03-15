// Mock risk engine that simulates real financial data analysis

export interface RiskMetrics {
  revenueStability: number;
  paymentReliability: number;
  financialCushion: number;
  leverageExposure: number;
  operatingHistory: number;
  riskContext: number;
}

export interface ScoreResult {
  score: number;
  riskBand: "A" | "B" | "C" | "D";
  metrics: RiskMetrics;
  compositeBreakdown: Record<string, number>;
}

// Weights for each metric (must sum to 1)
const METRIC_WEIGHTS = {
  revenueStability: 0.25,
  paymentReliability: 0.25,
  financialCushion: 0.15,
  leverageExposure: 0.15,
  operatingHistory: 0.1,
  riskContext: 0.1,
};

function deterministicScore(did: string): number {
  // Generate a consistent score from DID hash
  let hash = 0;
  for (let i = 0; i < did.length; i++) {
    hash = (hash << 5) - hash + did.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 35) + 50; // 50-84 range
}

export function calculateRiskScore(borrowerDid: string): ScoreResult {
  const base = deterministicScore(borrowerDid);

  const metrics: RiskMetrics = {
    revenueStability: Math.min(100, base + Math.floor(Math.sin(base) * 10 + 5)),
    paymentReliability: Math.min(100, base + Math.floor(Math.cos(base) * 8 + 7)),
    financialCushion: Math.min(100, base - Math.floor(Math.sin(base * 2) * 5 + 3)),
    leverageExposure: Math.min(100, base - Math.floor(Math.cos(base * 1.5) * 12 + 2)),
    operatingHistory: Math.min(100, base + Math.floor(Math.sin(base * 0.7) * 15 + 8)),
    riskContext: Math.min(100, base + Math.floor(Math.cos(base * 0.5) * 6 + 4)),
  };

  // Clamp all values 1-100
  for (const key of Object.keys(metrics) as (keyof RiskMetrics)[]) {
    metrics[key] = Math.max(1, Math.min(100, metrics[key]));
  }

  const compositeBreakdown: Record<string, number> = {};
  let score = 0;
  for (const [key, weight] of Object.entries(METRIC_WEIGHTS)) {
    const contribution = metrics[key as keyof RiskMetrics] * weight;
    compositeBreakdown[key] = Math.round(contribution * 10) / 10;
    score += contribution;
  }

  score = Math.round(score);

  const riskBand: "A" | "B" | "C" | "D" =
    score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";

  return { score, riskBand, metrics, compositeBreakdown };
}
