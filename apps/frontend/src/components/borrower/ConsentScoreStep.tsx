"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Shield,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { getMetricBarColor } from "@/lib/utils";
import type { WalletInfo } from "@/components/borrower/BorrowerFlow";

interface Props {
  wallet: WalletInfo;
  onScored: (
    score: number,
    riskBand: string,
    metrics: Record<string, number>,
    vcHash: string
  ) => void;
}

const METRIC_LABELS: Record<string, string> = {
  revenueStability: "Revenue Stability",
  paymentReliability: "Payment Reliability",
  financialCushion: "Financial Cushion",
  leverageExposure: "Leverage & Exposure",
  operatingHistory: "Operating History",
  riskContext: "Risk Context",
};

type Phase = "consent" | "scoring" | "issuing" | "done" | "error";

export default function ConsentScoreStep({ wallet, onScored }: Props) {
  const { t } = useT();

  const DATA_SOURCES = [
    {
      key: "openBanking",
      label: t("score.openBanking"),
      desc: t("score.openBankingDesc"),
    },
    {
      key: "taxData",
      label: t("score.taxData"),
      desc: t("score.taxDataDesc"),
    },
    {
      key: "creditHistory",
      label: t("score.creditHistory"),
      desc: t("score.creditHistoryDesc"),
    },
    {
      key: "socialReputation",
      label: t("score.socialReputation"),
      desc: t("score.socialReputationDesc"),
    },
    {
      key: "invoiceData",
      label: t("score.invoiceData"),
      desc: t("score.invoiceDataDesc"),
    },
    {
      key: "platformActivity",
      label: t("score.platformActivity"),
      desc: t("score.platformActivityDesc"),
    },
  ];

  const [consents, setConsents] = useState<Record<string, boolean>>({
    openBanking: false,
    taxData: false,
    creditHistory: false,
    socialReputation: false,
    invoiceData: false,
    platformActivity: false,
  });
  const [phase, setPhase] = useState<Phase>("consent");
  const [scoreData, setScoreData] = useState<{
    score: number;
    risk_band: string;
    metrics: Record<string, number>;
  } | null>(null);
  const [vcHash, setVcHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allConsented = Object.values(consents).every(Boolean);

  const handleCalculate = async () => {
    setError(null);
    setPhase("scoring");
    try {
      const scoreResult = await api.score(wallet.did);
      setScoreData({
        score: scoreResult.score,
        risk_band: scoreResult.risk_band,
        metrics: scoreResult.metrics,
      });
      setPhase("issuing");
      const vcResult = await api.issueVC(wallet.did);
      setVcHash(vcResult.vc_hash);
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  };

  const bandVariant: Record<string, "emerald" | "sky" | "amber" | "rose"> = {
    A: "emerald",
    B: "sky",
    C: "amber",
    D: "rose",
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dc mb-2">{t("score.title")}</h2>
        <p className="text-[#94A3B8]">
          {t("score.subtitle")}
        </p>
      </div>

      {/* Consent */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-dc">{t("score.datasources")}</h3>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {DATA_SOURCES.map(({ key, label, desc }) => (
            <label
              key={key}
              className="flex items-start gap-4 p-4 rounded-xl bg-[#243154] hover:bg-[#2D3E5F] cursor-pointer transition-colors"
            >
              <div className="mt-0.5">
                {consents[key] ? (
                  <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Circle className="w-5 h-5 text-[#94A3B8]" />
                )}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={consents[key]}
                onChange={() =>
                  setConsents((c) => ({ ...c, [key]: !c[key] }))
                }
                disabled={phase !== "consent" && phase !== "error"}
              />
              <div>
                <p className="text-sm font-medium text-dc">{label}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
        </CardBody>
      </Card>

      {/* Calculate */}
      {(phase === "consent" || phase === "error") && (
        <Button
          onClick={handleCalculate}
          disabled={!allConsented}
          className="w-full"
          size="lg"
        >
          <TrendingUp className="w-5 h-5" />
          {t("score.generateBtn")}
        </Button>
      )}

      {/* Progress indicators */}
      {(phase === "scoring" || phase === "issuing") && (
        <Card>
          <CardBody>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <div>
                  <p className="text-sm font-medium text-dc">
                    {phase === "scoring"
                      ? t("score.generating")
                      : t("score.issuingVC")}
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    {phase === "scoring"
                      ? t("score.subtitle")
                      : t("score.vcInfo")}
                  </p>
                </div>
              </div>
              <div className="h-1.5 bg-[#2D3E5F] rounded-full overflow-hidden">
                <div
                  className={`h-full bg-indigo-500 rounded-full transition-all duration-1000 ${phase === "issuing" ? "w-4/5" : "w-2/5"} animate-shimmer`}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Error */}
      {phase === "error" && error && (
        <div className="flex items-start gap-3 p-4 bg-rose-900/20 border border-rose-600/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-rose-400">Error</p>
            <p className="text-xs text-[#94A3B8]">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {phase === "done" && scoreData && (
        <div className="animate-slide-up space-y-4">
          {/* Score Card */}
          <Card glow>
            <CardBody>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-[#94A3B8] mb-1">
                    {t("score.yourScore")}
                  </p>
                  <p
                    className={`text-5xl font-bold ${
                      scoreData.score >= 80
                        ? "text-emerald-400"
                        : scoreData.score >= 65
                        ? "text-sky-400"
                        : scoreData.score >= 50
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {scoreData.score}
                    <span className="text-2xl text-[#94A3B8]">/100</span>
                  </p>
                </div>
                <Badge
                  variant={
                    bandVariant[scoreData.risk_band] ?? "gray"
                  }
                  className="text-base px-4 py-2"
                >
                  Band {scoreData.risk_band}
                </Badge>
              </div>

              <div className="space-y-3">
                {Object.entries(scoreData.metrics).map(([key, value]) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-[#94A3B8]">
                        {METRIC_LABELS[key] ?? key}
                      </span>
                      <span className="text-xs font-medium text-dc">
                        {Math.round(value)}/100
                      </span>
                    </div>
                    <div className="h-2 bg-[#243154] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getMetricBarColor(value)} rounded-full progress-fill`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* VC Issued */}
          {vcHash && (
            <div className="flex items-start gap-3 p-4 bg-emerald-900/20 border border-emerald-600/30 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-400">
                  {t("score.vcIssued")}
                </p>
                <p className="text-xs font-mono text-[#94A3B8] mt-1 break-all">
                  {t("score.vcHash")}: {vcHash}
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={() =>
              onScored(
                scoreData.score,
                scoreData.risk_band,
                scoreData.metrics,
                vcHash!
              )
            }
            className="w-full"
            size="lg"
          >
            {t("score.continueMarketplace")}
          </Button>
        </div>
      )}
    </div>
  );
}
