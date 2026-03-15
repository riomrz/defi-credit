"use client";

import { IotaClientProvider, WalletProvider } from "@iota/dapp-kit";
import { getFullnodeUrl } from "@iota/iota-sdk/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ThemeProvider } from "@/lib/theme";
import { LanguageProvider } from "@/lib/i18n";

// Import dapp-kit styles
import "@iota/dapp-kit/dist/index.css";

const IOTA_NETWORK = (process.env.NEXT_PUBLIC_IOTA_NETWORK ?? "testnet") as
  | "mainnet"
  | "testnet"
  | "devnet"
  | "localnet";

const networks = {
  mainnet: { url: getFullnodeUrl("mainnet") },
  testnet: { url: getFullnodeUrl("testnet") },
  devnet: { url: getFullnodeUrl("devnet") },
  localnet: { url: getFullnodeUrl("localnet") },
};

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <IotaClientProvider networks={networks} defaultNetwork={IOTA_NETWORK}>
            <WalletProvider autoConnect>
              {children}
            </WalletProvider>
          </IotaClientProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
