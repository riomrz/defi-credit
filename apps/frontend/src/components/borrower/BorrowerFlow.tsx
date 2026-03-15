"use client";
import { useState } from "react";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { ArrowLeft, Shield, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WalletNavButton } from "@/components/ui/WalletButton";
import DIDLoginStep from "./DIDLoginStep";
import ConsentScoreStep from "./ConsentScoreStep";
import MarketplaceStep from "./MarketplaceStep";
import LoanConfirmationStep from "./LoanConfirmationStep";
import { useT } from "@/lib/i18n";
import { api } from "@/lib/api";

export interface WalletInfo {
  address: string;
  did: string;
}

export interface BorrowerState {
  wallet: WalletInfo | null;
  score: number | null;
  riskBand: string | null;
  metrics: Record<string, number>;
  vcHash: string | null;
  selectedPoolId: string | null;
  selectedPoolOnChainId: string | null;
  selectedPoolName: string | null;
  loanRequestId: string | null;
  loanTxHash: string | null;
  loanAmount: number;
  loanTermYears: number;
}

// Dati del prestito attivo recuperati dal backend
interface ActiveLoanData {
  loan_request_id: string;
  status_label: "requested" | "funded" | "repaid";
  pool_name: string;
  pool_id: string;
  pool_on_chain_id: string;
  principal: number;
  total_due: number | null;
  term_years: number;
  vc_hash: string | null;
  on_chain_loan_id: string | null;
}

interface Props {
  onBack: () => void;
}

export default function BorrowerFlow({ onBack }: Props) {
  const { t } = useT();
  // "resume" è lo step intermedio che mostra la schermata di ripresa
  const [step, setStep] = useState<1 | "resume" | 2 | 3 | 4>(1);
  const [activeLoan, setActiveLoan] = useState<ActiveLoanData | null>(null);
  const [state, setState] = useState<BorrowerState>({
    wallet: null, score: null, riskBand: null, metrics: {},
    vcHash: null, selectedPoolId: null, selectedPoolOnChainId: null,
    selectedPoolName: null, loanRequestId: null, loanTxHash: null,
    loanAmount: 0, loanTermYears: 1,
  });

  const updateState = (update: Partial<BorrowerState>) =>
    setState((s) => ({ ...s, ...update }));

  const STEPS = [
    { id: 1, label: t("step.connect") },
    { id: 2, label: t("step.score") },
    { id: 3, label: t("step.apply") },
    { id: 4, label: t("step.confirm") },
  ];

  // Callback chiamato da DIDLoginStep dopo il connect
  const handleWalletConnected = async (wallet: WalletInfo) => {
    updateState({ wallet });

    try {
      const loan = await api.getBorrowerActiveLoan(wallet.address);
      if (loan && (loan.status_label === "requested" || loan.status_label === "funded")) {
        setActiveLoan({
          loan_request_id: loan.loan_request_id,
          status_label: loan.status_label,
          pool_name: loan.pool_name,
          pool_id: loan.pool_id,
          pool_on_chain_id: loan.pool_on_chain_id,
          principal: loan.principal,
          total_due: loan.total_due,
          term_years: loan.term_years,
          vc_hash: loan.vc_hash,
          on_chain_loan_id: loan.on_chain_loan_id,
        });
        setStep("resume");
        return;
      }
    } catch {
      // Se la chiamata fallisce, procedi normalmente senza bloccare il flusso
    }

    setStep(2);
  };

  // L'utente sceglie di riprendere il prestito esistente
  const handleResumeLoan = () => {
    if (!activeLoan) return;
    updateState({
      loanRequestId: activeLoan.loan_request_id,
      selectedPoolName: activeLoan.pool_name,
      selectedPoolId: activeLoan.pool_id,
      selectedPoolOnChainId: activeLoan.pool_on_chain_id,
      loanAmount: activeLoan.principal, // already in IOTA (DB stores IOTA, not nanoIOTA)
      loanTermYears: activeLoan.term_years,
      vcHash: activeLoan.vc_hash,
    });
    setStep(4);
  };

  // L'utente sceglie di iniziare una nuova valutazione
  const handleNewAssessment = () => {
    setActiveLoan(null);
    setStep(2);
  };

  // L'utente cancella il prestito dalla schermata di ripresa
  const handleCancelFromResume = async () => {
    if (!activeLoan) return;
    try {
      await api.cancelLoan(activeLoan.loan_request_id);
    } catch {
      // Ignora errori di rete — l'utente può cancellare anche da LoanConfirmationStep
    }
    setActiveLoan(null);
    setStep(2);
  };

  // Numero visivo per lo StepIndicator (lo step resume non ha un numero fisso)
  const visualStep = step === "resume" ? 1 : (step as number);

  return (
    <div className="min-h-screen bg-[#0F1729]">
      <div className="px-8 py-5 border-b border-[#2D3E5F]/50 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> {t("nav.back")}
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-medium text-dc">{t("nav.borrowerPortal")}</span>
        </div>
        <div className="ml-auto">
          <WalletNavButton />
        </div>
      </div>

      <div className="px-8 py-6 max-w-3xl mx-auto">
        <StepIndicator steps={STEPS} currentStep={visualStep} />
      </div>

      <div className="px-8 pb-12 max-w-3xl mx-auto">
        {step === 1 && (
          <DIDLoginStep
            onConnected={handleWalletConnected}
          />
        )}

        {/* ── Schermata di ripresa ──────────────────────────────────────── */}
        {step === "resume" && activeLoan && (
          <ResumeScreen
            loan={activeLoan}
            onResume={handleResumeLoan}
            onNew={handleNewAssessment}
            onCancel={activeLoan.status_label === "requested" ? handleCancelFromResume : undefined}
          />
        )}

        {step === 2 && (
          <ConsentScoreStep
            wallet={state.wallet!}
            onScored={(score, riskBand, metrics, vcHash) => {
              updateState({ score, riskBand, metrics, vcHash });
              setStep(3);
            }}
          />
        )}
        {step === 3 && (
          <MarketplaceStep
            score={state.score!}
            riskBand={state.riskBand!}
            vcHash={state.vcHash}
            wallet={state.wallet!}
            onLoanRequested={(poolId, poolOnChainId, poolName, loanRequestId, amount, termYears) => {
              updateState({ selectedPoolId: poolId, selectedPoolOnChainId: poolOnChainId, selectedPoolName: poolName, loanRequestId, loanAmount: amount, loanTermYears: termYears });
              setStep(4);
            }}
          />
        )}
        {step === 4 && (
          <LoanConfirmationStep
            loanRequestId={state.loanRequestId!}
            poolName={state.selectedPoolName!}
            poolOnChainId={state.selectedPoolOnChainId ?? ""}
            amount={state.loanAmount}
            termYears={state.loanTermYears}
            vcHash={state.vcHash}
          />
        )}
      </div>
    </div>
  );
}

