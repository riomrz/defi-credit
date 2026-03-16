"use client";
import { createContext, useContext, useState, ReactNode } from "react";

export type Lang = "en" | "it";

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

type Translations = Record<string, string>;

const en: Translations = {
  // ── Landing ──────────────────────────────────────────────────────────────
  "landing.badge": "Live on IOTA Testnet",
  "landing.hero": "Decentralized Credit Without Borders",
  "landing.subtitle":
    "Portable self-sovereign credit profiles for freelancers and SMEs. Get risk-attested with verifiable credentials and access lending pools on IOTA.",
  "landing.borrower.role": "Borrower",
  "landing.borrower.title": "Get Funded",
  "landing.borrower.desc":
    "Create your DID, get risk-attested, and apply to lending pools with your verifiable credentials.",
  "landing.lender.role": "Lender",
  "landing.lender.title": "Earn Yield",
  "landing.lender.desc":
    "Join a lending pool, review cryptographically-verified borrower credentials, and approve loans.",
  "landing.footer":
    "DefiCredit MVP — Built on IOTA · Powered by IOTA Identity & Move Smart Contracts",
  "landing.powered": "Powered by IOTA",
  "landing.features.ssi.title": "SSI-Based Identity",
  "landing.features.ssi.desc":
    "Control your credit profile with IOTA Decentralized Identifiers",
  "landing.features.vc.title": "Verifiable Credentials",
  "landing.features.vc.desc":
    "Risk attestations are portable and reusable across lending pools",
  "landing.features.chain.title": "On-Chain Settlement",
  "landing.features.chain.desc":
    "Loan agreements tokenized and settled via Move smart contracts",
  "landing.features.pool.title": "Multi-Pool Marketplace",
  "landing.features.pool.desc":
    "Compare and apply to multiple lending pools in one place",

  // ── Nav / shared UI ───────────────────────────────────────────────────────
  "nav.back": "Back",
  "nav.borrowerPortal": "Borrower Portal",
  "nav.lenderPortal": "Lender Portal",

  // ── Steps ─────────────────────────────────────────────────────────────────
  "step.connect": "Connect",
  "step.score": "Score",
  "step.apply": "Apply",
  "step.confirm": "Confirm",

  // ── DID Login ─────────────────────────────────────────────────────────────
  "did.title": "Connect your IOTA Wallet",
  "did.subtitle":
    "Your wallet generates a Decentralized Identifier (DID) that constitutes your portable credit identity on IOTA Testnet.",
  "did.walletTitle": "IOTA Wallet",
  "did.walletDesc":
    "Connect your IOTA wallet to authenticate with your DID. Your private keys never leave your device.",
  "did.connectBtn": "Connect Wallet",
  "did.testnetNote":
    "Make sure you have the IOTA wallet installed and have selected the testnet network.",
  "did.didNote":
    "Your DID is derived from your wallet address and is self-sovereign — you control it completely, without intermediaries.",
  "did.continueBtn": "Continue",

  // ── Score / Consent ───────────────────────────────────────────────────────
  "score.title": "Credit Risk Assessment",
  "score.subtitle":
    "Connect your data sources to generate your on-chain risk score",
  "score.datasources": "Data Sources",
  "score.openBanking": "Open Banking",
  "score.openBankingDesc": "Transaction history and account behavior",
  "score.taxData": "Tax Records",
  "score.taxDataDesc": "Income verification and compliance",
  "score.creditHistory": "Credit History",
  "score.creditHistoryDesc": "Traditional credit bureau data",
  "score.socialReputation": "Social Reputation",
  "score.socialReputationDesc": "DAO participation and web3 activity",
  "score.invoiceData": "Invoice Data",
  "score.invoiceDataDesc": "B2B payment history and reliability",
  "score.platformActivity": "Platform Activity",
  "score.platformActivityDesc": "Freelance and gig economy performance",
  "score.generateBtn": "Generate Risk Score & Issue VC",
  "score.generating": "Calculating score...",
  "score.yourScore": "Your Risk Score",
  "score.metrics": "Score Metrics",
  "score.issueVC": "Issue Verifiable Credential",
  "score.issuingVC": "Issuing VC...",
  "score.vcIssued": "Verifiable Credential Issued",
  "score.vcHash": "VC Hash anchored on IOTA",
  "score.continueMarketplace": "Continue to Marketplace",
  "score.vcInfo":
    "Your VC is cryptographically signed and anchored on IOTA. Lenders can verify it without accessing your raw data.",

  // ── Marketplace ───────────────────────────────────────────────────────────
  "market.title": "Eligible Lending Pools",
  "market.subtitle": "Pools matching your risk profile",
  "market.balance": "Your balance:",
  "market.simMode": "Simulation mode",
  "market.loadingPools": "Loading pools...",
  "market.noPools": "No eligible pools found",
  "market.noPoolsDesc":
    "Your current risk score doesn't qualify for any active pools.",
  "market.available": "Available",
  "market.minScore": "Min Score",
  "market.interest": "Interest",
  "market.loanRequest": "Loan Request",
  "market.loanAmount": "Loan Amount (IOTA)",
  "market.maxLabel": "Max:",
  "market.principal": "Principal",
  "market.totalDue": "Total Due",
  "market.vcInfo":
    "Your Risk VC will be attached to this request. Lenders verify it cryptographically without seeing your raw data.",
  "market.contractsInfo":
    "⚠ Contracts not deployed — request recorded off-chain only.",
  "market.submitBtn": "Submit Loan Request",
  "market.signing": "Signing Transaction...",
  "market.balanceExceeded":
    "Amount exceeds your wallet balance of {{balance}} IOTA",
  "market.term": "Repayment Term",
  "market.term1y": "1 Year",
  "market.term5y": "5 Years",
  "market.term10y": "10 Years",

  // ── Loan Confirmation ─────────────────────────────────────────────────────
  "confirm.title": "Loan Request Submitted",
  "confirm.subtitle":
    "Your request has been recorded on-chain and is pending lender approval.",
  "confirm.nftLabel": "Loan Position NFT",
  "confirm.status": "Status: Requested",
  "confirm.detailsTitle": "Request Details",
  "confirm.loanId": "Loan Request ID",
  "confirm.pool": "Pool",
  "confirm.principal": "Principal",
  "confirm.vcHash": "VC Hash",
  "confirm.txHash": "Transaction Hash",
  "confirm.explorer": "IOTA Explorer",
  "confirm.download": "Download Receipt",
  "confirm.term": "Repayment Term",
  "confirm.nextSteps": "Next Steps",
  "confirm.nextStepsDesc":
    "Lenders in {{pool}} will review your VC and vote on your loan. You'll receive on-chain notification when funded.",

  // ── Repay ─────────────────────────────────────────────────────────────────
  "repay.waitingTitle": "Waiting for Funding",
  "repay.waitingDesc": "Your loan request is pending lender approval. Check back shortly.",
  "repay.checkStatus": "Check Status",
  "repay.cancelBtn": "Cancel Loan",
  "repay.cancelling": "Cancelling...",
  "repay.cancelledTitle": "Loan Cancelled",
  "repay.cancelledDesc": "Your loan request has been cancelled. You can start a new one.",
  "repay.cancelConfirm": "Are you sure you want to cancel this loan request?",
  "repay.claimTitle": "Loan Approved — Claim Your Funds",
  "repay.claimDesc": "The lender has approved your request. Sign the on-chain transaction to receive your funds.",
  "repay.claimBtn": "Claim Funds On-Chain",
  "repay.claiming": "Signing transaction...",
  "repay.claimedDesc": "Funds received in your wallet. You can now repay.",
  "repay.fetchError": "Could not load loan details. Check the backend is running.",
  "repay.fundedTitle": "Loan Funded!",
  "repay.fundedDesc": "Your loan has been approved and the funds have been transferred to your wallet.",
  "repay.repaidTitle": "Loan Fully Repaid",
  "repay.repaidDesc": "Congratulations! You have successfully repaid this loan.",
  "repay.sectionTitle": "Repay Loan",
  "repay.outstanding": "Outstanding Balance",
  "repay.totalDue": "Total Due",
  "repay.repayAmount": "Repayment Amount (IOTA)",
  "repay.repayFull": "Repay Full Amount",
  "repay.submitBtn": "Repay Now",
  "repay.signing": "Signing Transaction...",
  "repay.successMsg": "Repayment submitted successfully!",
  "repay.fullyRepaid": "Loan fully repaid ✓",
  "repay.partialLeft": "{{balance}} IOTA remaining",
  "repay.simMode": "Simulation mode — repayment recorded off-chain only.",

  // ── Lender Flow ───────────────────────────────────────────────────────────
  "lender.title": "Lender Portal",
  "lender.subtitle":
    "Connect your IOTA wallet to access lending pools and manage liquidity",
  "lender.connectNote": "Use a different wallet from the borrower.",
  "lender.confirmBtn": "Access Dashboard",
  "lender.confirmTitle": "Ready to lend on IOTA Testnet",

  // ── Lender Dashboard ──────────────────────────────────────────────────────
  "lenderDash.title": "Lending Dashboard",
  "lenderDash.subtitle": "Review loan requests and manage your liquidity",
  "lenderDash.simBanner":
    "Simulation mode — Move contracts not deployed. Transactions are recorded off-chain only. Deploy contracts and set NEXT_PUBLIC_MOVE_PACKAGE_ID to enable real on-chain transactions.",
  "lenderDash.availLiquidity": "Available Liquidity",
  "lenderDash.utilization": "Utilization",
  "lenderDash.depositTitle": "Deposit Liquidity",
  "lenderDash.hide": "Hide",
  "lenderDash.addFunds": "Add funds",
  "lenderDash.depositAmount": "Amount (IOTA)",
  "lenderDash.use90": "Use 90% ({{amount}} IOTA)",
  "lenderDash.balanceExceeded":
    "Amount exceeds your balance of {{balance}} IOTA",
  "lenderDash.depositSimulated": "Deposit simulated (contracts not deployed)",
  "lenderDash.deposited": "Deposited!",
  "lenderDash.depositBtn": "Deposit {{amount}} IOTA into {{pool}}",
  "lenderDash.depositing": "Depositing...",
  "lenderDash.pendingRequests": "Pending Loan Requests",
  "lenderDash.noPending": "No pending requests",
  "lenderDash.noPendingDesc":
    "All loan requests for this pool have been processed.",
  "lenderDash.loadingPools": "Loading pools...",
  "lenderDash.loadingRequests": "Loading requests...",
  "lenderDash.riskScore": "Risk Score",
  "lenderDash.vcCredential": "Verifiable Credential",
  "lenderDash.vcId": "VC ID",
  "lenderDash.issuer": "Issuer",
  "lenderDash.type": "Type",
  "lenderDash.issued": "Issued",
  "lenderDash.expires": "Expires",
  "lenderDash.vcHashOnChain": "VC Hash (on-chain)",
  "lenderDash.approve": "Approve & Fund",
  "lenderDash.reject": "Reject",
  "lenderDash.signing": "Signing transaction...",
  "lenderDash.funded": "Loan funded — transaction submitted to IOTA",
  "lenderDash.rejected": "Request rejected",
  "lenderDash.iotaPrincipal": "IOTA principal",
  "lenderDash.viewTx": "View tx",
  "lenderDash.refresh": "Refresh",
  "lenderDash.noOnChainId":
    "⚠ LoanPosition not indexed — on-chain approval TX will be skipped. " +
    "The borrower's request_loan TX likely failed due to stale pool objects. " +
    "Re-run init-pools-autofund.mjs after re-deploying the contract, then ask the borrower to resubmit.",

  // ── Resume loan ───────────────────────────────────────────────────────────
  "resume.title": "Active Loan Found",
  "resume.desc": "You have an open loan request. Would you like to resume it or start a new assessment?",
  "resume.pool": "Pool",
  "resume.amount": "Amount",
  "resume.status": "Status",
  "resume.term": "Term",
  "resume.btnResume": "Resume My Loan",
  "resume.btnNew": "Start New Assessment",

  // ── Wallet Button ─────────────────────────────────────────────────────────
  "wallet.balance": "Balance",
  "wallet.did": "DID",
  "wallet.network": "Network",
  "wallet.connecting": "Connecting...",
  "wallet.disconnect": "Disconnect wallet",

  // ── Settings ──────────────────────────────────────────────────────────────
  "settings.theme": "Theme",
  "settings.dark": "Dark",
  "settings.light": "Light",
  "settings.language": "Language",
};

