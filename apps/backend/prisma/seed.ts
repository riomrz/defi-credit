import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed 3 pools
  await prisma.pool.upsert({
    where: { onChainId: "0xpool_alpha_001" },
    update: {},
    create: {
      onChainId: "0xpool_alpha_001",
      name: "Alpha Pool",
      description: "Conservative lending pool for high-quality borrowers",
      interestRateBps: 520,
      availableLiquidity: BigInt(2_500_000_00),
      totalLiquidity: BigInt(5_000_000_00),
      minScore: 80,
      riskBand: "A",
    },
  });

  await prisma.pool.upsert({
    where: { onChainId: "0xpool_beta_002" },
    update: {},
    create: {
      onChainId: "0xpool_beta_002",
      name: "Beta Pool",
      description: "Balanced risk pool for growing businesses",
      interestRateBps: 780,
      availableLiquidity: BigInt(1_800_000_00),
      totalLiquidity: BigInt(3_000_000_00),
      minScore: 65,
      riskBand: "B",
    },
  });

  await prisma.pool.upsert({
    where: { onChainId: "0xpool_gamma_003" },
    update: {},
    create: {
      onChainId: "0xpool_gamma_003",
      name: "Gamma Pool",
      description: "Growth-oriented pool for emerging borrowers",
      interestRateBps: 1050,
      availableLiquidity: BigInt(950_000_00),
      totalLiquidity: BigInt(2_000_000_00),
      minScore: 50,
      riskBand: "C",
    },
  });

  console.log("Seed completed");
}

main().catch(console.error).finally(() => prisma.$disconnect());
