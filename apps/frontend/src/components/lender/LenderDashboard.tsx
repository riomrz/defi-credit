"use client";
import { useState, useEffect } from "react";
import {
  Coins, CheckCircle2, XCircle, Loader2, Shield, AlertCircle,
  ChevronDown, ChevronUp, Award, Wallet, PlusCircle, ExternalLink, Info,
  RefreshCw,
} from "lucide-react";
import {
  useCurrentAccount, useIotaClient, useIotaClientQuery, useSignAndExecuteTransaction,
} from "@iota/dapp-kit";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { formatAmount, shortenHash } from "@/lib/utils";
import { nanosToIota, iotaToNanos } from "@/lib/iota-wallet";
import { buildDepositLiquidityTx, buildApproveLoanTx, buildWithdrawLiquidityTx, contractsDeployed, getPackageId } from "@/lib/iota-tx";
import type { WalletInfo } from "@/components/borrower/BorrowerFlow";
import { useT } from "@/lib/i18n";

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

interface LoanItem {
  loan_id: string;
  borrower_did: string;
  borrower_address: string;
  principal: string;
  status: number;
  requested_at: string;
  score: number | null;
  risk_band: string | null;
  vc_hash: string | null;
  on_chain_id?: string | null;
  vc_metadata: {
    id?: string;
    type?: string[];
    issuer?: string;
    issuance_date?: string;
    expiration_date?: string;
    [key: string]: unknown;
  } | null;
}

interface Props {
  wallet: WalletInfo;
}

const bandVariant: Record<string, "emerald" | "sky" | "amber" | "rose"> = {
  A: "emerald", B: "sky", C: "amber", D: "rose",
};

/** Legge Balance<IOTA> dai fields Move: può essere number, string, o { value: string } */
function parsePoolLiquidityNanos(fields: Record<string, unknown>): number {
  const raw = fields.liquidity;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw);
  if (raw && typeof raw === "object" && "value" in (raw as object)) {
    return Number((raw as { value: unknown }).value);
  }
  return 0;
}

