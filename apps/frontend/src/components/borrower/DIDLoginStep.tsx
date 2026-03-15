"use client";

import { ConnectButton, useCurrentAccount } from "@iota/dapp-kit";
import { Shield, Zap, Wallet } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WalletInfoCard } from "@/components/ui/WalletButton";
import { didFromAddress } from "@/lib/iota-wallet";
import { useT } from "@/lib/i18n";

interface Props {
  onConnected: (wallet: { address: string; did: string }) => void;
}

export default function DIDLoginStep({ onConnected }: Props) {
  const account = useCurrentAccount();
  const { t } = useT();

  const handleContinue = () => {
    if (!account) return;
    onConnected({
      address: account.address,
      did: didFromAddress(account.address),
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dc mb-2">{t("did.title")}</h2>
        <p className="text-[#94A3B8]">{t("did.subtitle")}</p>
      </div>

      <Card>
        <CardBody>
          {!account ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-20 h-20 rounded-2xl bg-indigo-900/40 border border-indigo-600/30 flex items-center justify-center mb-6">
                <Wallet className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-dc mb-2">{t("did.walletTitle")}</h3>
              <p className="text-sm text-[#94A3B8] mb-8 max-w-sm">
                {t("did.walletDesc")}
              </p>
              <ConnectButton
                connectText={t("did.connectBtn")}
                className="!bg-indigo-600 !text-white !font-medium !px-6 !py-3 !rounded-xl !border-0 hover:!bg-indigo-500 !transition-colors !text-base"
              />
              <p className="mt-4 text-xs text-[#64748B]">
                {t("did.testnetNote")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <WalletInfoCard role="borrower" />

              <div className="flex items-start gap-3 p-4 bg-indigo-900/20 border border-indigo-600/20 rounded-xl">
                <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-[#94A3B8]">{t("did.didNote")}</p>
              </div>

              <Button onClick={handleContinue} className="w-full" size="lg">
                {t("did.continueBtn")} <Zap className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
