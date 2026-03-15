/**
 * Plain JS version of init-pools-onchain — no TypeScript/esbuild required.
 * Run with: node scripts/init-pools-onchain.mjs
 */
import { IotaClient, getFullnodeUrl } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import { PrismaClient } from "@prisma/client";

const PACKAGE_ID = process.env.MOVE_PACKAGE_ID ?? process.env.NEXT_PUBLIC_MOVE_PACKAGE_ID ?? "";
const MNEMONIC   = process.env.ADMIN_MNEMONIC ?? "";
const NETWORK    = process.env.IOTA_NETWORK ?? "testnet";

if (!PACKAGE_ID) throw new Error("MOVE_PACKAGE_ID non impostato nel .env");
if (!MNEMONIC)   throw new Error("ADMIN_MNEMONIC non impostato nel .env");

const POOLS = [
  { dbName: "Alpha Pool", interestRateBps: 520  },
  { dbName: "Beta Pool",  interestRateBps: 780  },
  { dbName: "Gamma Pool", interestRateBps: 1050 },
];

const POOL_TYPE = `${PACKAGE_ID}::pool::Pool`;

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

    const created = result.objectChanges?.filter((c) => c.type === "created") ?? [];
    console.log(`    Oggetti creati:`);
    for (const obj of created) {
      if ("objectId" in obj && "objectType" in obj) {
        console.log(`      ${obj.objectType}  →  ${obj.objectId}`);
      }
    }

    const poolObj = created.find(
      (c) => "objectType" in c && c.objectType === POOL_TYPE
    );

    if (!poolObj || !("objectId" in poolObj)) {
      console.error(`  ✗ Pool (${POOL_TYPE}) non trovato nella TX.`);
      continue;
    }

    const realOnChainId = poolObj.objectId;
    console.log(`  ✓ Pool (shared object): ${realOnChainId}`);

    const updated = await prisma.pool.updateMany({
      where: { name: pool.dbName },
      data:  { onChainId: realOnChainId },
    });
    if (updated.count === 0) {
      console.warn(`  ⚠ Nessun record DB trovato con name="${pool.dbName}".`);
    } else {
      console.log(`  ✓ DB aggiornato: "${pool.dbName}" → onChainId = ${realOnChainId}\n`);
    }
  }

  await prisma.$disconnect();
  console.log("Done! Pool create on-chain e DB aggiornato.");
}

main().catch((e) => { console.error(e); process.exit(1); });
