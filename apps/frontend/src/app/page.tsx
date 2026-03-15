"use client";
import { useState, useEffect, useRef } from "react";
import { useCurrentAccount } from "@iota/dapp-kit";
import LandingPage from "@/components/LandingPage";
import BorrowerFlow from "@/components/borrower/BorrowerFlow";
import LenderFlow from "@/components/lender/LenderFlow";
import { SettingsBar } from "@/components/ui/SettingsBar";

export type AppRole = "none" | "borrower" | "lender";

export default function Home() {
  const [role, setRole] = useState<AppRole>("none");
  const [lenderSelectedPool, setLenderSelectedPool] = useState<string | null>(null);
  const account = useCurrentAccount();
  // Traccia l'account precedente per rilevare la TRANSIZIONE connesso → disconnesso
  const prevAccount = useRef(account);

  // Solo quando il wallet si disconnette DURANTE un flusso attivo → torna alla landing
  // (non resettare se account è null fin dall'inizio — l'utente non si è ancora connesso)
  useEffect(() => {
    if (prevAccount.current && !account && role !== "none") {
      setRole("none");
    }
    prevAccount.current = account;
  }, [account, role]);

  return (
    <>
      <SettingsBar />
      {role === "none" && (
        <LandingPage
          onSelectBorrower={() => setRole("borrower")}
          onSelectLender={() => setRole("lender")}
        />
      )}
      {role === "borrower" && <BorrowerFlow onBack={() => setRole("none")} />}
      {role === "lender" && (
        <LenderFlow onBack={() => setRole("none")} initialPool={lenderSelectedPool} />
      )}
    </>
  );
}
