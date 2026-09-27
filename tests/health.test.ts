import { describe, it, expect } from "vitest";
import request from "supertest";

process.env.MOCK_MODE = "true";
process.env.ADMIN_API_KEY = "test-secret-key-32chars-xxxxxx";

describe("GET /health", () => {
  it("returns ok", async () => {
    const { createApp } = await import("../src/app");
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
