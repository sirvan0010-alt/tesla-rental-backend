import { beforeAll, afterAll, beforeEach } from "vitest";
import { Server } from "http";
import { app } from "../src/app";
import { prisma } from "../src/db";

export const TEST_VIN = "TEST-VIN-CI-0001";
export let testVehicleId = "";

let server: Server | undefined;

beforeAll(async () => {
  process.env.MOCK_MODE = "true";
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || "test-admin-key";
  process.env.PORT = process.env.PORT || "3456";

  await new Promise<void>((resolve, reject) => {
    server = app.listen(Number(process.env.PORT), "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { vin: TEST_VIN },
    update: { active: true, dailyPriceCzk: 1000, kauceAmountCzk: 5000 },
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

/**
 * Každý test potřebuje volný termín na stejném voze.
 * Mazání testovacích rezervací zabrání 400 „Vůz je v tomto termínu obsazený".
 */
beforeEach(async () => {
  if (!testVehicleId) return;
  await prisma.reservation.deleteMany({ where: { vehicleId: testVehicleId } });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (server) server.close(() => resolve());
    else resolve();
  });
  await prisma.$disconnect();
});

/** Unikátní nekolidující okno (2 dny) posunuté o offset hodin. */
export function testWindow(offsetHours = 24) {
  const startsAt = new Date(Date.now() + offsetHours * 3600 * 1000);
  const endsAt = new Date(startsAt.getTime() + 2 * 24 * 3600 * 1000);
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}