export default function LenderDashboard({ wallet }: Props) {
  const { t } = useT();
  const account = useCurrentAccount();
  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } =
    useIotaClientQuery(
      "getBalance",
      { owner: account?.address ?? "" },
      { enabled: Boolean(account?.address), refetchInterval: 10_000 }
    );
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const client = useIotaClient();

  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loadingPools, setLoadingPools] = useState(true);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [expandedVc, setExpandedVc] = useState<string | null>(null);
  const [actionState, setActionState] = useState<
    Record<string, "idle" | "loading" | "approved" | "rejected">
  >({});
  const [approveError, setApproveError] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [refreshingLoans, setRefreshingLoans] = useState(false);

  const [depositAmount, setDepositAmount] = useState(100);
  const [depositing, setDepositing] = useState(false);
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);

  // Withdraw liquidity
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawTxHash, setWithdrawTxHash] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [lpPositionId, setLpPositionId] = useState<string | null>(null);
  const [lpDepositedAmount, setLpDepositedAmount] = useState<number | null>(null);

  // On-chain pool balance (real, not from DB)
  const [onChainPoolBalance, setOnChainPoolBalance] = useState<number | null>(null);
  const [loadingPoolBalance, setLoadingPoolBalance] = useState(false);

  const balanceNano = balanceData ? BigInt(balanceData.totalBalance) : BigInt(0);
  const balanceIota = balanceLoading ? null : Number(balanceNano) / 1_000_000_000;

  useEffect(() => {
    api.allPools()
      .then((p) => { setPools(p); if (p.length > 0) selectPool(p[0]); })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingPools(false));
  }, []);

  const selectPool = (pool: Pool) => {
    setSelectedPool(pool);
    setLoadingLoans(true);
    setDepositTxHash(null);
    setDepositError(null);
    setShowDeposit(false);
    setOnChainPoolBalance(null);
    api.poolLoans(pool.pool_id)
      .then((data) => setLoans(data as LoanItem[]))
      .catch(() => setLoans([]))
      .finally(() => setLoadingLoans(false));
  };

  // Ricarica solo la lista prestiti senza cambiare pool selezionata
  const refreshLoans = async (pool?: Pool | null) => {
    const target = pool ?? selectedPool;
    if (!target) return;
    setRefreshingLoans(true);
    try {
      const data = await api.poolLoans(target.pool_id);
      setLoans(data as LoanItem[]);
    } catch {
      // silently fail — loans list stays as-is
    } finally {
      setRefreshingLoans(false);
    }
  };

  // Cerca la LPPosition del lender per la pool selezionata
  useEffect(() => {
    setLpPositionId(null);
    setLpDepositedAmount(null);
    setWithdrawTxHash(null);
    setWithdrawError(null);
    if (!selectedPool?.on_chain_id || !account?.address || !contractsDeployed()) return;

    const packageId = getPackageId();
    if (!packageId) return;

    client.getOwnedObjects({
      owner: account.address,
      filter: { StructType: `${packageId}::pool::LPPosition` },
      options: { showContent: true, showType: true },
    }).then((result) => {
      for (const item of result.data) {
        const content = item.data?.content;
        if (content?.dataType !== "moveObject") continue;
        const fields = content.fields as Record<string, unknown>;
        // Controlla che la LPPosition sia per questa pool
        const rawPoolId = fields.pool_id as { id?: string } | string;
        const fieldPoolId = typeof rawPoolId === "string" ? rawPoolId : rawPoolId?.id;
        if (!fieldPoolId) continue;
        if (fieldPoolId.toLowerCase() !== selectedPool.on_chain_id.toLowerCase()) continue;
        setLpPositionId(item.data!.objectId);
        const deposited = Number(fields.deposited_amount ?? 0);
        setLpDepositedAmount(deposited / 1_000_000_000); // nanos → IOTA
        break;
      }
    }).catch(() => {/* non bloccante */});
  }, [selectedPool?.on_chain_id, account?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch real on-chain pool balance
  useEffect(() => {
    setOnChainPoolBalance(null);
    if (!selectedPool?.on_chain_id || !contractsDeployed()) return;
    setLoadingPoolBalance(true);
    client.getObject({
      id: selectedPool.on_chain_id,
      options: { showContent: true },
    }).then((result) => {
      const content = result.data?.content;
      if (content?.dataType !== "moveObject") return;
      const fields = content.fields as Record<string, unknown>;
      setOnChainPoolBalance(parsePoolLiquidityNanos(fields) / 1_000_000_000);
    }).catch(() => {/* non bloccante */}).finally(() => setLoadingPoolBalance(false));
  }, [selectedPool?.on_chain_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWithdraw = async () => {
    if (!selectedPool?.on_chain_id || !lpPositionId) return;
    setWithdrawError(null);
    setWithdrawing(true);
    try {
      const tx = buildWithdrawLiquidityTx(selectedPool.on_chain_id, lpPositionId);
      const result = await signAndExecute({ transaction: tx as any });
      await client.waitForTransaction({ digest: result.digest });
      setWithdrawTxHash(result.digest);
      setLpPositionId(null);
      setLpDepositedAmount(null);
      await refetchBalance();
      // Aggiorna il saldo on-chain della pool dopo il ritiro
      setOnChainPoolBalance(null);
      setLoadingPoolBalance(true);
      client.getObject({ id: selectedPool.on_chain_id, options: { showContent: true } })
        .then((r) => {
          const f = (r.data?.content as { dataType: string; fields?: Record<string, unknown> } | undefined);
          if (f?.dataType !== "moveObject" || !f.fields) return;
          setOnChainPoolBalance(parsePoolLiquidityNanos(f.fields) / 1_000_000_000);
        }).finally(() => setLoadingPoolBalance(false));
    } catch (err) {
      setWithdrawError((err as Error).message ?? "Errore sconosciuto");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDeposit = async () => {
    if (!selectedPool) return;
    setDepositError(null);
    setDepositing(true);
    try {
      if (contractsDeployed() && selectedPool.on_chain_id) {
        const tx = buildDepositLiquidityTx(selectedPool.on_chain_id, iotaToNanos(depositAmount));
        const result = await signAndExecute({ transaction: tx as any });
        setDepositTxHash(result.digest);
        await client.waitForTransaction({ digest: result.digest });
        await refetchBalance();
        // Aggiorna il saldo on-chain della pool dopo il deposito
        setLoadingPoolBalance(true);
        client.getObject({ id: selectedPool.on_chain_id, options: { showContent: true } })
          .then((r) => {
            const f = (r.data?.content as { dataType: string; fields?: Record<string, unknown> } | undefined);
            if (f?.dataType !== "moveObject" || !f.fields) return;
            setOnChainPoolBalance(parsePoolLiquidityNanos(f.fields) / 1_000_000_000);
          }).finally(() => setLoadingPoolBalance(false));
      } else {
        await new Promise((r) => setTimeout(r, 1200));
        setDepositTxHash("simulation-" + Math.random().toString(16).slice(2, 12));
      }
    } catch (err) {
      setDepositError((err as Error).message);
    } finally {
      setDepositing(false);
    }
  };

  const handleApprove = async (loan: LoanItem) => {
    setActionState((s) => ({ ...s, [loan.loan_id]: "loading" }));
    setApproveError((e) => { const n = { ...e }; delete n[loan.loan_id]; return n; });
    try {
      // 1. Aggiorna il DB: status → 1 (funded)
      await api.fundLoan({
        loan_request_id: loan.loan_id,
        lender_did: wallet.did,
        lender_address: wallet.address,
      });

      // 2. Ri-fetch dei dati freschi del loan per ottenere l'on_chain_id aggiornato.
      //    Il borrower potrebbe aver salvato l'ID dopo che il lender ha caricato la pagina.
      let freshOnChainId = loan.on_chain_id ?? null;
      if (contractsDeployed()) {
        try {
          const fresh = await api.getLoan(loan.loan_id);
          freshOnChainId = fresh.on_chain_loan_id ?? freshOnChainId;
          console.log("[approve] on_chain_id dal DB (fresh):", freshOnChainId);
        } catch {
          console.warn("[approve] Impossibile ri-fetch loan, uso dati locali");
        }
      }

      // 3. Se i contratti sono deployed e abbiamo l'on-chain ID del LoanPosition,
      //    il lender firma approve_loan on-chain → crea LoanApproval per il borrower.
      if (contractsDeployed() && freshOnChainId && loan.borrower_address) {
        console.log("[approve] Invio approve_loan TX", {
          loanOnChainId: freshOnChainId,
          borrowerAddress: loan.borrower_address,
        });
        const tx = buildApproveLoanTx(freshOnChainId, loan.borrower_address);
        const execResult = await signAndExecute({ transaction: tx as any });
        console.log("[approve] TX inviata, digest:", execResult.digest);
        await client.waitForTransaction({ digest: execResult.digest });
        console.log("[approve] TX confermata ✓ — LoanApproval trasferita a", loan.borrower_address);
      } else if (contractsDeployed() && !freshOnChainId) {
        console.warn("[approve] on_chain_id ancora mancante dopo re-fetch — approve_loan TX saltata");
      }

      setActionState((s) => ({ ...s, [loan.loan_id]: "approved" }));
      await refetchBalance();
      await refreshLoans();
      // Refresh pool balance
      if (selectedPool?.on_chain_id && contractsDeployed()) {
        client.getObject({ id: selectedPool.on_chain_id, options: { showContent: true } })
          .then((r) => {
            const f = (r.data?.content as { dataType: string; fields?: Record<string, unknown> } | undefined);
            if (f?.dataType !== "moveObject" || !f.fields) return;
            setOnChainPoolBalance(parsePoolLiquidityNanos(f.fields) / 1_000_000_000);
          }).catch(() => {});
      }
    } catch (err) {
      setActionState((s) => ({ ...s, [loan.loan_id]: "idle" }));
      setApproveError((e) => ({
        ...e,
        [loan.loan_id]: (err as Error).message ?? "Errore sconosciuto",
      }));
    }
  };

  const handleReject = (loanId: string) => {
    setActionState((s) => ({ ...s, [loanId]: "rejected" }));
    // Dopo il reject, ricarica per mostrare lo stato aggiornato
    // (in futuro il reject potrebbe aggiornare il DB)
  };

  const utilizationPct = (pool: Pool) => {
    const avail = Number(pool.available_liquidity);
    const total = Number(pool.total_liquidity);
    if (total === 0) return 0;
    return Math.round(((total - avail) / total) * 100);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dc mb-1">{t("lenderDash.title")}</h2>
          <p className="text-[#94A3B8]">{t("lenderDash.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-[#1A2744] border border-[#2D3E5F] rounded-xl">
          <Wallet className="w-4 h-4 text-emerald-400" />
          {balanceLoading ? (
            <div className="h-4 w-20 bg-[#2D3E5F] rounded animate-pulse" />
          ) : (
            <span className="text-sm font-semibold text-dc">
              {nanosToIota(balanceData?.totalBalance ?? "0")} IOTA
            </span>
          )}
        </div>
      </div>

      {!contractsDeployed() && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-900/20 border border-amber-600/30 rounded-xl">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-400">{t("lenderDash.simBanner")}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-rose-900/20 border border-rose-600/30 rounded-xl">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* Pool Tabs */}
      {loadingPools ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-[#94A3B8]">{t("lenderDash.loadingPools")}</span>
        </div>
      ) : (
        <div className="flex gap-3 flex-wrap">
          {pools.map((pool) => (
            <button
              key={pool.pool_id}
              onClick={() => selectPool(pool)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200
                ${selectedPool?.pool_id === pool.pool_id
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30"
                  : "bg-[#1A2744] border-[#2D3E5F] text-[#94A3B8] hover:text-dc hover:border-[#3D4E6F]"
                }`}
            >
              <Coins className="w-4 h-4" />
              {pool.name}
              <Badge variant={bandVariant[pool.risk_band] ?? "gray"} className="text-xs">
                {pool.apr_percent}%
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Pool Stats + Deposit */}
      {selectedPool && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardBody className="text-center py-4">
                <p className="text-xs text-[#94A3B8] mb-1">Saldo on-chain</p>
                {loadingPoolBalance ? (
                  <div className="h-6 w-24 bg-[#2D3E5F] rounded animate-pulse mx-auto" />
                ) : onChainPoolBalance !== null ? (
                  <p className={`text-lg font-bold ${onChainPoolBalance === 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {onChainPoolBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} IOTA
                  </p>
                ) : (
                  <p className="text-lg font-bold text-dc">
                    {formatAmount(Number(selectedPool.available_liquidity) / 100)} IOTA
                  </p>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center py-4">
                <p className="text-xs text-[#94A3B8] mb-1">APR</p>
                <p className="text-lg font-bold text-indigo-400">{selectedPool.apr_percent}%</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center py-4">
                <p className="text-xs text-[#94A3B8] mb-1">{t("lenderDash.utilization")}</p>
                <p className="text-lg font-bold text-amber-400">{utilizationPct(selectedPool)}%</p>
              </CardBody>
            </Card>
          </div>

          {/* Warning: pool balance is 0 — lender must deposit before approving loans */}
          {contractsDeployed() && onChainPoolBalance === 0 && loans.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-rose-900/20 border border-rose-600/40 rounded-xl">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-300 mb-1">Pool vuota — deposita prima di approvare</p>
                <p className="text-xs text-rose-400">
                  Il saldo on-chain della pool è <strong>0 IOTA</strong>. Se approvi un prestito adesso, il borrower
                  non riuscirà a ricevere i fondi (errore <code className="bg-rose-900/40 px-1 rounded">EInsufficientLiquidity</code>).
                  Deposita liquidità con il form qui sotto prima di procedere.
                </p>
              </div>
            </div>
          )}

          {/* Deposit Liquidity */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold text-dc">{t("lenderDash.depositTitle")}</h3>
                </div>
                <button
                  onClick={() => setShowDeposit((v) => !v)}
                  className="text-xs text-[#94A3B8] hover:text-dc transition-colors flex items-center gap-1"
                >
                  {showDeposit ? (
                    <><ChevronUp className="w-3.5 h-3.5" /> {t("lenderDash.hide")}</>
                  ) : (
                    <><ChevronDown className="w-3.5 h-3.5" /> {t("lenderDash.addFunds")}</>
                  )}
                </button>
              </div>
            </CardHeader>
            {showDeposit && (
              <CardBody className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-[#94A3B8]">{t("lenderDash.depositAmount")}</label>
                    {balanceIota !== null && (
                      <button
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        onClick={() => setDepositAmount(Math.floor(balanceIota * 0.9))}
                      >
                        {t("lenderDash.use90", { amount: Math.floor(balanceIota * 0.9).toLocaleString() })}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    min={1}
                    step={10}
                    className="w-full bg-[#243154] border border-[#2D3E5F] rounded-xl px-4 py-3 text-dc focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  {balanceIota !== null && depositAmount > balanceIota && (
                    <p className="text-xs text-rose-400 mt-1">
                      {t("lenderDash.balanceExceeded", { balance: balanceIota.toFixed(4) })}
                    </p>
                  )}
                </div>

                {depositTxHash && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {depositTxHash.startsWith("simulation-") ? (
                      <p className="text-xs text-emerald-400">{t("lenderDash.depositSimulated")}</p>
                    ) : (
                      <p className="text-xs text-emerald-400">
                        {t("lenderDash.deposited")}{" "}
                        <a
                          href={`https://explorer.iota.org/testnet/tx/${depositTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-emerald-300 inline-flex items-center gap-1"
                        >
                          {t("lenderDash.viewTx")} <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>
                    )}
                  </div>
                )}

                {depositError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-900/20 border border-rose-600/30 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <p className="text-xs text-rose-400">{depositError}</p>
                  </div>
                )}

                <Button
                  variant="success"
                  onClick={handleDeposit}
                  loading={depositing}
                  disabled={depositing || (balanceIota !== null && depositAmount > balanceIota)}
                  className="w-full"
                  size="md"
                >
                  {depositing
                    ? t("lenderDash.depositing")
                    : t("lenderDash.depositBtn", { amount: depositAmount, pool: selectedPool.name })}
                </Button>
              </CardBody>
            )}

            {/* ── Ritira liquidità ── */}
            {contractsDeployed() && lpPositionId && (
              <CardBody className="border-t border-[#2D3E5F] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-medium text-dc">Ritira liquidità</span>
                  </div>
                  {lpDepositedAmount !== null && (
                    <span className="text-sm text-[#94A3B8]">
                      Depositato: <span className="text-dc font-semibold">{lpDepositedAmount.toLocaleString()} IOTA</span>
                    </span>
                  )}
                </div>

                {/* Warning: fondi in prestito — ritiro parzialmente bloccato */}
                {lpDepositedAmount !== null && onChainPoolBalance !== null && onChainPoolBalance < lpDepositedAmount && (
                  <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-600/30 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">
                      <strong className="block mb-0.5">Fondi parzialmente in prestito</strong>
                      La pool contiene {onChainPoolBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} IOTA,
                      ma il tuo deposito iniziale era {lpDepositedAmount.toLocaleString()} IOTA.
                      Potrai ritirare l'intero importo solo dopo che i prestiti attivi saranno rimborsati.
                    </p>
                  </div>
                )}

                {withdrawTxHash && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-xs text-emerald-400">
                      Fondi ritirati.{" "}
                      <a
                        href={`https://explorer.iota.org/testnet/tx/${withdrawTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-emerald-300 inline-flex items-center gap-1"
                      >
                        Vedi TX <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  </div>
                )}

                {withdrawError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-900/20 border border-rose-600/30 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <p className="text-xs text-rose-400">{withdrawError}</p>
                  </div>
                )}

                {/* Disabilita il ritiro se la pool ha meno del deposito originale */}
                {(() => {
                  const canWithdraw = onChainPoolBalance === null || lpDepositedAmount === null || onChainPoolBalance >= lpDepositedAmount;
                  return (
                    <Button
                      variant="primary"
                      onClick={handleWithdraw}
                      loading={withdrawing}
                      disabled={withdrawing || !!withdrawTxHash || !canWithdraw}
                      className="w-full"
                      size="md"
                    >
                      {withdrawing
                        ? "Ritiro in corso…"
                        : canWithdraw
                        ? `Ritira ${lpDepositedAmount?.toLocaleString() ?? ""} IOTA`
                        : "Ritiro non disponibile (prestito attivo)"}
                    </Button>
                  );
                })()}
              </CardBody>
            )}
          </Card>
        </>
      )}

      {/* Loan Requests */}
      {selectedPool && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-dc">
              {t("lenderDash.pendingRequests")}
              {!loadingLoans && (
                <span className="ml-2 text-sm text-[#94A3B8] font-normal">({loans.length})</span>
              )}
            </h3>
            <button
              onClick={() => refreshLoans()}
              disabled={refreshingLoans || loadingLoans}
              className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-dc transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingLoans ? "animate-spin" : ""}`} />
              {t("lenderDash.refresh")}
            </button>
          </div>

          {loadingLoans && (
            <div className="flex items-center gap-2 py-6">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span className="text-[#94A3B8]">{t("lenderDash.loadingRequests")}</span>
            </div>
          )}

          {!loadingLoans && loans.length === 0 && (
            <Card>
              <CardBody className="text-center py-10">
                <Award className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
                <p className="text-dc font-medium">{t("lenderDash.noPending")}</p>
                <p className="text-sm text-[#94A3B8] mt-1">{t("lenderDash.noPendingDesc")}</p>
              </CardBody>
            </Card>
          )}

          {!loadingLoans && loans.length > 0 && (
            <div className="space-y-4">
              {loans.map((loan) => {
                const state = actionState[loan.loan_id] ?? "idle";
                const vcExpanded = expandedVc === loan.loan_id;
                return (
                  <Card
                    key={loan.loan_id}
                    className={
                      state === "approved" ? "border-emerald-600/50"
                      : state === "rejected" ? "border-rose-600/30 opacity-60"
                      : ""
                    }
                  >
                    <CardBody>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-[#94A3B8]">
                              {shortenHash(loan.loan_id)}
                            </span>
                            {loan.risk_band && (
                              <Badge variant={bandVariant[loan.risk_band] ?? "gray"}>
                                Band {loan.risk_band}
                              </Badge>
                            )}
                            {state === "approved" && <Badge variant="emerald">✓ {t("lenderDash.approve").split(" ")[0]}</Badge>}
                            {state === "rejected" && <Badge variant="rose">✗ {t("lenderDash.reject")}</Badge>}
                          </div>
                          <p className="text-sm font-mono text-[#94A3B8]">
                            {shortenHash(loan.borrower_address)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-dc">
                            {Number(loan.principal).toLocaleString()}
                          </p>
                          <p className="text-xs text-[#94A3B8]">{t("lenderDash.iotaPrincipal")}</p>
                        </div>
                      </div>

                      {/* Warning: on_chain_id missing — approve_loan TX will be skipped */}
                      {contractsDeployed() && !loan.on_chain_id && (
                        <div className="mb-3 flex items-start gap-2 p-2.5 bg-amber-900/20 border border-amber-600/30 rounded-xl">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-400">
                            {t("lenderDash.noOnChainId")}
                          </p>
                        </div>
                      )}

                      {/* Score bar */}
                      {loan.score !== null && (
                        <div className="mb-4">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-[#94A3B8]">{t("lenderDash.riskScore")}</span>
                            <span className={`text-xs font-semibold ${
                              loan.score >= 80 ? "text-emerald-400"
                              : loan.score >= 65 ? "text-sky-400"
                              : loan.score >= 50 ? "text-amber-400"
                              : "text-rose-400"
                            }`}>
                              {loan.score}/100
                            </span>
                          </div>
                          <div className="h-2 bg-[#243154] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                loan.score >= 80 ? "bg-emerald-500"
                                : loan.score >= 65 ? "bg-sky-500"
                                : loan.score >= 50 ? "bg-amber-500"
                                : "bg-rose-500"
                              }`}
                              style={{ width: `${loan.score}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* VC Metadata accordion */}
                      {loan.vc_metadata && (
                        <div className="mb-4">
                          <button
                            onClick={() => setExpandedVc(vcExpanded ? null : loan.loan_id)}
                            className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            {t("lenderDash.vcCredential")}
                            {vcExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {vcExpanded && (
                            <div className="mt-3 p-4 bg-[#243154] rounded-xl space-y-2 text-xs animate-fade-in">
                              <div className="flex justify-between">
                                <span className="text-[#94A3B8]">{t("lenderDash.vcId")}</span>
                                <span className="font-mono text-indigo-300">{shortenHash(loan.vc_metadata.id ?? "")}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#94A3B8]">{t("lenderDash.issuer")}</span>
                                <span className="font-mono text-dc">{shortenHash(loan.vc_metadata.issuer ?? "", 12)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#94A3B8]">{t("lenderDash.type")}</span>
                                <span className="text-dc">RiskAttestationCredential</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#94A3B8]">{t("lenderDash.issued")}</span>
                                <span className="text-dc">
                                  {loan.vc_metadata.issuance_date
                                    ? new Date(loan.vc_metadata.issuance_date).toLocaleDateString()
                                    : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#94A3B8]">{t("lenderDash.expires")}</span>
                                <span className="text-dc">
                                  {loan.vc_metadata.expiration_date
                                    ? new Date(loan.vc_metadata.expiration_date).toLocaleDateString()
                                    : "—"}
                                </span>
                              </div>
                              {loan.vc_hash && (
                                <div className="pt-2 border-t border-[#2D3E5F]">
                                  <p className="text-[#94A3B8] mb-1">{t("lenderDash.vcHashOnChain")}</p>
                                  <p className="font-mono text-emerald-300 break-all">{loan.vc_hash}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      {approveError[loan.loan_id] && (
                        <div className="mb-3 flex items-start gap-2 p-3 bg-rose-900/20 border border-rose-600/30 rounded-xl">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-rose-300 mb-0.5">Errore approve_loan TX</p>
                            <p className="text-xs text-rose-400 break-all">{approveError[loan.loan_id]}</p>
                          </div>
                        </div>
                      )}

                      {state === "idle" && (
                        <div className="flex gap-3">
                          <Button variant="success" className="flex-1" onClick={() => handleApprove(loan)} size="md">
                            <CheckCircle2 className="w-4 h-4" /> {t("lenderDash.approve")}
                          </Button>
                          <Button variant="danger" className="flex-1" onClick={() => handleReject(loan.loan_id)} size="md">
                            <XCircle className="w-4 h-4" /> {t("lenderDash.reject")}
                          </Button>
                        </div>
                      )}
                      {state === "loading" && (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                          <span className="text-sm text-[#94A3B8]">{t("lenderDash.signing")}</span>
                        </div>
                      )}
                      {state === "approved" && (
                        <div className="flex items-center gap-2 py-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-sm text-emerald-400 font-medium">{t("lenderDash.funded")}</span>
                        </div>
                      )}
                      {state === "rejected" && (
                        <div className="flex items-center gap-2 py-2">
                          <XCircle className="w-5 h-5 text-rose-400" />
                          <span className="text-sm text-rose-400">{t("lenderDash.rejected")}</span>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
