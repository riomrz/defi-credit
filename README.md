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
│   ├── frontend/          # Next.js 14 CSR — port 3000
│   └── backend/           # Next.js API routes — port 3001
├── contracts/
│   ├── pool.move          # Pool + LPPosition
│   ├── loan.move          # LoanPosition lifecycle
│   ├── Move.toml
│   └── README.md          # IOTA CLI deploy instructions
├── packages/
│   ├── shared-types/      # Shared TypeScript types
│   └── iota-utils/        # IOTA client, DID, VC helpers
├── docker/
│   └── docker-compose.yml # PostgreSQL 16
├── package.json           # pnpm workspaces root
└── .env.example           # Variable reference (do not edit)
```

## Prerequisites

- Node.js v20+
- pnpm v8+
- Docker Desktop
- (optional) IOTA CLI for contract deployment: `cargo install --locked iota`

## Setup

### 1. Install dependencies

```bash
cd deficredit
pnpm approve-builds   # approve Prisma + esbuild scripts
pnpm install
```

### 2. Start PostgreSQL

```bash
pnpm docker:up
# verify: docker ps  →  deficredit-postgres  Up
```

### 3. Configure environment variables

```bash
# Backend (the only .env needed to run the app)
cp apps/backend/.env.example apps/backend/.env

# Frontend (only NEXT_PUBLIC_* variables)
cp apps/frontend/.env.local.example apps/frontend/.env.local
```

> **Note**: the `.env.example` in the root is for reference only.
> The file that matters for Prisma and the backend is `apps/backend/.env`.

Minimum values in `apps/backend/.env` to run the MVP locally:
```env
DATABASE_URL="postgresql://deficredit:deficredit@localhost:5432/deficredit"
IOTA_NODE_URL="https://api.testnet.iota.cafe"
ISSUER_DID="did:iota:tst:0xmock_issuer"
ISSUER_PRIVATE_KEY_HEX="mock_key_for_dev"
JWT_SECRET="dev_secret_min_32_chars_xxxxxxxxxx"
```

### 4. Initialize the database

```bash
pnpm db:push    # apply the Prisma schema to the DB
pnpm db:seed    # seed the 3 pools (Alpha, Beta, Gamma)
```

### 5. Start the servers

```bash
pnpm dev
# Frontend → http://localhost:3000
# Backend  → http://localhost:3001
```

---

## API Endpoints

### Borrower

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/score` | Calculate risk score from DID |
| `POST` | `/api/issue-vc` | Issue a signed RiskAttestationCredential |
| `GET`  | `/api/pools/eligible?score=74&risk_band=B` | Eligible pools for the given score |
| `POST` | `/api/loan/request` | Register loan request + prepare on-chain tx |

### Lender

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/pools` | All pools |
| `GET`  | `/api/pool/:id/loans` | Pending loans in a pool |
| `POST` | `/api/loan/fund` | Prepare fund_loan tx |
| `POST` | `/api/loan/repay` | Register repayment |

### Utility

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/did/resolve?did=...` | Resolve a DID document |
| `POST` | `/api/vc/verify` | Verify a VC hash |

---

## Smart Contracts (IOTA Move)

See [`contracts/README.md`](contracts/README.md) for full testnet deployment instructions.

### Quick deploy

```bash
# Prerequisites: IOTA wallet with testnet funds
iota client faucet

cd contracts/
iota move build
iota client publish --gas-budget 100000000

# After deployment, copy the Package ID into apps/backend/.env:
# MOVE_PACKAGE_ID=0x<PACKAGE_ID>
```

### Create the 3 on-chain pools

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

| Variable | Description | Default (dev) |
|----------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://deficredit:deficredit@localhost:5432/deficredit` |
| `IOTA_NODE_URL` | IOTA testnet RPC | `https://api.testnet.iota.cafe` |
| `ISSUER_DID` | VC issuer DID | `did:iota:tst:0x...` |
| `ISSUER_PRIVATE_KEY_HEX` | Issuer private key | (hex) |
| `JWT_SECRET` | JWT secret (min 32 chars) | — |
| `MOVE_PACKAGE_ID` | Deployed contract package ID | (after deployment) |

### `apps/frontend/.env.local`

| Variable | Description | Default (dev) |
|----------|-------------|---------------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend URL | `http://localhost:3001` |
| `NEXT_PUBLIC_IOTA_NETWORK` | IOTA network | `testnet` |

---

## Troubleshooting

**`DATABASE_URL` not found** → make sure `apps/backend/.env` exists and contains the variable.

**Docker daemon not running** → open Docker Desktop and wait for the icon to settle, then retry `pnpm docker:up`.

**Prisma client not generated** → run `pnpm approve-builds` then `pnpm install`.

**Port 3000/3001 already in use** → `lsof -ti:3000 | xargs kill` (same for 3001).

---

## License

MIT
