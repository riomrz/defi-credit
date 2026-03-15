"use client";
import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n";
import {
  Coins,
  TrendingUp,
  Shield,
  Info,
  Loader2,
  AlertCircle,
  Wallet,
  ExternalLink,
} from "lucide-react";
import {
  useCurrentAccount,
  useIotaClient,
  useIotaClientQuery,
  useSignAndExecuteTransaction,
} from "@iota/dapp-kit";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { formatAmount } from "@/lib/utils";
import { nanosToIota, iotaToNanos } from "@/lib/iota-wallet";
import { buildRequestLoanTx, contractsDeployed } from "@/lib/iota-tx";
import type { WalletInfo } from "@/components/borrower/BorrowerFlow";

interface Pool {
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
}

const TERM_OPTIONS = [
  { years: 1, key: "market.term1y" },
  { years: 5, key: "market.term5y" },
  { years: 10, key: "market.term10y" },
] as const;

interface Props {
  score: number;
  riskBand: string;
  vcHash: string | null;
  wallet: WalletInfo;
  onLoanRequested: (
    poolId: string,
    poolOnChainId: string,
    poolName: string,
    loanRequestId: string,
    amount: number,
    termYears: number
  ) => void;
}

export default function MarketplaceStep({
  score,
  riskBand,
  vcHash,
  wallet,
  onLoanRequested,
}: Props) {
  const { t } = useT();
  const account = useCurrentAccount();
  const client = useIotaClient();
  const { data: balanceData, isLoading: balanceLoading } = useIotaClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: Boolean(account?.address) }
  );
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [loanAmount, setLoanAmount] = useState(10);
  const [loanTerm, setLoanTerm] = useState<1 | 5 | 10>(1);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Real balance in IOTA (parsed from nanos)
  const balanceNano = balanceData ? BigInt(balanceData.totalBalance) : BigInt(0);
  const balanceIota = balanceLoading
    ? null
    : Number(balanceNano) / 1_000_000_000;

  useEffect(() => {
    api
      .eligiblePools(score, riskBand)
      .then(setPools)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [score, riskBand]);

  // Max loan is capped by pool's available liquidity (not wallet balance)
  const maxLoan = selectedPool
    ? Number(selectedPool.available_liquidity) / 100
    : undefined;


  const handleApply = async () => {
    if (!selectedPool) return;
    setError(null);
    setSubmitting(true);
    try {
      // 1. Register loan request off-chain (get loan_request_id)
      const result = await api.requestLoan({
        borrower_did: wallet.did,
        borrower_address: wallet.address,
        pool_id: selectedPool.pool_id,
        principal: loanAmount,
        term_years: loanTerm,
      });

      // 2. Try to sign real on-chain tx (only if contracts deployed)
      if (contractsDeployed() && selectedPool.on_chain_id) {
        const tx = buildRequestLoanTx(
          selectedPool.on_chain_id,
          iotaToNanos(loanAmount),
          vcHash ?? ""
        );
        const execResult = await signAndExecute({ transaction: tx as any });
        const digest = execResult.digest;
        setTxHash(digest);

        // Recupera l'object ID del LoanPosition NFT creato dalla TX
        // e lo salva nel backend affinché il lender possa usarlo in fund_loan
        try {
          const txBlock = await client.getTransactionBlock({
            digest,
            options: { showObjectChanges: true },
          });
          const loanPositionObj = txBlock.objectChanges?.find(
            (c) =>
              c.type === "created" &&
              "objectType" in c &&
              typeof c.objectType === "string" &&
              c.objectType.includes("::loan::LoanPosition")
          );
          if (loanPositionObj && "objectId" in loanPositionObj) {
            await api.saveLoanOnChainId({
              loan_request_id: result.loan_request_id,
              on_chain_loan_id: loanPositionObj.objectId,
              tx_digest: digest,
            });
          }
        } catch (indexErr) {
          // Non bloccante: il flusso off-chain continua normalmente
          console.warn("Could not index LoanPosition object ID:", indexErr);
        }
      }

      onLoanRequested(
        selectedPool.pool_id,
        selectedPool.on_chain_id ?? "",
        selectedPool.name,
        result.loan_request_id,
        loanAmount,
        loanTerm
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
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
        <h2 className="text-2xl font-bold text-dc mb-2">
          {t("market.title")}
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[#94A3B8]">{t("market.subtitle")}</p>
          <Badge variant={bandVariant[riskBand] ?? "gray"}>
            Score {score} · Band {riskBand}
          </Badge>
        </div>
      </div>

      {/* Balance banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1A2744] border border-[#2D3E5F] rounded-xl">
        <Wallet className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-sm text-[#94A3B8]">{t("market.balance")}:</span>
        {balanceLoading ? (
          <div className="h-4 w-24 bg-[#2D3E5F] rounded animate-pulse" />
        ) : (
          <span className="text-sm font-semibold text-dc">
            {nanosToIota(balanceData?.totalBalance ?? "0")} IOTA
          </span>
        )}
        {!contractsDeployed() && (
          <span className="ml-auto text-xs text-amber-400 flex items-center gap-1">
            <Info className="w-3 h-3" /> {t("market.simMode")}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          <span className="text-[#94A3B8]">{t("market.loadingPools")}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-900/20 border border-rose-600/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {!loading && pools.length === 0 && !error && (
        <Card>
          <CardBody className="text-center py-12">
            <Info className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
            <p className="text-dc font-medium">{t("market.noPools")}</p>
            <p className="text-sm text-[#94A3B8]">
              {t("market.noPoolsDesc")}
            </p>
          </CardBody>
        </Card>
      )}

      {/* Pool Grid */}
      {!loading && pools.length > 0 && (
        <div className="grid gap-4">
          {pools.map((pool) => (
            <button
              key={pool.pool_id}
              onClick={() =>
                setSelectedPool(
                  selectedPool?.pool_id === pool.pool_id ? null : pool
                )
              }
              className={`w-full text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden
              ${
                selectedPool?.pool_id === pool.pool_id
                  ? "border-indigo-500 shadow-lg shadow-indigo-900/30"
                  : "border-[#2D3E5F] hover:border-[#3D4E6F]"
              } bg-[#1A2744]`}
            >
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-900/40 border border-indigo-600/30 flex items-center justify-center">
                    <Coins className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-dc">{pool.name}</h3>
                      <Badge
                        variant={bandVariant[pool.risk_band] ?? "gray"}
                        className="text-xs"
                      >
                        Band {pool.risk_band}+
                      </Badge>
                    </div>
                    <p className="text-sm text-[#94A3B8]">{pool.description}</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-2xl font-bold text-indigo-400">
                    {pool.apr_percent}%
                  </p>
                  <p className="text-xs text-[#94A3B8]">APR</p>
                </div>
              </div>
              <div className="px-5 pb-5 grid grid-cols-3 gap-3">
                <div className="bg-[#243154] rounded-xl p-3">
                  <p className="text-xs text-[#94A3B8] mb-1">{t("market.available")}</p>
                  <p className="text-sm font-semibold text-dc">
                    {formatAmount(Number(pool.available_liquidity) / 100)} IOTA
                  </p>
                </div>
                <div className="bg-[#243154] rounded-xl p-3">
                  <p className="text-xs text-[#94A3B8] mb-1">{t("market.minScore")}</p>
                  <p className="text-sm font-semibold text-emerald-400">
                    {pool.min_score}
                  </p>
                </div>
                <div className="bg-[#243154] rounded-xl p-3">
                  <p className="text-xs text-[#94A3B8] mb-1">{t("market.interest")}</p>
                  <p className="text-sm font-semibold text-dc">
                    {(pool.interest_rate_bps / 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Loan Request Form */}
      {selectedPool && (
        <Card glow className="animate-slide-up">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-dc">
                {t("market.loanRequest")} — {selectedPool.name}
              </h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            {/* Loan Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-[#94A3B8]">
                  {t("market.loanAmount")}
                </label>
                <span className="text-xs text-[#64748B]">
                  {t("market.maxLabel")}:{" "}
                  <button
                    className="text-indigo-400 hover:text-indigo-300 transition-colors"
                    onClick={() =>
                      maxLoan !== undefined && setLoanAmount(Math.floor(maxLoan))
                    }
                  >
                    {maxLoan !== undefined
                      ? Math.floor(maxLoan).toLocaleString()
                      : "..."}{" "}
                    IOTA
                  </button>
                </span>
              </div>
              <input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                min={1}
                max={maxLoan}
                step={1}
                className="w-full bg-[#243154] border border-[#2D3E5F] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Repayment Term */}
            <div>
              <label className="text-sm text-[#94A3B8] block mb-2">
                {t("market.term")}
              </label>
              <div className="flex gap-2">
                {TERM_OPTIONS.map(({ years, key }) => (
                  <button
                    key={years}
                    type="button"
                    onClick={() => setLoanTerm(years as 1 | 5 | 10)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-150
                      ${
                        loanTerm === years
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30"
                          : "bg-[#243154] border-[#2D3E5F] text-[#94A3B8] hover:border-indigo-500/50 hover:text-indigo-300"
                      }`}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>

            {/* Loan Summary */}
            <div className="p-4 bg-[#243154] rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#94A3B8]">{t("market.principal")}</span>
                <span className="text-dc">
                  {loanAmount.toLocaleString()} IOTA
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#94A3B8]">
                  {t("market.interest")} ({selectedPool.apr_percent}% × {loanTerm}y)
                </span>
                <span className="text-amber-400">
                  +{(loanAmount * ((selectedPool.interest_rate_bps / 10000) * loanTerm)).toFixed(4)} IOTA
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#94A3B8]">{t("market.term")}</span>
                <span className="text-dc">
                  {t(`market.term${loanTerm}y` as
                    | "market.term1y"
                    | "market.term5y"
                    | "market.term10y")}
                </span>
              </div>
              <div className="border-t border-[#2D3E5F] pt-2 flex justify-between text-sm font-semibold">
                <span className="text-[#94A3B8]">{t("market.totalDue")}</span>
                <span className="text-dc">
                  {(
                    loanAmount +
                    loanAmount * ((selectedPool.interest_rate_bps / 10000) * loanTerm)
                  ).toFixed(4)}{" "}
                  IOTA
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-indigo-900/20 border border-indigo-600/20 rounded-xl">
              <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-xs text-[#94A3B8]">
                {t("market.vcInfo")}
                {!contractsDeployed() && (
                  <span className="block mt-1 text-amber-400">
                    ⚠ {t("market.contractsInfo")}
                  </span>
                )}
              </p>
            </div>

            {txHash && (
              <div className="flex items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-xl">
                <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-400">
                  Tx submitted:{" "}
                  <a
                    href={`https://explorer.iota.org/testnet/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-emerald-300"
                  >
                    {txHash.slice(0, 20)}…
                  </a>
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-900/20 border border-rose-600/30 rounded-xl">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <p className="text-xs text-rose-400">{error}</p>
              </div>
            )}

            <Button
              onClick={handleApply}
              loading={submitting}
              disabled={
                submitting ||
                (maxLoan !== undefined && loanAmount > maxLoan)
              }
              className="w-full"
              size="lg"
            >
              {submitting ? t("market.signing") : t("market.submitBtn")}
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
