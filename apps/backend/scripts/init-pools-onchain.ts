/**
 * Script: init-pools-onchain.ts
 *
 * Crea i 3 pool su IOTA testnet chiamando pool::create_pool
 * e aggiorna il DB con i veri on_chain_id.
 *
 * Prerequisiti:
 *   1. Contratti deployati → MOVE_PACKAGE_ID nel .env
 *   2. Backend DB attivo → DATABASE_URL nel .env
 *   3. Un keypair IOTA con fondi per il gas (l'admin della pool)
 *
 * Uso:
 *   cd deficredit
 *   cp apps/backend/.env .env          # oppure export le variabili
 *   pnpm tsx scripts/init-pools-onchain.ts
 */

import { IotaClient, getFullnodeUrl } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import { PrismaClient } from "@prisma/client";

// ── Config ────────────────────────────────────────────────────────────────────

const PACKAGE_ID = process.env.MOVE_PACKAGE_ID ?? process.env.NEXT_PUBLIC_MOVE_PACKAGE_ID ?? "";
const MNEMONIC   = process.env.ADMIN_MNEMONIC ?? "";   // 24-word mnemonic del wallet admin
const NETWORK    = (process.env.IOTA_NETWORK ?? "testnet") as "testnet" | "devnet" | "mainnet";

if (!PACKAGE_ID) throw new Error("MOVE_PACKAGE_ID non impostato nel .env");
if (!MNEMONIC)   throw new Error("ADMIN_MNEMONIC non impostato nel .env (frase mnemonica 24 parole)");

// ── Pool definitions (devono corrispondere ai record del seed) ───────────────
// Usiamo il nome per trovare il record nel DB, così lo script è idempotente
// anche se era già stato eseguito con l'ID sbagliato.

const POOLS = [
  { dbName: "Alpha Pool", interestRateBps: 520  },
  { dbName: "Beta Pool",  interestRateBps: 780  },
  { dbName: "Gamma Pool", interestRateBps: 1050 },
];

// Tipo esatto del Pool object Move (usato per non confondere Pool con PoolAdminCap)
const POOL_TYPE = `${PACKAGE_ID}::pool::Pool`;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client  = new IotaClient({ url: getFullnodeUrl(NETWORK) });
  const keypair = Ed25519Keypair.deriveKeypair(MNEMONIC);
  const prisma  = new PrismaClient();
  const sender  = keypair.getPublicKey().toIotaAddress();

  console.log(`Network : ${NETWORK}`);
  console.log(`Admin   : ${sender}`);
  console.log(`Package : ${PACKAGE_ID}\n`);

  for (const pool of POOLS) {
    console.log(`Creando pool "${pool.dbName}" (${pool.interestRateBps} bps)...`);

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::pool::create_pool`,
      arguments: [tx.pure.u64(BigInt(pool.interestRateBps))],
    });
    tx.setSender(sender);

    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showObjectChanges: true },
    });

    await client.waitForTransaction({ digest: result.digest });
    console.log(`    TX: ${result.digest}`);

    // Debug: mostra tutti gli oggetti creati nella TX
    const created = result.objectChanges?.filter((c) => c.type === "created") ?? [];
    console.log(`    Oggetti creati nella TX:`);
    for (const obj of created) {
      if ("objectId" in obj && "objectType" in obj) {
        console.log(`      ${obj.objectType}  →  ${obj.objectId}`);
      }
    }

    // Trova il Pool con match ESATTO del tipo (evita di confonderlo con PoolAdminCap)
    const poolObj = created.find(
      (c) => "objectType" in c && c.objectType === POOL_TYPE
    );

    if (!poolObj || !("objectId" in poolObj)) {
      console.error(`  ✗ Oggetto Pool (${POOL_TYPE}) non trovato nella TX.`);
      console.error(`    Verifica che PACKAGE_ID sia corretto: ${PACKAGE_ID}`);
      continue;
    }

    const realOnChainId = poolObj.objectId;
    console.log(`  ✓ Pool (shared object): ${realOnChainId}`);

    // Aggiorna il DB cercando per nome (idempotente anche dopo esecuzioni precedenti)
    const updated = await prisma.pool.updateMany({
      where: { name: pool.dbName },
      data:  { onChainId: realOnChainId },
    });
    if (updated.count === 0) {
      console.warn(`  ⚠ Nessun record DB trovato con name="${pool.dbName}". Aggiornamento saltato.`);
    } else {
      console.log(`  ✓ DB aggiornato: "${pool.dbName}" → onChainId = ${realOnChainId}\n`);
    }
  }

  await prisma.$disconnect();
  console.log("Done! Tutti i pool sono stati creati on-chain e il DB è aggiornato.");
  console.log("\nAggiungi anche le variabili al .env del backend se necessario.");
}

main().catch((e) => { console.error(e); process.exit(1); });