// ── Componente schermata resume ──────────────────────────────────────────────

function ResumeScreen({
  loan,
  onResume,
  onNew,
  onCancel,
}: {
  loan: ActiveLoanData;
  onResume: () => void;
  onNew: () => void;
  onCancel?: () => Promise<void> | void;
}) {
  const { t } = useT();
  const [cancelling, setCancelling] = useState(false);

  // principal is stored in IOTA in the DB
  const principalIota = loan.principal.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  const statusColor =
    loan.status_label === "funded" ? "text-green-400" : "text-yellow-400";

  const termLabel =
    loan.term_years === 1
      ? t("market.term1y")
      : loan.term_years === 5
      ? t("market.term5y")
      : t("market.term10y");

  const handleCancelClick = async () => {
    if (!onCancel) return;
    if (!confirm(t("repay.cancelConfirm"))) return;
    setCancelling(true);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-500/20">
          <RefreshCw className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-dc">{t("resume.title")}</h2>
          <p className="text-sm text-dc-muted">{t("resume.desc")}</p>
        </div>
      </div>

      {/* Dettagli prestito */}
      <div className="rounded-lg border border-[#2D3E5F]/60 bg-[#0F1729]/60 divide-y divide-[#2D3E5F]/40">
        <Row label={t("resume.pool")} value={loan.pool_name} />
        <Row label={t("resume.amount")} value={`${principalIota} IOTA`} />
        <Row
          label={t("resume.status")}
          value={
            <span className={`capitalize font-medium ${statusColor}`}>
              {loan.status_label}
            </span>
          }
        />
        <Row label={t("resume.term")} value={termLabel} />
      </div>

      {/* Bottoni principali */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Button
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
          onClick={onResume}
        >
          <RefreshCw className="w-4 h-4" />
          {t("resume.btnResume")}
        </Button>
        <Button
          variant="ghost"
          className="flex-1 border border-[#2D3E5F] hover:border-indigo-500/50"
          onClick={onNew}
        >
          <RotateCcw className="w-4 h-4" />
          {t("resume.btnNew")}
        </Button>
      </div>

      {/* Cancel button — solo per prestiti in stato "requested" */}
      {onCancel && (
        <div className="pt-1 border-t border-[#2D3E5F]/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelClick}
            loading={cancelling}
            className="w-full text-rose-400 hover:text-rose-300 border border-rose-800/30 hover:border-rose-600/40"
          >
            <XCircle className="w-4 h-4" />
            {cancelling ? t("repay.cancelling") : t("repay.cancelBtn")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-dc-muted">{label}</span>
      <span className="text-dc font-medium">{value}</span>
    </div>
  );
}
