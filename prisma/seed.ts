import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed flotily — Tesla Model Y Performance 2023, bílý interiér, Prostějov.
 * Upravte VIN na skutečný, až budete mít auto ve FleetBold.
 */
async function main() {
  await prisma.vehicle.upsert({
    where: { vin: "7SAYGDEE0PF000001" },
    update: {
      name: "Tesla Model Y Performance 2023 — bílý interiér (Prostějov)",
      active: true,
      dailyPriceCzk: 3500,
      kauceAmountCzk: 20000,
    },
    create: {
      vin: "7SAYGDEE0PF000001",
      name: "Tesla Model Y Performance 2023 — bílý interiér (Prostějov)",
      active: true,
      dailyPriceCzk: 3500,
      kauceAmountCzk: 20000,
    },
  });
  console.log("Vehicle seed hotov: Tesla Y Performance Prostějov.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
