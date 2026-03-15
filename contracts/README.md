# DefiCredit Smart Contracts

## Prerequisites

- IOTA CLI installed: `cargo install --locked iota`
- Active testnet wallet with funds
- Testnet faucet: https://faucet.testnet.iota.cafe

## Setup

1. Initialize wallet (if not done):

```bash
iota client new-address ed25519
iota client switch --address <YOUR_ADDRESS>
```

2. Fund wallet from faucet:

```bash
iota client faucet
```

3. Check balance:

```bash
iota client balance
```

## Build & Deploy

```bash
cd contracts/

# Build
iota move build

# Test
iota move test

# Deploy to testnet
iota client publish --gas-budget 100000000
```

After deployment, note the Package ID from the output and update your .env:

```
MOVE_PACKAGE_ID=0x<PACKAGE_ID>
```

## Create Pools

After deploying, launch the script init-pools-onchain.ts.
It creates the 3 pools:

```bash
# Pool Alpha (5.2% APR, min score 80)
iota client call \
  --package $MOVE_PACKAGE_ID \
  --module pool \
  --function create_pool \
  --args 520 \
  --gas-budget 10000000

# Pool Beta (7.8% APR, min score 65)
iota client call \
  --package $MOVE_PACKAGE_ID \
  --module pool \
  --function create_pool \
  --args 780 \
  --gas-budget 10000000

# Pool Gamma (10.5% APR, min score 50)
iota client call \
  --package $MOVE_PACKAGE_ID \
  --module pool \
  --function create_pool \
  --args 1050 \
  --gas-budget 10000000
```

Update .env with the returned Pool Object IDs.

## Deposit Initial Liquidity

```bash
iota client call \
  --package $MOVE_PACKAGE_ID \
  --module pool \
  --function deposit_liquidity \
  --args <POOL_OBJECT_ID> <COIN_OBJECT_ID> \
  --gas-budget 10000000
```

## Contract Architecture

```
pool.move
├── Pool (shared object) — holds Balance<IOTA>, interest_rate_bps
├── LPPosition (owned NFT) — represents lender's share
├── PoolAdminCap — admin capability
├── create_pool() — creates new pool
├── deposit_liquidity() — LP deposits IOTA, gets LPPosition NFT
├── withdraw_liquidity() — LP redeems position
├── withdraw_for_loan() — internal, called by loan module
└── receive_repayment() — internal, called by loan module

loan.move
├── LoanPosition (owned NFT) — represents loan agreement
├── request_loan() — borrower requests, stores VC hash
├── fund_loan() — lender approves, transfers principal
└── repay_loan() — borrower repays, updates balance
```
