/**
 * init-pools-autofund.mjs
 *
 * Legge il keypair dalla CLI IOTA locale (~/.iota/iota_config/iota.keystore)
 * — lo stesso wallet usato per `iota client publish`.
 * Crea i 3 Pool on-chain e aggiorna il DB.
 *
 * Uso (dalla cartella apps/backend):
 *   node scripts/init-pools-autofund.mjs
 *
 * NON serve più fare `export $(cat .env | xargs)` — lo script carica
 * il .env da solo, gestendo correttamente i valori con spazi (es. mnemonic).
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

// ─── Carica .env manualmente (evita che xargs spezzi i valori con spazi) ────
(function loadEnv() {
  const envPath = new URL("../.env", import.meta.url).pathname;
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Rimuove le virgolette esterne (" o ') se presenti
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Il .env sovrascrive sempre (evita valori corrotti da `export $(xargs)`)
    process.env[key] = val;
  }
})();
import { homedir }      from "os";
import { join }         from "path";
import { createRequire } from "module";
import { IotaClient, getFullnodeUrl }                    from "@iota/iota-sdk/client";
import { requestIotaFromFaucetV0, requestIotaFromFaucetV1 } from "@iota/iota-sdk/faucet";
import { Ed25519Keypair }                                from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction }                                   from "@iota/iota-sdk/transactions";
import { PrismaClient }                                  from "@prisma/client";

// Risolve @scure/bip39 dal percorso pnpm (dipendenza transitiva dell'iota-sdk)
async function loadBip39() {
  try {
    // Prova prima la risoluzione normale (monorepo con hoisting)
    const req = createRequire(import.meta.url);
    const bip39 = req("@scure/bip39");
    const wl    = req("@scure/bip39/wordlists/english");
    return { generateMnemonic: bip39.generateMnemonic, wordlist: wl.wordlist ?? wl };
  } catch {
    // Fallback: percorso diretto nel pnpm store
    try {
      const base = join(homedir(), ".pnpm"); // potrebbe non esistere
      // Cerca nel node_modules del monorepo
      const candidates = [
        "../../node_modules/.pnpm/@scure+bip39@1.6.0/node_modules/@scure/bip39/index.js",
        "../../../node_modules/.pnpm/@scure+bip39@1.6.0/node_modules/@scure/bip39/index.js",
        "../../../../node_modules/.pnpm/@scure+bip39@1.6.0/node_modules/@scure/bip39/index.js",
      ];
      const wlCandidates = candidates.map(c => c.replace("index.js", "wordlists/english.js"));

      for (let i = 0; i < candidates.length; i++) {
        const absPath = new URL(candidates[i], import.meta.url).pathname;
        const absWl   = new URL(wlCandidates[i], import.meta.url).pathname;
        if (!existsSync(absPath)) continue;
        const { default: bip39 } = await import(absPath);
        const wlMod = await import(absWl);
        const wordlist = wlMod.wordlist ?? wlMod.default?.wordlist ?? wlMod.default;
        return { generateMnemonic: bip39.generateMnemonic, wordlist };
      }
    } catch {}
  }
  return null;
}

const PACKAGE_ID = process.env.MOVE_PACKAGE_ID
  ?? process.env.NEXT_PUBLIC_MOVE_PACKAGE_ID
  ?? "";
const NETWORK = process.env.IOTA_NETWORK ?? "testnet";

if (!PACKAGE_ID) throw new Error("MOVE_PACKAGE_ID non impostato nel .env");

const POOLS = [
  { dbName: "Alpha Pool", interestRateBps: 520  },
  { dbName: "Beta Pool",  interestRateBps: 780  },
  { dbName: "Gamma Pool", interestRateBps: 1050 },
];

const POOL_TYPE = `${PACKAGE_ID}::pool::Pool`;

/**
 * Carica il keypair dall'IOTA CLI keystore locale.
 * Il keystore è un array JSON di chiavi base64 (stesso formato di Sui).
 * Il primo byte di ogni chiave è il flag dello schema (0 = Ed25519).
 * Restituisce { keypair, privateKeyHex } — la mnemonic non è recuperabile da chiave grezza.
 */
