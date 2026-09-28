import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import "./setup";
import { testVehicleId } from "./setup";

async function paidReservation() {
  const startsAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const createRes = await request(app).post("/api/payment/reservations").send({
    customerName: "Token Test",
    customerEmail: "token@example.com",
    customerPhone: "+420600000088",
    vehicleId: testVehicleId,
    startsAt,
    endsAt,
  });
  const id = createRes.body.id;
  const dep = await request(app).post("/api/payment/deposit").send({ reservationId: id });
  const kau = await request(app).post("/api/payment/kauce").send({ reservationId: id });
  await request(app).post("/api/payment/webhook").send({ transId: dep.body.transId, refId: id });
  await request(app).post("/api/payment/webhook").send({ transId: kau.body.transId, refId: id });
  return id;
}

describe("customer access token", () => {
  it("activate bez tokenu → 401", async () => {
    const id = await paidReservation();
    const res = await request(app).post(`/api/payment/reservations/${id}/activate`).send({});
    expect(res.status).toBe(401);
  });

  it("session se špatným e-mailem → 401", async () => {
    const id = await paidReservation();
    const res = await request(app)
      .post(`/api/payment/reservations/${id}/customer-session`)
      .send({ customerEmail: "cizi@example.com" });
    expect(res.status).toBe(401);
  });

  it("session + activate s tokenem → ACTIVE + unlock URL", async () => {
    const id = await paidReservation();
    const sess = await request(app)
      .post(`/api/payment/reservations/${id}/customer-session`)
      .send({ customerEmail: "token@example.com" });
    expect(sess.status).toBe(200);
    expect(sess.body.accessToken).toBeTruthy();

    const act = await request(app)
      .post(`/api/payment/reservations/${id}/activate`)
      .send({ accessToken: sess.body.accessToken, customerEmail: "token@example.com" });
    expect(act.status).toBe(200);
    expect(act.body.status).toBe("ACTIVE");
    expect(act.body.vehicleUnlockUrl).toBeTruthy();

    // token je jednorázový
    const again = await request(app)
      .post(`/api/payment/reservations/${id}/activate`)
      .send({ accessToken: sess.body.accessToken, customerEmail: "token@example.com" });
    expect(again.status).toBe(401);
  });
});
