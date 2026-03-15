"use client";
import {
  ConnectButton,
  useCurrentAccount,
  useIotaClientQuery,
  useDisconnectWallet,
} from "@iota/dapp-kit";
import { Wallet, Network, LogOut } from "lucide-react";
import { nanosToIota, didFromAddress, shortenAddress } from "@/lib/iota-wallet";
import { useT } from "@/lib/i18n";

/** Compact navbar button: shows balance + disconnect when connected */
export function WalletNavButton() {
  const { t } = useT();
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const { data: balance } = useIotaClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: Boolean(account?.address) }
  );

  if (!account) {
    return (
      <ConnectButton
        connectText={t("did.connectBtn")}
        className="!text-sm !font-medium !px-4 !py-2 !rounded-xl !bg-indigo-600 !text-white !border-0 hover:!bg-indigo-500 !transition-colors"
      />
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1A2744] border border-[#2D3E5F] rounded-xl">
        <Wallet className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-xs font-mono text-[#94A3B8]">
          {shortenAddress(account.address)}
        </span>
        {balance && (
          <span className="text-xs font-semibold text-dc">
            {nanosToIota(balance.totalBalance)} IOTA
          </span>
        )}
      </div>
      <button
        onClick={() => disconnect()}
        title={t("wallet.disconnect")}
        className="p-1.5 rounded-xl border border-[#2D3E5F] bg-[#1A2744] text-[#94A3B8] hover:text-rose-400 hover:border-rose-600/40 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface WalletInfoCardProps {
  role?: "borrower" | "lender";
}

/** Full info card showing address, DID, balance */
export function WalletInfoCard({ role = "borrower" }: WalletInfoCardProps) {
  const { t } = useT();
  const account = useCurrentAccount();
  const { data: balance, isLoading } = useIotaClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: Boolean(account?.address) }
  );

  if (!account) return null;

  const did = didFromAddress(account.address);
  const accentColor = role === "lender" ? "text-emerald-400" : "text-indigo-400";
  const borderColor = role === "lender" ? "border-emerald-600/30" : "border-indigo-600/30";
  const bgColor = role === "lender" ? "bg-emerald-900/20" : "bg-indigo-900/20";

  return (
    <div className={`p-4 rounded-xl border ${borderColor} ${bgColor} space-y-3`}>
      <div className="flex items-center gap-2">
        <Wallet className={`w-4 h-4 ${accentColor}`} />
        <span className={`text-sm font-semibold ${accentColor}`}>
          {t("wallet.balance")}:{" "}
          {isLoading ? (
            <span className="inline-block h-3 w-16 bg-[#2D3E5F] rounded animate-pulse align-middle" />
          ) : (
            <span className="text-dc">
              {nanosToIota(balance?.totalBalance ?? "0")} IOTA
            </span>
          )}
        </span>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex gap-2">
          <span className="text-[#94A3B8] w-16 shrink-0">{t("wallet.did")}</span>
          <span className="font-mono text-dc truncate">{did}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[#94A3B8] w-16 shrink-0">Address</span>
          <span className="font-mono text-dc truncate">{account.address}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[#94A3B8] w-16 shrink-0">{t("wallet.network")}</span>
          <span className="flex items-center gap-1 text-dc">
            <Network className="w-3 h-3" />
            {process.env.NEXT_PUBLIC_IOTA_NETWORK ?? "testnet"}
          </span>
        </div>
      </div>
    </div>
  );
}
