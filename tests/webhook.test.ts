import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import "./setup";
import { testVehicleId } from "./setup";

describe("platba -> webhook -> PAID -> přístup k vozu", () => {
  it("kompletní tok od vytvoření rezervace po PAID + vehicleAccessReady", async () => {
    const startsAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

    const createRes = await request(app)
      .post("/api/payment/reservations")
      .send({
        customerName: "Test Zákazník",
        customerEmail: "test@example.com",
        customerPhone: "+420600000000",
        vehicleId: testVehicleId,
        startsAt,
        endsAt,
      });

    expect(createRes.status).toBe(200);
    const reservationId = createRes.body.id;
    expect(reservationId).toBeDefined();
    expect(createRes.body.status).toBe("DRAFT");

    const depositRes = await request(app).post("/api/payment/deposit").send({ reservationId });
    expect(depositRes.status).toBe(200);
    expect(depositRes.body.transId).toBeDefined();

    const kauceRes = await request(app).post("/api/payment/kauce").send({ reservationId });
    expect(kauceRes.status).toBe(200);
    expect(kauceRes.body.transId).toBeDefined();

    const beforeWebhook = await request(app).get(`/api/payment/reservations/${reservationId}`);
    expect(beforeWebhook.body.status).toBe("PENDING_PAYMENT");

    await request(app)
      .post("/api/payment/webhook")
      .send({ transId: depositRes.body.transId, refId: reservationId })
      .expect(200);
    await request(app)
      .post("/api/payment/webhook")
      .send({ transId: kauceRes.body.transId, refId: reservationId })
      .expect(200);

    const afterWebhook = await request(app).get(`/api/payment/reservations/${reservationId}`);
    expect(afterWebhook.status).toBe(200);
    expect(afterWebhook.body.status).toBe("PAID");
    expect(afterWebhook.body.vehicleAccessReady).toBe(true);
    expect(afterWebhook.body.vehicleUnlockUrl).toBeUndefined();
    expect(afterWebhook.body.customerEmail).toBeUndefined();
    expect(afterWebhook.body.vehicleVin).toBeUndefined();
    expect(afterWebhook.body.depositTransId).toBeUndefined();
  });

  it("webhook s neznámým transId nespadne a vrátí 200", async () => {
    const res = await request(app)
      .post("/api/payment/webhook")
      .send({ transId: "neexistujici-trans-id", refId: "neexistujici-rezervace" });
    expect(res.status).toBe(200);
  });
});