const it: Translations = {
  // ── Landing ───────────────────────────────────────────────────────────────
  "landing.badge": "Live su IOTA Testnet",
  "landing.hero": "Credito Decentralizzato Senza Confini",
  "landing.subtitle":
    "Profili creditizi self-sovereign portabili per freelancer e PMI. Ottieni una certificazione del rischio con credenziali verificabili e accedi a pool di prestito su IOTA.",
  "landing.borrower.role": "Mutuatario",
  "landing.borrower.title": "Ottieni Finanziamento",
  "landing.borrower.desc":
    "Crea il tuo DID, ottieni la certificazione del rischio e candidati alle pool di prestito con le tue credenziali verificabili.",
  "landing.lender.role": "Prestatore",
  "landing.lender.title": "Guadagna Rendimento",
  "landing.lender.desc":
    "Entra in una pool di prestito, verifica le credenziali dei mutuatari crittograficamente e approva i prestiti.",
  "landing.footer":
    "DefiCredit MVP — Costruito su IOTA · Alimentato da IOTA Identity e Move Smart Contracts",
  "landing.powered": "Powered by IOTA",
  "landing.features.ssi.title": "Identità SSI",
  "landing.features.ssi.desc":
    "Controlla il tuo profilo creditizio con gli Identificatori Decentralizzati IOTA",
  "landing.features.vc.title": "Credenziali Verificabili",
  "landing.features.vc.desc":
    "Le attestazioni di rischio sono portabili e riutilizzabili tra le pool di prestito",
  "landing.features.chain.title": "Liquidazione On-Chain",
  "landing.features.chain.desc":
    "Accordi di prestito tokenizzati e regolati tramite smart contract Move",
  "landing.features.pool.title": "Marketplace Multi-Pool",
  "landing.features.pool.desc":
    "Confronta e candidati a più pool di prestito in un unico posto",

  // ── Nav / shared UI ───────────────────────────────────────────────────────
  "nav.back": "Indietro",
  "nav.borrowerPortal": "Portale Mutuatario",
  "nav.lenderPortal": "Portale Prestatore",

  // ── Steps ─────────────────────────────────────────────────────────────────
  "step.connect": "Connetti",
  "step.score": "Punteggio",
  "step.apply": "Candidati",
  "step.confirm": "Conferma",

  // ── DID Login ─────────────────────────────────────────────────────────────
  "did.title": "Connetti il tuo IOTA Wallet",
  "did.subtitle":
    "Il tuo wallet genera un Decentralized Identifier (DID) che costituisce la tua identità creditizia portabile su IOTA Testnet.",
  "did.walletTitle": "IOTA Wallet",
  "did.walletDesc":
    "Connetti il tuo wallet IOTA per autenticarti con il tuo DID. Le tue chiavi private non lasciano mai il dispositivo.",
  "did.connectBtn": "Connetti Wallet",
  "did.testnetNote":
    "Assicurati di avere il wallet IOTA installato e di aver selezionato la rete testnet.",
  "did.didNote":
    "Il tuo DID è derivato dall'indirizzo del wallet ed è auto-sovrano — lo controlli tu completamente, senza intermediari.",
  "did.continueBtn": "Continua",

  // ── Score / Consent ───────────────────────────────────────────────────────
  "score.title": "Valutazione del Rischio Creditizio",
  "score.subtitle":
    "Collega le tue fonti di dati per generare il tuo punteggio di rischio on-chain",
  "score.datasources": "Fonti di Dati",
  "score.openBanking": "Open Banking",
  "score.openBankingDesc": "Cronologia delle transazioni e comportamento del conto",
  "score.taxData": "Dichiarazione Fiscale",
  "score.taxDataDesc": "Verifica del reddito e conformità fiscale",
  "score.creditHistory": "Storico Creditizio",
  "score.creditHistoryDesc": "Dati tradizionali del bureau creditizio",
  "score.socialReputation": "Reputazione Social",
  "score.socialReputationDesc": "Partecipazione DAO e attività web3",
  "score.invoiceData": "Dati Fatture",
  "score.invoiceDataDesc": "Cronologia pagamenti B2B e affidabilità",
  "score.platformActivity": "Attività Piattaforma",
  "score.platformActivityDesc": "Performance nel lavoro freelance e gig economy",
  "score.generateBtn": "Calcola Punteggio di Rischio ed Emetti VC",
  "score.generating": "Calcolo del punteggio in corso...",
  "score.yourScore": "Il Tuo Punteggio",
  "score.metrics": "Metriche del Punteggio",
  "score.issueVC": "Emetti Credenziale Verificabile",
  "score.issuingVC": "Emissione VC...",
  "score.vcIssued": "Credenziale Verificabile Emessa",
  "score.vcHash": "VC Hash ancorato su IOTA",
  "score.continueMarketplace": "Continua al Marketplace",
  "score.vcInfo":
    "La tua VC è firmata crittograficamente e ancorata su IOTA. I prestatori possono verificarla senza accedere ai tuoi dati grezzi.",

  // ── Marketplace ───────────────────────────────────────────────────────────
  "market.title": "Pool di Prestito Idonee",
  "market.subtitle": "Pool in linea con il tuo profilo di rischio",
  "market.balance": "Il tuo saldo:",
  "market.simMode": "Modalità simulazione",
  "market.loadingPools": "Caricamento pool...",
  "market.noPools": "Nessuna pool idonea trovata",
  "market.noPoolsDesc":
    "Il tuo punteggio di rischio attuale non qualifica per nessuna pool attiva.",
  "market.available": "Disponibile",
  "market.minScore": "Punteggio Min",
  "market.interest": "Interesse",
  "market.loanRequest": "Richiesta di Prestito",
  "market.loanAmount": "Importo Prestito (IOTA)",
  "market.maxLabel": "Max:",
  "market.principal": "Capitale",
  "market.totalDue": "Totale Dovuto",
  "market.vcInfo":
    "La tua VC di Rischio sarà allegata a questa richiesta. I prestatori la verificano crittograficamente senza vedere i tuoi dati grezzi.",
  "market.contractsInfo":
    "⚠ Contratti non deployati — richiesta registrata solo off-chain.",
  "market.submitBtn": "Invia Richiesta di Prestito",
  "market.signing": "Firma della transazione...",
  "market.balanceExceeded":
    "L'importo supera il saldo del tuo wallet di {{balance}} IOTA",
  "market.term": "Durata del Prestito",
  "market.term1y": "1 Anno",
  "market.term5y": "5 Anni",
  "market.term10y": "10 Anni",

  // ── Loan Confirmation ─────────────────────────────────────────────────────
  "confirm.title": "Richiesta di Prestito Inviata",
  "confirm.subtitle":
    "La tua richiesta è stata registrata on-chain ed è in attesa dell'approvazione del prestatore.",
  "confirm.nftLabel": "Loan Position NFT",
  "confirm.status": "Stato: Richiesto",
  "confirm.detailsTitle": "Dettagli della Richiesta",
  "confirm.loanId": "ID Richiesta Prestito",
  "confirm.pool": "Pool",
  "confirm.principal": "Capitale",
  "confirm.vcHash": "VC Hash",
  "confirm.txHash": "Hash Transazione",
  "confirm.explorer": "IOTA Explorer",
  "confirm.download": "Scarica Ricevuta",
  "confirm.term": "Durata del Prestito",
  "confirm.nextSteps": "Prossimi Passi",
  "confirm.nextStepsDesc":
    "I prestatori in {{pool}} verificheranno la tua VC e voteranno sul tuo prestito. Riceverai una notifica on-chain quando sarà finanziato.",

  // ── Repay ─────────────────────────────────────────────────────────────────
  "repay.waitingTitle": "In Attesa di Finanziamento",
  "repay.waitingDesc": "La tua richiesta di prestito è in attesa di approvazione. Ricontrolla tra poco.",
  "repay.checkStatus": "Controlla Stato",
  "repay.cancelBtn": "Annulla Prestito",
  "repay.cancelling": "Annullamento...",
  "repay.cancelledTitle": "Prestito Annullato",
  "repay.cancelledDesc": "La tua richiesta di prestito è stata annullata. Puoi iniziarne una nuova.",
  "repay.cancelConfirm": "Sei sicuro di voler annullare questa richiesta di prestito?",
  "repay.claimTitle": "Prestito Approvato — Ricevi i Fondi",
  "repay.claimDesc": "Il prestatore ha approvato la tua richiesta. Firma la transazione on-chain per ricevere i fondi.",
  "repay.claimBtn": "Ricevi Fondi On-Chain",
  "repay.claiming": "Firma della transazione...",
  "repay.claimedDesc": "Fondi ricevuti nel tuo wallet. Ora puoi rimborsare.",
  "repay.fetchError": "Impossibile caricare i dettagli del prestito. Verifica che il backend sia attivo.",
  "repay.fundedTitle": "Prestito Finanziato!",
  "repay.fundedDesc": "Il tuo prestito è stato approvato e i fondi sono stati trasferiti nel tuo wallet.",
  "repay.repaidTitle": "Prestito Completamente Rimborsato",
  "repay.repaidDesc": "Complimenti! Hai rimborsato questo prestito con successo.",
  "repay.sectionTitle": "Rimborsa Prestito",
  "repay.outstanding": "Saldo Residuo",
  "repay.totalDue": "Totale Dovuto",
  "repay.repayAmount": "Importo Rimborso (IOTA)",
  "repay.repayFull": "Rimborsa Intero Importo",
  "repay.submitBtn": "Rimborsa Ora",
  "repay.signing": "Firma della transazione...",
  "repay.successMsg": "Rimborso inviato con successo!",
  "repay.fullyRepaid": "Prestito completamente rimborsato ✓",
  "repay.partialLeft": "{{balance}} IOTA rimanenti",
  "repay.simMode": "Modalità simulazione — rimborso registrato solo off-chain.",

  // ── Lender Flow ───────────────────────────────────────────────────────────
  "lender.title": "Portale Prestatore",
  "lender.subtitle":
    "Connetti il tuo wallet IOTA per accedere alle pool di prestito e gestire la liquidità",
  "lender.connectNote": "Usa un wallet diverso da quello del mutuatario.",
  "lender.confirmBtn": "Accedi alla Dashboard",
  "lender.confirmTitle": "Pronto a prestare su IOTA Testnet",

  // ── Lender Dashboard ──────────────────────────────────────────────────────
  "lenderDash.title": "Dashboard Prestatore",
  "lenderDash.subtitle": "Esamina le richieste di prestito e gestisci la tua liquidità",
  "lenderDash.simBanner":
    "Modalità simulazione — Contratti Move non deployati. Le transazioni vengono registrate solo off-chain. Deploya i contratti e imposta NEXT_PUBLIC_MOVE_PACKAGE_ID per abilitare le transazioni on-chain reali.",
  "lenderDash.availLiquidity": "Liquidità Disponibile",
  "lenderDash.utilization": "Utilizzo",
  "lenderDash.depositTitle": "Deposita Liquidità",
  "lenderDash.hide": "Nascondi",
  "lenderDash.addFunds": "Aggiungi fondi",
  "lenderDash.depositAmount": "Importo (IOTA)",
  "lenderDash.use90": "Usa il 90% ({{amount}} IOTA)",
  "lenderDash.balanceExceeded":
    "L'importo supera il tuo saldo di {{balance}} IOTA",
  "lenderDash.depositSimulated": "Deposito simulato (contratti non deployati)",
  "lenderDash.deposited": "Depositato!",
  "lenderDash.depositBtn": "Deposita {{amount}} IOTA in {{pool}}",
  "lenderDash.depositing": "Deposito in corso...",
  "lenderDash.pendingRequests": "Richieste di Prestito in Attesa",
  "lenderDash.noPending": "Nessuna richiesta in attesa",
  "lenderDash.noPendingDesc":
    "Tutte le richieste di prestito per questa pool sono state elaborate.",
  "lenderDash.loadingPools": "Caricamento pool...",
  "lenderDash.loadingRequests": "Caricamento richieste...",
  "lenderDash.riskScore": "Punteggio di Rischio",
  "lenderDash.vcCredential": "Credenziale Verificabile",
  "lenderDash.vcId": "ID VC",
  "lenderDash.issuer": "Emittente",
  "lenderDash.type": "Tipo",
  "lenderDash.issued": "Emessa",
  "lenderDash.expires": "Scade",
  "lenderDash.vcHashOnChain": "VC Hash (on-chain)",
  "lenderDash.approve": "Approva e Finanzia",
  "lenderDash.reject": "Rifiuta",
  "lenderDash.signing": "Firma della transazione...",
  "lenderDash.funded": "Prestito finanziato — transazione inviata a IOTA",
  "lenderDash.rejected": "Richiesta rifiutata",
  "lenderDash.iotaPrincipal": "Capitale in IOTA",
  "lenderDash.viewTx": "Vedi tx",
  "lenderDash.refresh": "Aggiorna",
  "lenderDash.noOnChainId":
    "⚠ LoanPosition non indicizzato — la TX di approvazione on-chain verrà saltata. " +
    "La TX request_loan del borrower è probabilmente fallita per pool non aggiornate. " +
    "Riesegui init-pools-onchain.ts dopo il re-deploy, poi chiedi al borrower di reinviare la richiesta.",

  // ── Resume loan ───────────────────────────────────────────────────────────
  "resume.title": "Prestito Attivo Trovato",
  "resume.desc": "Hai una richiesta di prestito aperta. Vuoi riprenderla o iniziare una nuova valutazione?",
  "resume.pool": "Pool",
  "resume.amount": "Importo",
  "resume.status": "Stato",
  "resume.term": "Durata",
  "resume.btnResume": "Riprendi il Mio Prestito",
  "resume.btnNew": "Inizia Nuova Valutazione",

  // ── Wallet Button ─────────────────────────────────────────────────────────
  "wallet.balance": "Saldo",
  "wallet.did": "DID",
  "wallet.network": "Rete",
  "wallet.connecting": "Connessione...",
  "wallet.disconnect": "Disconnetti wallet",

  // ── Settings ──────────────────────────────────────────────────────────────
  "settings.theme": "Tema",
  "settings.dark": "Scuro",
  "settings.light": "Chiaro",
  "settings.language": "Lingua",
};

const dict: Record<Lang, Translations> = { en, it };

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translate a key with optional interpolation: t("key", { name: "Alice" }) */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "it",
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("it");

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str = dict[lang][key] ?? dict.en[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replaceAll(`{{${k}}}`, String(v));
      });
    }
    return str;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useT = () => useContext(I18nContext);
