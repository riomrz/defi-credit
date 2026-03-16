"use client";
import {
  Award, CheckCircle, Copy, ExternalLink, RefreshCw, Clock,
  Coins, AlertCircle, Info, XCircle, Zap,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { shortenHash } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { api } from "@/lib/api";
import { nanosToIota, iotaToNanos } from "@/lib/iota-wallet";
import { buildFundLoanTx, buildRepayLoanTx, contractsDeployed, getPackageId } from "@/lib/iota-tx";
import {
  useSignAndExecuteTransaction,
  useIotaClient,
  useCurrentAccount,
} from "@iota/dapp-kit";

// ── Types ─────────────────────────────────────────────────────────────────────

type LoanStatus = "requested" | "funded" | "repaid" | "cancelled";

interface LoanDetails {
  status: number;
  status_label: LoanStatus;
  on_chain_loan_id: string | null;
  pool_on_chain_id: string;
  total_due: number | null;
  principal: number;
  interest_rate_bps: number;
  funded_at: string | null;
  repaid_at: string | null;
}

interface Props {
  loanRequestId: string;
  poolName: string;
  poolOnChainId: string;
  amount: number;         // IOTA amount (for display fallback)
  termYears: number;
  vcHash: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoanConfirmationStep({
  loanRequestId,
  poolName,
  poolOnChainId,
  amount,
  termYears,
  vcHash,
}: Props) {
  const { t } = useT();
  const client = useIotaClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [copied, setCopied] = useState(false);
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Claim funds (borrower calls fund_loan on-chain to receive principal)
  // Inizializzato da localStorage per sopravvivere ai re-mount
  const claimedKey = `deficredit_claimed_${loanRequestId}`;
  const [claimed, setClaimed] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem(claimedKey) === "true"
  );
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);

  // Repay form state
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [repaying, setRepaying] = useState(false);
  const [repayError, setRepayError] = useState<string | null>(null);
  const [repayTxHash, setRepayTxHash] = useState<string | null>(null);
  const [repaySuccess, setRepaySuccess] = useState<string | null>(null);

  // Cancel
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const mockTxHash = `0x${Math.random().toString(16).slice(2).padStart(64, "0")}`;

  const copyHash = () => {
    navigator.clipboard.writeText(mockTxHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Fetch loan status ──────────────────────────────────────────────────────

  const fetchLoanDetails = useCallback(async () => {
    try {
      setFetchError(null);
      const details = await api.getLoan(loanRequestId);
      setLoanDetails(details);
      // Pre-fill repay amount with total_due (in IOTA)
      if (details.total_due && repayAmount === 0) {
        setRepayAmount(details.total_due);
      }
    } catch (err) {
      setFetchError((err as Error).message ?? t("repay.fetchError"));
    }
  }, [loanRequestId, repayAmount, t]);

  // Poll on mount and every 15s while status is "requested"
  useEffect(() => {
    fetchLoanDetails();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loanDetails?.status_label !== "requested") return;
    const interval = setInterval(fetchLoanDetails, 15_000);
    return () => clearInterval(interval);
  }, [loanDetails?.status_label, fetchLoanDetails]);

  // ── Auto-recovery: se il loan è "funded" ma on_chain_loan_id è null nel DB,
  // cerchiamo la LoanPosition tra gli oggetti owned dal borrower e la salviamo.
  // Questo accade quando saveLoanOnChainId è fallito dopo la TX di request_loan.
  useEffect(() => {
    const recoverOnChainId = async () => {
      const packageId = getPackageId();
      if (!packageId || !account?.address) return;
      if (loanDetails?.status_label !== "funded") return;
      if (loanDetails?.on_chain_loan_id) return; // già presente, niente da fare

      try {
        const result = await client.getOwnedObjects({
          owner: account.address,
          filter: { StructType: `${packageId}::loan::LoanPosition` },
          options: { showType: true },
        });

        const firstObj = result.data?.[0]?.data;
        if (!firstObj?.objectId) return;

        // Salva l'object ID nel DB e ri-fetch i dettagli
        await api.saveLoanOnChainId({
          loan_request_id: loanRequestId,
          on_chain_loan_id: firstObj.objectId,
        });
        await fetchLoanDetails();
      } catch {
        // Non bloccante — se fallisce, l'utente vedrà il form di repay off-chain
      }
    };

    recoverOnChainId();
  }, [loanDetails?.status_label, loanDetails?.on_chain_loan_id, account?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Verifica on-chain se fund_loan è già stato eseguito ───────────────────
  // Se il loan è "funded" e non abbiamo LoanApproval in wallet, significa che
  // il borrower ha già chiamato fund_loan in una sessione precedente.
  useEffect(() => {
    if (claimed) return; // già sappiamo che è stato reclamato
    if (loanDetails?.status_label !== "funded") return;
    if (!contractsDeployed() || !account?.address) return;

    const checkClaimed = async () => {
      try {
        const packageId = getPackageId();
        if (!packageId) return;
        const result = await client.getOwnedObjects({
          owner: account.address,
          filter: { StructType: `${packageId}::loan::LoanApproval` },
          options: { showType: true },
        });
        // Se non c'è nessun LoanApproval nel wallet ma il loan è funded,
        // significa che fund_loan è già stato eseguito.
        if (result.data.length === 0) {
          setClaimed(true);
          localStorage.setItem(claimedKey, "true");
        }
      } catch {
        // Non bloccante
      }
    };

    checkClaimed();
  }, [loanDetails?.status_label, account?.address, claimed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualRefresh = async () => {
    setPolling(true);
    await fetchLoanDetails();
    setPolling(false);
  };

  // ── Claim Funds (borrower calls fund_loan on-chain) ────────────────────────
  // Requires:
  //   1. LoanPosition (owned by borrower, on_chain_loan_id)
  //   2. LoanApproval (sent by lender via approve_loan TX, owned by borrower)
  //   3. Pool object ID
  //
  // The LoanApproval is found via getOwnedObjects, matched by
  // approval.loan_id == on_chain_loan_id.

  const handleClaimFunds = async () => {
    if (!loanDetails || !account?.address) return;
    setClaimError(null);
    setClaiming(true);

    try {
      const packageId = getPackageId();
      const onChainPoolId = loanDetails.pool_on_chain_id || poolOnChainId;

      if (!onChainPoolId || !packageId) {
        throw new Error(
          "Missing on-chain pool ID. Ensure pools are re-initialized after contract re-deploy " +
          "(run scripts/init-pools-onchain.ts with the new NEXT_PUBLIC_MOVE_PACKAGE_ID)."
        );
      }

      // ── Step 1: Find LoanApproval in borrower's wallet ─────────────────────
      console.log("[claim] Cerco LoanApproval nel wallet", {
        owner: account.address,
        structType: `${packageId}::loan::LoanApproval`,
        dbLoanId: loanDetails.on_chain_loan_id,
      });
      const approvalResult = await client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${packageId}::loan::LoanApproval` },
        options: { showContent: true, showType: true },
      });
      console.log("[claim] getOwnedObjects risposta:", JSON.stringify(approvalResult.data, null, 2));

      let approvalObjectId: string | null = null;
      let approvalLoanId: string | null = null;

      for (const item of approvalResult.data) {
        const content = item.data?.content;
        if (content?.dataType === "moveObject") {
          const fields = content.fields as Record<string, unknown>;

          // ID fields can come back as a plain "0x..." string OR a nested
          // { bytes: "0x..." } object — handle both cases defensively.
          const rawLoanId = fields.loan_id;
          let fieldLoanId: string | undefined;
          if (typeof rawLoanId === "string") {
            fieldLoanId = rawLoanId;
          } else if (rawLoanId && typeof rawLoanId === "object") {
            fieldLoanId =
              (rawLoanId as { bytes?: string }).bytes ??
              (rawLoanId as { id?: string }).id;
          }

          if (!fieldLoanId) continue;

          // If DB has on_chain_loan_id, require an exact match (case-insensitive).
          // Otherwise take the first LoanApproval we find — it must be ours since
          // each approval is scoped to a specific borrower by the Move contract.
          const dbLoanId = loanDetails.on_chain_loan_id;
          const isMatch =
            !dbLoanId ||
            fieldLoanId.toLowerCase() === dbLoanId.toLowerCase();

          if (isMatch) {
            approvalObjectId = item.data!.objectId;
            approvalLoanId = fieldLoanId;
            break;
          }
        }
      }

      if (!approvalObjectId || !approvalLoanId) {
        throw new Error(
          "LoanApproval not found in your wallet. " +
          "The lender must approve your loan on-chain first. " +
          "If they already clicked 'Approve', their TX may have been skipped because " +
          "the loan's on-chain ID was missing — ask them to approve again after re-initializing pools."
        );
      }

      // ── Step 2: Resolve the LoanPosition ID ────────────────────────────────
      // Use on_chain_loan_id from DB if available; fall back to the ID stored
      // inside the LoanApproval (which the lender set when they called approve_loan).
      const onChainLoanId = loanDetails.on_chain_loan_id ?? approvalLoanId;

      // If we recovered the ID from the approval, persist it to DB for future calls.
      if (!loanDetails.on_chain_loan_id) {
        try {
          await api.saveLoanOnChainId({
            loan_request_id: loanRequestId,
            on_chain_loan_id: onChainLoanId,
          });
        } catch {
          // Non-blocking — fund_loan TX still proceeds.
        }
      }

      // ── Step 3: Sign fund_loan TX ───────────────────────────────────────────
      // LoanApproval is consumed (deleted) by this call. Principal flows to borrower.
      const tx = buildFundLoanTx(onChainLoanId, approvalObjectId, onChainPoolId);
      const execResult = await signAndExecute({ transaction: tx as any });
      setClaimTxHash(execResult.digest);
      await client.waitForTransaction({ digest: execResult.digest });
      setClaimed(true);
      localStorage.setItem(claimedKey, "true");
    } catch (err) {
      setClaimError((err as Error).message);
    } finally {
      setClaiming(false);
    }
  };

  // ── Repay ──────────────────────────────────────────────────────────────────

  const handleRepay = async () => {
    if (!loanDetails) return;
    setRepayError(null);
    setRepaySuccess(null);
    setRepaying(true);

    try {
      // 1. On-chain TX first (if possible). The LoanPosition must be in FUNDED
      //    state on-chain — requires handleClaimFunds to have been called first.
      const onChainLoanId = loanDetails.on_chain_loan_id;
      const onChainPoolId = loanDetails.pool_on_chain_id || poolOnChainId;

      if (contractsDeployed() && onChainLoanId && onChainPoolId && claimed) {
        const tx = buildRepayLoanTx(
          onChainLoanId,
          onChainPoolId,
          iotaToNanos(repayAmount), // repayAmount is in IOTA
        );
        const execResult = await signAndExecute({ transaction: tx as any });
        setRepayTxHash(execResult.digest);
        await client.waitForTransaction({ digest: execResult.digest });
      }

      // 2. Update DB (optimistic if on-chain was skipped, confirmed if on-chain succeeded)
      const result = await api.repayLoan({
        loan_request_id: loanRequestId,
        amount: repayAmount,
        on_chain_loan_id: onChainLoanId ?? undefined,
      });

      if (result.fully_repaid) {
        setRepaySuccess(t("repay.fullyRepaid"));
      } else {
        setRepaySuccess(
          t("repay.partialLeft", {
            balance: Number(result.remaining_balance).toLocaleString(),
          })
        );
        setRepayAmount(Number(result.remaining_balance));
      }
    } catch (err) {
      setRepayError((err as Error).message);
    } finally {
      setRepaying(false);
      // Always refresh so local state matches DB
      await fetchLoanDetails();
    }
  };

  // ── Cancel loan ────────────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (!confirm(t("repay.cancelConfirm"))) return;
    setCancelError(null);
    setCancelling(true);
    try {
      await api.cancelLoan(loanRequestId);
      await fetchLoanDetails();
    } catch (err) {
      setCancelError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const status = loanDetails?.status_label ?? "requested";
  // totalDue is in IOTA (same unit as principal in DB)
  const totalDue = loanDetails?.total_due ?? amount;
  const termLabel =
    termYears === 1
      ? t("market.term1y")
      : termYears === 5
      ? t("market.term5y")
      : t("market.term10y");

  // Show claim button when: funded by lender (DB), contracts deployed,
  // and borrower hasn't claimed yet.
  // Note: we no longer require on_chain_loan_id here — handleClaimFunds will
  // recover it from the LoanApproval object in the borrower's wallet if needed.
  const showClaimStep =
    status === "funded" &&
    contractsDeployed() &&
    !claimed;

  // Show repay form only after borrower has claimed on-chain, OR in off-chain mode.
  // Previously this showed when on_chain_loan_id was null — that was wrong because
  // it let borrowers "repay" without ever receiving funds.
  const showRepayForm =
    status === "funded" &&
    (!contractsDeployed() || claimed);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in space-y-6">

      {/* Header */}
      <div className="text-center py-4">
        <div className={`w-20 h-20 border rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors
          ${status === "repaid" || status === "cancelled"
            ? "bg-emerald-900/40 border-emerald-600/30"
            : status === "funded"
            ? "bg-indigo-900/40 border-indigo-600/30"
            : "bg-emerald-900/40 border-emerald-600/30"}`}>
          {status === "cancelled"
            ? <XCircle className="w-10 h-10 text-rose-400" />
            : <CheckCircle className={`w-10 h-10 ${status === "funded" ? "text-indigo-400" : "text-emerald-400"}`} />}
        </div>
        <h2 className="text-2xl font-bold text-dc mb-2">{t("confirm.title")}</h2>
        <p className="text-[#94A3B8]">{t("confirm.subtitle")}</p>
      </div>

      {/* Fetch error banner */}
      {fetchError && (
        <div className="flex items-start gap-3 p-4 bg-rose-900/20 border border-rose-600/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-300">Backend error</p>
            <p className="text-xs text-rose-400 mt-0.5">{fetchError}</p>
            <p className="text-xs text-rose-300 mt-1 opacity-70">
              Run <code className="bg-rose-900/40 px-1 rounded">prisma db push</code> in the backend if you recently added schema fields.
            </p>
          </div>
        </div>
      )}

      {/* NFT card */}
      <div
        className="relative rounded-2xl overflow-hidden p-6 text-center"
        style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81, #1e3a5f)" }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 50% 0%, #6366f1 0%, transparent 70%)" }}
        />
        <Award className="w-16 h-16 text-indigo-300 mx-auto mb-4 relative z-10" />
        <p className="text-xs text-indigo-300 uppercase tracking-widest mb-1 relative z-10">
          {t("confirm.nftLabel")}
        </p>
        <p className="text-xl font-bold text-white font-mono relative z-10">
          {shortenHash(loanRequestId, 10)}
        </p>
        <p className="text-sm text-indigo-200 mt-2 relative z-10">
          {poolName} · {amount.toLocaleString()} IOTA · {termLabel}
        </p>
        <div className="mt-3 relative z-10 flex justify-center gap-2">
          <Badge variant={
            status === "repaid" ? "emerald"
            : status === "cancelled" ? "rose"
            : status === "funded" ? "sky"
            : "amber"
          }>
            {status === "repaid"
              ? t("repay.repaidTitle")
              : status === "cancelled"
              ? t("repay.cancelledTitle")
              : status === "funded"
              ? t("repay.fundedTitle")
              : t("confirm.status")}
          </Badge>
        </div>
      </div>

      {/* Loan details table */}
      <Card>
        <CardBody className="space-y-4">
          <h3 className="text-sm font-semibold text-dc mb-3">{t("confirm.detailsTitle")}</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-[#2D3E5F]">
              <span className="text-sm text-[#94A3B8]">{t("confirm.loanId")}</span>
              <span className="text-sm font-mono text-dc">{shortenHash(loanRequestId)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2D3E5F]">
              <span className="text-sm text-[#94A3B8]">{t("confirm.pool")}</span>
              <span className="text-sm text-dc">{poolName}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2D3E5F]">
              <span className="text-sm text-[#94A3B8]">{t("confirm.principal")}</span>
              <span className="text-sm text-dc">{amount.toLocaleString()} IOTA</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2D3E5F]">
              <span className="text-sm text-[#94A3B8]">{t("confirm.term")}</span>
              <span className="text-sm text-dc">{termLabel}</span>
            </div>
            {loanDetails?.total_due != null && (
              <div className="flex justify-between items-center py-2 border-b border-[#2D3E5F]">
                <span className="text-sm text-[#94A3B8]">{t("repay.totalDue")}</span>
                <span className="text-sm font-semibold text-amber-400">
                  {loanDetails.total_due.toLocaleString()} IOTA
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-[#2D3E5F]">
              <span className="text-sm text-[#94A3B8]">{t("confirm.vcHash")}</span>
              <span className="text-xs font-mono text-indigo-300">
                {vcHash ? shortenHash(vcHash) : "—"}
              </span>
            </div>
            {loanDetails?.on_chain_loan_id && (
              <div className="flex justify-between items-center py-2 border-b border-[#2D3E5F]">
                <span className="text-sm text-[#94A3B8]">On-chain ID</span>
                <span className="text-xs font-mono text-indigo-300">
                  {shortenHash(loanDetails.on_chain_loan_id)}
                </span>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-[#94A3B8] mb-2">{t("confirm.txHash")}</p>
            <div className="flex items-center gap-2 bg-[#243154] rounded-xl p-3">
              <p className="flex-1 text-xs font-mono text-[#94A3B8] truncate">{mockTxHash}</p>
              <button
                onClick={copyHash}
                className="shrink-0 p-1.5 hover:bg-[#2D3E5F] rounded-lg transition-colors"
              >
                <Copy className={`w-4 h-4 ${copied ? "text-emerald-400" : "text-[#94A3B8]"}`} />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" size="md">
              <ExternalLink className="w-4 h-4" /> {t("confirm.explorer")}
            </Button>
            <Button variant="ghost" className="flex-1" size="md">
              {t("confirm.download")}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* ── Status section ───────────────────────────────────────────────── */}

      {/* REQUESTED: waiting + cancel */}
      {status === "requested" && (
        <Card>
          <CardBody>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-900/30 border border-amber-600/30 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-dc mb-1">{t("repay.waitingTitle")}</p>
                <p className="text-sm text-[#94A3B8]">{t("repay.waitingDesc")}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleManualRefresh} loading={polling}>
                <RefreshCw className="w-4 h-4" />
                {t("repay.checkStatus")}
              </Button>
            </div>

            {/* Cancel button */}
            <div className="mt-4 pt-4 border-t border-[#2D3E5F]/60">
              {cancelError && (
                <p className="text-xs text-rose-400 mb-2">{cancelError}</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                loading={cancelling}
                className="text-rose-400 hover:text-rose-300 border-rose-800/40 hover:border-rose-600/40"
              >
                <XCircle className="w-4 h-4" />
                {cancelling ? t("repay.cancelling") : t("repay.cancelBtn")}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* FUNDED + CONTRACTS DEPLOYED: borrower must claim funds on-chain first */}
      {showClaimStep && (
        <div className="space-y-4">
          {/* Approved banner */}
          <div className="flex items-start gap-3 p-4 bg-indigo-900/20 border border-indigo-600/30 rounded-xl">
            <Zap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-300 mb-0.5">{t("repay.claimTitle")}</p>
              <p className="text-xs text-[#94A3B8]">{t("repay.claimDesc")}</p>
            </div>
          </div>

          <Card glow>
            <CardBody className="space-y-4">
              {claimTxHash && (
                <div className="flex items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-400">
                    Claim TX:{" "}
                    <a
                      href={`https://explorer.iota.org/testnet/tx/${claimTxHash}`}
                      target="_blank" rel="noopener noreferrer"
                      className="underline hover:text-emerald-300"
                    >
                      {claimTxHash.slice(0, 20)}…
                    </a>
                  </p>
                </div>
              )}
              {claimError && (
                <div className="flex items-center gap-2 p-3 bg-rose-900/20 border border-rose-600/30 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <p className="text-xs text-rose-400">{claimError}</p>
                </div>
              )}
              <Button
                onClick={handleClaimFunds}
                loading={claiming}
                disabled={claiming}
                className="w-full bg-indigo-600 hover:bg-indigo-500"
                size="lg"
              >
                <Zap className="w-4 h-4" />
                {claiming ? t("repay.claiming") : t("repay.claimBtn")}
              </Button>
            </CardBody>
          </Card>
        </div>
      )}

      {/* FUNDED: repay form (off-chain mode OR after claiming) */}
      {showRepayForm && (
        <div className="space-y-4">
          {/* Funded banner */}
          <div className="flex items-start gap-3 p-4 bg-indigo-900/20 border border-indigo-600/30 rounded-xl">
            <Coins className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-300 mb-0.5">{t("repay.fundedTitle")}</p>
              <p className="text-xs text-[#94A3B8]">
                {claimed ? t("repay.claimedDesc") : t("repay.fundedDesc")}
              </p>
            </div>
          </div>

          {/* Repay form */}
          <Card glow>
            <CardBody className="space-y-4">
              <h3 className="text-sm font-semibold text-dc flex items-center gap-2">
                <Coins className="w-4 h-4 text-indigo-400" />
                {t("repay.sectionTitle")}
              </h3>

              {/* Outstanding balance */}
              <div className="flex items-center justify-between p-3 bg-[#243154] rounded-xl">
                <span className="text-sm text-[#94A3B8]">{t("repay.outstanding")}</span>
                <span className="text-sm font-semibold text-amber-400">
                  {totalDue.toLocaleString()} IOTA
                </span>
              </div>

              {/* Amount input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-[#94A3B8]">{t("repay.repayAmount")}</label>
                  <button
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    onClick={() => setRepayAmount(totalDue)}
                  >
                    {t("repay.repayFull")}
                  </button>
                </div>
                <input
                  type="number"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(Number(e.target.value))}
                  min={1}
                  max={totalDue}
                  step={1}
                  className="w-full bg-[#243154] border border-[#2D3E5F] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Simulation note */}
              {!contractsDeployed() && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-900/20 border border-amber-600/20 rounded-xl">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">{t("repay.simMode")}</p>
                </div>
              )}

              {/* Success */}
              {repaySuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-400 font-medium">{t("repay.successMsg")}</p>
                    <p className="text-xs text-emerald-300">{repaySuccess}</p>
                  </div>
                </div>
              )}

              {/* TX hash */}
              {repayTxHash && (
                <div className="flex items-center gap-2 p-3 bg-indigo-900/20 border border-indigo-600/30 rounded-xl">
                  <ExternalLink className="w-4 h-4 text-indigo-400 shrink-0" />
                  <p className="text-xs text-indigo-400">
                    Tx:{" "}
                    <a
                      href={`https://explorer.iota.org/testnet/tx/${repayTxHash}`}
                      target="_blank" rel="noopener noreferrer"
                      className="underline hover:text-indigo-300"
                    >
                      {repayTxHash.slice(0, 20)}…
                    </a>
                  </p>
                </div>
              )}

              {/* Error */}
              {repayError && (
                <div className="flex items-center gap-2 p-3 bg-rose-900/20 border border-rose-600/30 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <p className="text-xs text-rose-400">{repayError}</p>
                </div>
              )}

              <Button
                onClick={handleRepay}
                loading={repaying}
                disabled={repaying || repayAmount <= 0 || repayAmount > totalDue || !loanDetails}
                className="w-full"
                size="lg"
              >
                {repaying ? t("repay.signing") : t("repay.submitBtn")}
              </Button>
            </CardBody>
          </Card>
        </div>
      )}

      {/* REPAID */}
      {status === "repaid" && (
        <div className="flex items-start gap-3 p-4 bg-emerald-900/20 border border-emerald-600/30 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-300 mb-0.5">{t("repay.repaidTitle")}</p>
            <p className="text-xs text-[#94A3B8]">{t("repay.repaidDesc")}</p>
          </div>
        </div>
      )}

      {/* CANCELLED */}
      {status === "cancelled" && (
        <div className="flex items-start gap-3 p-4 bg-rose-900/20 border border-rose-600/30 rounded-xl">
          <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-300 mb-0.5">{t("repay.cancelledTitle")}</p>
            <p className="text-xs text-[#94A3B8]">{t("repay.cancelledDesc")}</p>
          </div>
        </div>
      )}

      {/* Next steps (only when still requested) */}
      {status === "requested" && (
        <div className="p-4 bg-indigo-900/20 border border-indigo-600/20 rounded-xl">
          <p className="text-sm text-indigo-300 font-medium mb-1">{t("confirm.nextSteps")}</p>
          <p className="text-xs text-[#94A3B8]">
            {t("confirm.nextStepsDesc", { pool: poolName })}
          </p>
        </div>
      )}
    </div>
  );
}