function loadKeypairFromIotaCliKeystore() {
  // Prova prima IOTA keystore, poi Sui come fallback
  const candidates = [
    join(homedir(), ".iota",  "iota_config", "iota.keystore"),
    join(homedir(), ".sui",   "sui_config",  "sui.keystore"),
  ];

  for (const keystorePath of candidates) {
    try {
      const raw = readFileSync(keystorePath, "utf8");
      const keys = JSON.parse(raw);
      if (!Array.isArray(keys) || keys.length === 0) continue;

      // Il primo byte è il flag schema (0x00 = Ed25519), i restanti 32 byte sono la chiave privata.
      const decoded    = Buffer.from(keys[0], "base64");
      const secretKey  = decoded.slice(1);
      const keypair    = Ed25519Keypair.fromSecretKey(secretKey);
      const privateKeyHex = secretKey.toString("hex");
      console.log(`  ✓ Keypair caricato da: ${keystorePath}`);
      return { keypair, privateKeyHex, source: "keystore" };
    } catch {
      // Prova il prossimo
    }
  }
  return null;
}

async function main() {
  const client = new IotaClient({ url: getFullnodeUrl(NETWORK) });
  const prisma = new PrismaClient();

  let keypair      = null;
  let mnemonic     = null;
  let privateKeyHex = null;
  let walletSource = "";

  // 1) Prova il keystore CLI IOTA/Sui
  const ksResult = loadKeypairFromIotaCliKeystore();
  if (ksResult) {
    keypair       = ksResult.keypair;
    privateKeyHex = ksResult.privateKeyHex;
    walletSource  = "keystore";
  }

  // 2) Fallback: ADMIN_MNEMONIC dal .env
  if (!keypair) {
    const envMnemonic = process.env.ADMIN_MNEMONIC ?? "";
    const placeholder = "monkey indoor calm food border school sugar pattern frame pony rebel crystal";
    if (envMnemonic && envMnemonic !== placeholder) {
      // Derivation paths più comuni per wallet IOTA/Sui/EVM
      const PATHS = [
        { path: "m/44'/4218'/0'/0'/0'", label: "IOTA standard (default SDK)" },
        { path: "m/44'/4218'/0'/0'/1'", label: "IOTA account 1" },
        { path: "m/44'/784'/0'/0'/0'",  label: "Sui standard" },
        { path: "m/44'/784'/0'/0'/1'",  label: "Sui account 1" },
        { path: "m/44'/4218'/0'",        label: "IOTA short path" },
      ];

      console.log("\n  Indirizzi derivati dalla mnemonic (trova quello del tuo wallet):");
      const derivedList = [];
      for (const { path, label } of PATHS) {
        try {
          const kp   = Ed25519Keypair.deriveKeypair(envMnemonic, path);
          const addr = kp.getPublicKey().toIotaAddress();
          console.log(`    [${label}]`);
          console.log(`      path   : ${path}`);
          console.log(`      address: ${addr}`);
          derivedList.push({ path, label, kp, addr });
        } catch { /* path non supportato, salta */ }
      }

      // Usa il path specificato in .env oppure il primo che ha saldo
      const forcedPath = process.env.ADMIN_DERIVATION_PATH ?? null;
      if (forcedPath) {
        const found = derivedList.find(d => d.path === forcedPath);
        if (found) {
          keypair      = found.kp;
          mnemonic     = envMnemonic;
          walletSource = `ADMIN_MNEMONIC (.env) — path: ${forcedPath}`;
          console.log(`\n  ✓ Usando path forzato da ADMIN_DERIVATION_PATH: ${forcedPath}`);
        } else {
          console.warn(`  ⚠ ADMIN_DERIVATION_PATH "${forcedPath}" non valido, uso default.`);
        }
      }

      if (!keypair && derivedList.length > 0) {
        // Default: primo path (IOTA standard)
        keypair      = derivedList[0].kp;
        mnemonic     = envMnemonic;
        walletSource = `ADMIN_MNEMONIC (.env) — path: ${derivedList[0].path}`;
        console.log(`\n  ✓ Keypair caricato da ADMIN_MNEMONIC nel .env (path: ${derivedList[0].path})`);
        console.log(`  ℹ Se il tuo wallet usa un indirizzo diverso, aggiungi al .env:`);
        console.log(`    ADMIN_DERIVATION_PATH=<path corretto dalla lista sopra>\n`);
      }
    } else if (!envMnemonic) {
      console.warn("  ⚠ ADMIN_MNEMONIC non impostato nel .env");
    } else {
      console.warn("  ⚠ ADMIN_MNEMONIC è ancora il placeholder, verrà generata una nuova mnemonic");
    }
  }

  // 3) Ultimo fallback: genera nuovo keypair da mnemonic BIP39
  if (!keypair) {
    const bip39 = await loadBip39();
    if (bip39) {
      mnemonic  = bip39.generateMnemonic(bip39.wordlist);
      keypair   = Ed25519Keypair.deriveKeypair(mnemonic);
      walletSource = "mnemonic generata (NUOVA)";
      console.log("  ✓ Nuovo keypair generato da mnemonic BIP39");
    } else {
      // Fallback estremo: keypair casuale (nessuna mnemonic)
      keypair      = new Ed25519Keypair();
      walletSource = "random (nessuna mnemonic)";
      console.warn("  ⚠ bip39 non disponibile — keypair casuale, NON importabile nel wallet");
    }
  }

  const sender = keypair.getPublicKey().toIotaAddress();

  console.log("═══════════════════════════════════════════════════");
  console.log(`Network  : ${NETWORK}`);
  console.log(`Package  : ${PACKAGE_ID}`);
  console.log(`Wallet   : ${walletSource}`);
  console.log(`Indirizzo: ${sender}`);

  // Stampa credenziali solo se il wallet è NUOVO (da generazione automatica)
  if (mnemonic && walletSource.includes("NUOVA")) {
    console.log("\n┌─────────────────────────────────────────────────┐");
    console.log("│  🔑  MNEMONIC PHRASE (12 parole) — SALVALA!     │");
    console.log("├─────────────────────────────────────────────────┤");
    console.log(`│  ${mnemonic.padEnd(49)}│`);
    console.log("└─────────────────────────────────────────────────┘");
    console.log("  → Importa queste 12 parole nell'estensione IOTA Chrome");
    console.log("  → poi finanzia l'indirizzo sopra dal faucet o dall'estensione");
    // Salva la mnemonic nel .env per riusi futuri
    try {
      const envPath = new URL("../.env", import.meta.url).pathname;
      if (existsSync(envPath)) {
        let envContent = readFileSync(envPath, "utf8");
        if (envContent.includes("ADMIN_MNEMONIC=")) {
          envContent = envContent.replace(/ADMIN_MNEMONIC=.*/g, `ADMIN_MNEMONIC="${mnemonic}"`);
        } else {
          envContent += `\nADMIN_MNEMONIC="${mnemonic}"\n`;
        }
        writeFileSync(envPath, envContent);
        console.log("  ✓ Mnemonic salvata in apps/backend/.env (ADMIN_MNEMONIC)");
      }
    } catch { /* non critico */ }
  } else if (privateKeyHex) {
    console.log("\n┌─────────────────────────────────────────────────────────────────┐");
    console.log("│  🔑  CHIAVE PRIVATA (hex) — Wallet caricato dal keystore CLI     │");
    console.log("├─────────────────────────────────────────────────────────────────┤");
    console.log(`│  ${privateKeyHex}  │`);
    console.log("└─────────────────────────────────────────────────────────────────┘");
    console.log("  ℹ Il keystore CLI salva chiavi grezze — la mnemonic originale non");
    console.log("    è recuperabile. Puoi importare la chiave privata hex in Bloom wallet");
    console.log("    (Settings → Profiles → Import → Private key) oppure finanziare");
    console.log("    direttamente l'indirizzo dal faucet:");
    console.log("    https://faucet.testnet.iota.cafe");
  }

  console.log("═══════════════════════════════════════════════════\n");

  // Verifica saldo — se zero, tenta il faucet automaticamente
  const FAUCET_HOST = "https://faucet.testnet.iota.cafe";

  async function getBalance() {
    const data = await client.getBalance({ owner: sender });
    return BigInt(data.totalBalance);
  }

  async function requestFromFaucet() {
    process.stdout.write("  Richiesta fondi dal faucet... ");
    try {
      await requestIotaFromFaucetV1({ host: FAUCET_HOST, recipient: sender });
      console.log("ok (v1)");
      return true;
    } catch {
      try {
        await requestIotaFromFaucetV0({ host: FAUCET_HOST, recipient: sender });
        console.log("ok (v0)");
        return true;
      } catch (e2) {
        console.error(`fallito: ${e2.message}`);
        return false;
      }
    }
  }

  let balNano = await getBalance();
  console.log(`Saldo wallet: ${(Number(balNano) / 1e9).toFixed(4)} IOTA`);

  if (balNano === 0n) {
    console.log("  Saldo zero — richiedo fondi dal faucet automaticamente...");
    const ok = await requestFromFaucet();
    if (ok) {
      // Attendi che i fondi arrivino (max 30s)
      for (let i = 0; i < 6; i++) {
        process.stdout.write(`  Attendo conferma${".".repeat(i + 1)}\r`);
        await new Promise(r => setTimeout(r, 5000));
        balNano = await getBalance();
        if (balNano > 0n) break;
      }
      console.log(`\n  Saldo aggiornato: ${(Number(balNano) / 1e9).toFixed(4)} IOTA`);
    }

    if (balNano === 0n) {
      console.error("\n✗ Impossibile ottenere fondi dal faucet.");
      console.error("  Finanzia manualmente l'indirizzo e riesegui:");
      console.error(`    https://faucet.testnet.iota.cafe  →  ${sender}`);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  // ── Crea i Pool on-chain e aggiorna il DB ───────────────────────────────
  console.log("─── Creazione Pool on-chain ────────────────────────\n");
  let successCount = 0;
  const createdPools = [];

  for (const pool of POOLS) {
    process.stdout.write(`[${pool.dbName}] Invio TX...`);

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::pool::create_pool`,
      arguments: [tx.pure.u64(BigInt(pool.interestRateBps))],
    });
    tx.setSender(sender);

    let result;
    try {
      result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showObjectChanges: true },
      });
    } catch (e) {
      console.error(` FALLITA\n  ✗ Errore TX: ${e.message}\n`);
      continue;
    }

    await client.waitForTransaction({ digest: result.digest });
    process.stdout.write(` confermata\n`);
    console.log(`  digest : ${result.digest}`);

    const created = result.objectChanges?.filter((c) => c.type === "created") ?? [];
    const poolObj = created.find(
      (c) => "objectType" in c && c.objectType === POOL_TYPE
    );

    if (!poolObj || !("objectId" in poolObj)) {
      console.error(`  ✗ Oggetto Pool non trovato tra i creati.`);
      console.error(`    Tipi trovati: ${created.map(c => "objectType" in c ? c.objectType : "?").join(", ") || "(nessuno)"}`);
      console.error(`    Pool type atteso: ${POOL_TYPE}\n`);
      continue;
    }

    const onChainId = poolObj.objectId;
    console.log(`  onChainId: ${onChainId}`);

    const { count } = await prisma.pool.updateMany({
      where: { name: pool.dbName },
      data:  { onChainId },
    });

    if (count === 0) {
      console.error(`  ✗ DB: nessuna riga con name="${pool.dbName}" trovata.`);
      console.error(`    Aggiorna manualmente:`);
      console.error(`    UPDATE "Pool" SET "onChainId"='${onChainId}' WHERE name='${pool.dbName}';\n`);
    } else {
      console.log(`  DB  : ✓ aggiornato\n`);
      successCount++;
      createdPools.push({ name: pool.dbName, onChainId });
    }
  }

  await prisma.$disconnect();

  // ── Riepilogo finale ─────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════");
  if (successCount === POOLS.length) {
    console.log(`✓ SUCCESSO — tutte e ${POOLS.length} le pool create e salvate nel DB.\n`);
    for (const p of createdPools) {
      console.log(`  ${p.name.padEnd(12)} → ${p.onChainId}`);
    }
    console.log("\n  Prossimi passi:");
    console.log("  1. Riavvia il backend  (npm run dev)");
    console.log("  2. Testa il flusso: borrower → richiesta → lender approva → borrower riceve fondi");
  } else {
    console.error(`✗ Solo ${successCount}/${POOLS.length} pool completate. Controlla gli errori sopra.`);
    if (createdPools.length > 0) {
      console.log("\n  Pool completate:");
      for (const p of createdPools) console.log(`  ${p.name} → ${p.onChainId}`);
    }
  }
  console.log("═══════════════════════════════════════════════════");
}

main().catch((e) => { console.error("\n✗ Errore fatale:", e.message); process.exit(1); });
