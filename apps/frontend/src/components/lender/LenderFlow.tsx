"use client";
import { useState } from "react";
import { ArrowLeft, Shield, CheckCircle2 } from "lucide-react";
import { ConnectButton, useCurrentAccount } from "@iota/dapp-kit";
import { Button } from "@/components/ui/Button";
import { WalletInfoCard, WalletNavButton } from "@/components/ui/WalletButton";
import LenderDashboard from "./LenderDashboard";
import { didFromAddress } from "@/lib/iota-wallet";
import { useT } from "@/lib/i18n";

interface Props {
  onBack: () => void;
  initialPool?: string | null;
}

export default function LenderFlow({ onBack }: Props) {
  const { t } = useT();
  const account = useCurrentAccount();
  const [confirmed, setConfirmed] = useState(false);

  const wallet = account
    ? { address: account.address, did: didFromAddress(account.address) }
    : null;

  const isReady = wallet && confirmed;

  return (
    <div className="min-h-screen bg-[#0F1729]">
      {/* Top bar */}
      <div className="px-8 py-5 border-b border-[#2D3E5F]/50 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> {t("nav.back")}
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium text-dc">{t("nav.lenderPortal")}</span>
        </div>
        <div className="ml-auto">
          <WalletNavButton />
        </div>
      </div>

      {!isReady ? (
        <div className="px-8 py-12 max-w-lg mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-dc mb-2">{t("lender.title")}</h2>
            <p className="text-[#94A3B8]">{t("lender.subtitle")}</p>
          </div>

          {!account ? (
            <div className="flex flex-col items-center py-10 gap-6">
              <div className="w-20 h-20 rounded-2xl bg-emerald-900/40 border border-emerald-600/30 flex items-center justify-center">
                <Shield className="w-10 h-10 text-emerald-400" />
              </div>
              <ConnectButton
                connectText={t("did.connectBtn")}
                className="!bg-emerald-600 !text-white !font-medium !px-6 !py-3 !rounded-xl !border-0 hover:!bg-emerald-500 !transition-colors !text-base"
              />
              <p className="text-xs text-[#64748B] text-center max-w-xs">
                {t("lender.connectNote")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <WalletInfoCard role="lender" />
              <div className="flex items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-emerald-300">{t("lender.confirmTitle")}</span>
              </div>
              <Button
                variant="success"
                className="w-full"
                size="lg"
                onClick={() => setConfirmed(true)}
              >
                {t("lender.confirmBtn")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="px-8 py-8 max-w-4xl mx-auto">
          <LenderDashboard wallet={wallet!} />
        </div>
      )}
    </div>
  );
}
