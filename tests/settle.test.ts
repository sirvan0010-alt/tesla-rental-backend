import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import "./setup";
import { testVehicleId } from "./setup";
import { markActive, markReturned } from "../src/services/reservationService";

describe("settle - vyrovnání kauce po vrácení vozu", () => {
  let reservationId: string;

  beforeAll(async () => {
    const startsAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

    const createRes = await request(app).post("/api/payment/reservations").send({
      customerName: "Settle Test",
      customerEmail: "settle-test@example.com",
      customerPhone: "+420600000001",
      vehicleId: testVehicleId,
      startsAt,
      endsAt,
    });
    reservationId = createRes.body.id;

    const depositRes = await request(app).post("/api/payment/deposit").send({ reservationId });
    const kauceRes = await request(app).post("/api/payment/kauce").send({ reservationId });

    await request(app)
      .post("/api/payment/webhook")
      .send({ transId: depositRes.body.transId, refId: reservationId });
    await request(app)
      .post("/api/payment/webhook")
      .send({ transId: kauceRes.body.transId, refId: reservationId });

    await markActive(reservationId);
    await markReturned({ reservationId, photoUrls: ["/uploads/returns/test.jpg"] });
  });

  it("odmítne settle bez ADMIN_API_KEY (401)", async () => {
    const res = await request(app)
      .post(`/api/payment/reservations/${reservationId}/settle`)
      .send({ damaged: false });
    expect(res.status).toBe(401);
  });

  it("uvolní kauci a přepne rezervaci na SETTLED, když škoda nebyla", async () => {
    const res = await request(app)
      .post(`/api/payment/reservations/${reservationId}/settle`)
      .set("x-admin-key", process.env.ADMIN_API_KEY as string)
      .send({ damaged: false });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SETTLED");
  });

  it("odmítne settle rezervace, která už není ve stavu RETURNED (409)", async () => {
    const res = await request(app)
      .post(`/api/payment/reservations/${reservationId}/settle`)
      .set("x-admin-key", process.env.ADMIN_API_KEY as string)
      .send({ damaged: false });

    expect(res.status).toBe(409);
  });
});
