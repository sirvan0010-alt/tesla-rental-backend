import { describe, it, expect } from "vitest";
import { getReservationPublic } from "../src/services/reservationService";

describe("getReservationPublic contract", () => {
  it("is exported function", () => {
    expect(typeof getReservationPublic).toBe("function");
  });
});
