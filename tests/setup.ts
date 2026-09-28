import { beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import { prisma } from "../src/db";
import { app } from "../src/app";

export const TEST_VIN = "TEST-VIN-0000001";
export let testVehicleId: string;

let server: Server | undefined;

beforeAll(async () => {
  process.env.MOCK_MODE = "true";
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || "test-admin-key";
  // paymentService MOCK posílá webhook na http://127.0.0.1:$PORT — musí běžet listener
  process.env.PORT = process.env.PORT || "3456";

  await new Promise<void>((resolve, reject) => {
    server = app.listen(Number(process.env.PORT), "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

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
  await new Promise<void>((resolve) => {
    if (server) server.close(() => resolve());
    else resolve();
  });
  await prisma.$disconnect();
});
