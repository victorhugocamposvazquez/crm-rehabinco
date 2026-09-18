import { describe, expect, it } from "vitest";
import { esperaEntrePeticiones } from "../src/transport/rate-limit.js";

describe("crawler pipeline", () => {
  it("calcula espera dentro del rango base", () => {
    const ms = esperaEntrePeticiones(5000, 12000);
    expect(ms).toBeGreaterThanOrEqual(5000);
    expect(ms).toBeLessThanOrEqual(12000);
  });
});
