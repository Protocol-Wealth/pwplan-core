import { describe, expect, it } from "vitest";
import { generate } from "./generate.js";
import { ClientProfileSchema } from "./schema.js";

describe("ClientProfileSchema", () => {
  it("accepts a generated profile", () => {
    expect(() =>
      ClientProfileSchema.parse(generate({ seed: 1 })),
    ).not.toThrow();
  });

  it("rejects an out-of-range age", () => {
    const bad = { ...generate({ seed: 1 }), age: 5 };
    expect(ClientProfileSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a non-2-letter state code", () => {
    const bad = { ...generate({ seed: 1 }), state: "California" };
    expect(ClientProfileSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown risk tolerance", () => {
    const bad = { ...generate({ seed: 1 }), riskTolerance: "yolo" };
    expect(ClientProfileSchema.safeParse(bad).success).toBe(false);
  });
});
