import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { requireAdminKey } from "../src/middleware/adminAuth";

describe("requireAdminKey", () => {
  const prev = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = "test-secret-key-32chars-xxxxxx";
  });
  afterEach(() => {
    process.env.ADMIN_API_KEY = prev;
  });

  function appWithGuard() {
    const app = express();
    app.get("/protected", requireAdminKey, (_req, res) => res.json({ ok: true }));
    return app;
  }

  it("rejects missing key", async () => {
    const res = await request(appWithGuard()).get("/protected");
    expect(res.status).toBe(401);
  });

  it("rejects wrong key", async () => {
    const res = await request(appWithGuard()).get("/protected").set("x-admin-key", "wrong");
    expect(res.status).toBe(401);
  });

  it("accepts correct header key", async () => {
    const res = await request(appWithGuard())
      .get("/protected")
      .set("x-admin-key", "test-secret-key-32chars-xxxxxx");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("accepts query key (for img tags)", async () => {
    const res = await request(appWithGuard()).get(
      "/protected?key=test-secret-key-32chars-xxxxxx"
    );
    expect(res.status).toBe(200);
  });
});
