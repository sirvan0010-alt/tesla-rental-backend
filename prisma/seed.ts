import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Jednorázově naplní tabulku Vehicle. Spouští se přes `npm run prisma:seed`.
 * Přidejte/upravte položky podle skutečné flotily - VIN musí sedět s tím,
 * co máte zaregistrované ve FleetBold.
 */
async function main() {
  await prisma.vehicle.upsert({
    where: { vin: "5YJ3E1EA000000001" },
    update: {},
    create: {
      vin: "5YJ3E1EA000000001",
      name: "Tesla Model 3 Long Range - bílá",
      active: true,
      dailyPriceCzk: 2500,
      kauceAmountCzk: 20000,
    },
  });
  console.log("Vehicle seed hotov.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
