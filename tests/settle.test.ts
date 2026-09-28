import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import "./setup";
import { testVehicleId, testWindow } from "./setup";
import { markActive, markReturned } from "../src/services/reservationService";

async function returnedReservation() {
  const { startsAt, endsAt } = testWindow(120);
  const createRes = await request(app).post("/api/payment/reservations").send({
    customerName: "Settle Test",
    customerEmail: "settle@example.com",
    customerPhone: "+420600000077",
    vehicleId: testVehicleId,
    startsAt,
    endsAt,
  });
  expect(createRes.status).toBe(200);
  const id = createRes.body.id;
  const dep = await request(app).post("/api/payment/deposit").send({ reservationId: id });
  const kau = await request(app).post("/api/payment/kauce").send({ reservationId: id });
  await request(app).post("/api/payment/webhook").send({ transId: dep.body.transId, refId: id });
  await request(app).post("/api/payment/webhook").send({ transId: kau.body.transId, refId: id });
  await markActive(id);
  await markReturned({ reservationId: id, photoUrls: ["/uploads/returns/test.jpg"] });
  return { id, kauceAmountCzk: createRes.body.kauceAmountCzk };
}

describe("settle", () => {
  it("bez admin klíče → 401", async () => {
    const { id } = await returnedReservation();
    const res = await request(app).post(`/api/payment/reservations/${id}/settle`).send({ damaged: false });
    expect(res.status).toBe(401);
  });

  it("uvolnění kauce → SETTLED", async () => {
    const { id } = await returnedReservation();
    const res = await request(app)
      .post(`/api/payment/reservations/${id}/settle`)
      .set("x-admin-key", process.env.ADMIN_API_KEY as string)
      .send({ damaged: false });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SETTLED");
  });

  it("settle z DRAFT → 409", async () => {
    const { startsAt, endsAt } = testWindow(144);
    const createRes = await request(app).post("/api/payment/reservations").send({
      customerName: "Draft",
      customerEmail: "draft@example.com",
      customerPhone: "+420600000066",
      vehicleId: testVehicleId,
      startsAt,
      endsAt,
    });
    const res = await request(app)
      .post(`/api/payment/reservations/${createRes.body.id}/settle`)
      .set("x-admin-key", process.env.ADMIN_API_KEY as string)
      .send({ damaged: false });
    expect(res.status).toBe(409);
  });
});
