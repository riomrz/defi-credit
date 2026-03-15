# DefiCredit

Decentralized credit marketplace built on IOTA — portable self-sovereign credit profiles for borrowers, programmable lending pools for lenders.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Frontend · Next.js 14 · :3000                  │
│  Borrower flow (DID → Score → Marketplace → Loan)           │
│  Lender flow  (DID → Pool Dashboard → Approve/Fund)         │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────────┐
│              Backend · Next.js API routes · :3001           │
│  Risk Engine · VC Issuer · IOTA Identity · Move TX Builder  │
└──────┬───────────────┬────────────────────┬─────────────────┘
       │               │                    │
  PostgreSQL      IOTA Identity        IOTA Move VM
  (Prisma ORM)    (@iota/identity-wasm) (pool + loan contracts)
```

## Folder Structure

```
deficredit/
├── apps/
│   ├── frontend/          # Next.js 14 CSR — porta 3000
│   └── backend/           # Next.js API routes — porta 3001
├── contracts/
│   ├── pool.move          # Pool + LPPosition
│   ├── loan.move          # LoanPosition lifecycle
│   ├── Move.toml
│   └── README.md          # Istruzioni deploy IOTA CLI
├── packages/
│   ├── shared-types/      # Tipi TypeScript condivisi
│   └── iota-utils/        # Client IOTA, DID, VC helpers
├── docker/
│   └── docker-compose.yml # PostgreSQL 16
├── package.json           # pnpm workspaces root
└── .env.example           # Riferimento variabili (non editare)
```

## Prerequisites

- Node.js v20+
- pnpm v8+
- Docker Desktop
- (opzionale) IOTA CLI per deploy contratti: `cargo install --locked iota`

## Setup

### 1. Installa le dipendenze

```bash
cd deficredit
pnpm approve-builds   # approva script Prisma + esbuild
pnpm install
```

### 2. Avvia PostgreSQL

```bash
pnpm docker:up
# verifica: docker ps  →  deficredit-postgres  Up
```

### 3. Configura le variabili d'ambiente

```bash
# Backend (unico .env che serve per avviare l'app)
cp apps/backend/.env.example apps/backend/.env

# Frontend (solo variabili NEXT_PUBLIC_*)
cp apps/frontend/.env.local.example apps/frontend/.env.local
```

> **Nota**: il `.env.example` nella root è solo documentazione di riferimento.
> Il file che conta per Prisma e il backend è `apps/backend/.env`.

Valori minimi in `apps/backend/.env` per far girare l'MVP in locale:
```env
DATABASE_URL="postgresql://deficredit:deficredit@localhost:5432/deficredit"
IOTA_NODE_URL="https://api.testnet.iota.cafe"
ISSUER_DID="did:iota:tst:0xmock_issuer"
ISSUER_PRIVATE_KEY_HEX="mock_key_for_dev"
JWT_SECRET="dev_secret_min_32_chars_xxxxxxxxxx"
```

### 4. Inizializza il database

```bash
pnpm db:push    # applica lo schema Prisma al DB
pnpm db:seed    # seed delle 3 pool (Alpha, Beta, Gamma)
```

### 5. Avvia i server

```bash
pnpm dev
# Frontend → http://localhost:3000
# Backend  → http://localhost:3001
```

---

## API Endpoints

### Borrower

| Metodo | Path | Descrizione |
|--------|------|-------------|
| `POST` | `/api/score` | Calcola risk score dal DID |
| `POST` | `/api/issue-vc` | Emette RiskAttestationCredential firmata |
| `GET`  | `/api/pools/eligible?score=74&risk_band=B` | Pool compatibili |
| `POST` | `/api/loan/request` | Registra loan request + prepara tx on-chain |

### Lender

| Metodo | Path | Descrizione |
|--------|------|-------------|
| `GET`  | `/api/pools` | Tutte le pool |
| `GET`  | `/api/pool/:id/loans` | Loan pending in una pool |
| `POST` | `/api/loan/fund` | Prepara tx fund_loan |
| `POST` | `/api/loan/repay` | Registra repayment |

### Utility

| Metodo | Path | Descrizione |
|--------|------|-------------|
| `GET`  | `/api/did/resolve?did=...` | Risolve DID document |
| `POST` | `/api/vc/verify` | Verifica VC hash |

---

## Smart Contracts (IOTA Move)

Vedi [`contracts/README.md`](contracts/README.md) per le istruzioni complete di deploy su testnet.

### Deploy rapido

```bash
# Prerequisiti: wallet IOTA con fondi testnet
iota client faucet

cd contracts/
iota move build
iota client publish --gas-budget 100000000

# Dopo il deploy, copia il Package ID in apps/backend/.env:
# MOVE_PACKAGE_ID=0x<PACKAGE_ID>
```

### Crea le 3 pool on-chain

```bash
# Pool Alpha — 5.2% APR
iota client call --package $MOVE_PACKAGE_ID --module pool --function create_pool --args 520 --gas-budget 10000000

# Pool Beta — 7.8% APR
iota client call --package $MOVE_PACKAGE_ID --module pool --function create_pool --args 780 --gas-budget 10000000

# Pool Gamma — 10.5% APR
iota client call --package $MOVE_PACKAGE_ID --module pool --function create_pool --args 1050 --gas-budget 10000000
```

---

## Environment Variables

### `apps/backend/.env`

| Variabile | Descrizione | Valore default dev |
|-----------|-------------|-------------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://deficredit:deficredit@localhost:5432/deficredit` |
| `IOTA_NODE_URL` | IOTA testnet RPC | `https://api.testnet.iota.cafe` |
| `ISSUER_DID` | DID dell'issuer VC | `did:iota:tst:0x...` |
| `ISSUER_PRIVATE_KEY_HEX` | Chiave privata issuer | (hex) |
| `JWT_SECRET` | Secret JWT (min 32 char) | — |
| `MOVE_PACKAGE_ID` | Package ID contratti deployati | (dopo deploy) |

### `apps/frontend/.env.local`

| Variabile | Descrizione | Valore default dev |
|-----------|-------------|-------------------|
| `NEXT_PUBLIC_BACKEND_URL` | URL del backend | `http://localhost:3001` |
| `NEXT_PUBLIC_IOTA_NETWORK` | Network IOTA | `testnet` |

---

## Troubleshooting

**`DATABASE_URL` not found** → assicurati che `apps/backend/.env` esista e contenga la variabile.

**Docker daemon not running** → apri Docker Desktop e aspetta che l'icona sia ferma, poi riprova `pnpm docker:up`.

**Prisma client non generato** → esegui `pnpm approve-builds` poi `pnpm install`.

**Porta 3000/3001 occupata** → `lsof -ti:3000 | xargs kill` (e stessa cosa per 3001).

---

## License

MIT
