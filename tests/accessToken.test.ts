import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import "./setup";
import { testVehicleId, testWindow } from "./setup";

async function paidReservation() {
  const { startsAt, endsAt } = testWindow(96);
  const createRes = await request(app).post("/api/payment/reservations").send({
    customerName: "Token Test",
    customerEmail: "token@example.com",
    customerPhone: "+420600000088",
    vehicleId: testVehicleId,
    startsAt,
    endsAt,
  });
  if (createRes.status !== 200) {
    console.error("paidReservation create failed", createRes.status, createRes.body);
  }
  expect(createRes.status).toBe(200);
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

    const again = await request(app)
      .post(`/api/payment/reservations/${id}/activate`)
      .send({ accessToken: sess.body.accessToken, customerEmail: "token@example.com" });
    expect(again.status).toBe(401);
  });
});
