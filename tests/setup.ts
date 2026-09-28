import { beforeAll, afterAll } from "vitest";
import { prisma } from "../src/db";

export const TEST_VIN = "TEST-VIN-0000001";
export let testVehicleId: string;

beforeAll(async () => {
  process.env.MOCK_MODE = "true";
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || "test-admin-key";

  const vehicle = await prisma.vehicle.upsert({
    where: { vin: TEST_VIN },
    update: {},
    create: {
      vin: TEST_VIN,
      name: "Testovací vůz (nepoužívat v produkci)",
      active: true,
      dailyPriceCzk: 1000,
      kauceAmountCzk: 5000,
    },
  });
  testVehicleId = vehicle.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});
