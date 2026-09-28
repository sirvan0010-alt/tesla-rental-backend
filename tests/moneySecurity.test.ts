import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import "./setup";
import { testVehicleId } from "./setup";
import { markActive, markReturned } from "../src/services/reservationService";

async function createDraft() {
  const startsAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const createRes = await request(app).post("/api/payment/reservations").send({
    customerName: "Money Test",
    customerEmail: "money@example.com",
    customerPhone: "+420600000099",
    vehicleId: testVehicleId,
    startsAt,
    endsAt,
  });
  expect(createRes.status).toBe(200);
  return createRes.body;
}

describe("P0 money + state guards", () => {
  it("deposit ignoruje klientskou amountCzk a použije DB (200)", async () => {
    const r = await createDraft();
    const res = await request(app).post("/api/payment/deposit").send({
      reservationId: r.id,
      amountCzk: 1,
      customerEmail: "hacker@evil.test",
    });
    expect(res.status).toBe(200);
    expect(res.body.transId).toBeDefined();
  });

  it("druhý deposit na stejnou rezervaci → 409", async () => {
    const r = await createDraft();
    await request(app).post("/api/payment/deposit").send({ reservationId: r.id });
    const res = await request(app).post("/api/payment/deposit").send({ reservationId: r.id });
    expect(res.status).toBe(409);
  });

  it("return-photos z DRAFT → 409", async () => {
    const r = await createDraft();
    const res = await request(app)
      .post(`/api/documents/${r.id}/return-photos`)
      .attach("photos", Buffer.from("fake"), "x.jpg");
    expect(res.status).toBe(409);
  });

  it("activate bez accessToken → 401", async () => {
    const r = await createDraft();
    const res = await request(app).post(`/api/payment/reservations/${r.id}/activate`).send({});
    expect(res.status).toBe(401);
  });

  it("settle damageAmountCzk > kauce → 400", async () => {
    const r = await createDraft();
    const dep = await request(app).post("/api/payment/deposit").send({ reservationId: r.id });
    const kau = await request(app).post("/api/payment/kauce").send({ reservationId: r.id });
    await request(app)
      .post("/api/payment/webhook")
      .send({ transId: dep.body.transId, refId: r.id });
    await request(app)
      .post("/api/payment/webhook")
      .send({ transId: kau.body.transId, refId: r.id });
    await markActive(r.id);
    await markReturned({ reservationId: r.id, photoUrls: ["/uploads/returns/t.jpg"] });

    const res = await request(app)
      .post(`/api/payment/reservations/${r.id}/settle`)
      .set("x-admin-key", process.env.ADMIN_API_KEY as string)
      .send({ damaged: true, damageAmountCzk: r.kauceAmountCzk + 99999 });
    expect(res.status).toBe(400);
  });
});
