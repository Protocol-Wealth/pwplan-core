import { describe, expect, it } from "vitest";
import { generate } from "./generate.js";
import {
  PlanningInputSchema,
  riskScoreToTolerance,
  toGlidePathParams,
  toPlanningInput,
} from "./planning-input.js";

// Substrings that signal an identity/PII field. The build FAILS if any planning
// contract field name matches — mirroring pwplan-core's planning.test.ts guard.
const FORBIDDEN_SUBSTRINGS = [
  "name",
  "email",
  "ssn",
  "social",
  "dob",
  "birth",
  "address",
  "street",
  "phone",
];

describe("PII-free planning contract", () => {
  it("contains no identity-shaped fields", () => {
    const keys = Object.keys(PlanningInputSchema.shape).map((k) =>
      k.toLowerCase(),
    );
    for (const key of keys) {
      expect(key === "id", `bare identity field "id" is forbidden`).toBe(false);
      for (const bad of FORBIDDEN_SUBSTRINGS) {
        expect(
          key.includes(bad),
          `field "${key}" looks like PII ("${bad}")`,
        ).toBe(false);
      }
    }
  });

  it("drops id and displayName from a synthetic profile", () => {
    const input = toPlanningInput(generate({ seed: 1 }));
    expect("id" in input).toBe(false);
    expect("displayName" in input).toBe(false);
  });

  it("produces output that validates against the contract", () => {
    expect(
      PlanningInputSchema.safeParse(toPlanningInput(generate({ seed: 9 })))
        .success,
    ).toBe(true);
  });

  it("drops riskScore from the de-identified payload", () => {
    const profile = generate({ seed: 1, profile: "aggressiveBuilder" });
    expect(profile.riskScore).toBe(9);
    const input = toPlanningInput(profile);
    expect("riskScore" in input).toBe(false);
    expect(input.riskTolerance).toBe("aggressive");
  });
});

describe("riskScoreToTolerance", () => {
  it.each([
    [1, "conservative"],
    [2, "conservative"],
    [3, "conservative"],
    [4, "moderate"],
    [5, "moderate"],
    [7, "moderate"],
    [8, "aggressive"],
    [9, "aggressive"],
    [10, "aggressive"],
  ] as const)("score %i → %s", (score, expected) => {
    expect(riskScoreToTolerance(score)).toBe(expected);
  });

  it("boundary: 3 is conservative, 4 is moderate, 7 is moderate, 8 is aggressive", () => {
    expect(riskScoreToTolerance(3)).toBe("conservative");
    expect(riskScoreToTolerance(4)).toBe("moderate");
    expect(riskScoreToTolerance(7)).toBe("moderate");
    expect(riskScoreToTolerance(8)).toBe("aggressive");
  });
});

describe("PlanningInput (continued)", () => {
  it("maps to a de-identified, camelCase nexus glide_path payload", () => {
    const params = toGlidePathParams(
      toPlanningInput(generate({ seed: 1, profile: "aggressiveBuilder" })),
    );
    expect(params.currentAge).toBe(32);
    expect(params.startEquityWeight).toBe(0.9);
    expect(params.endEquityWeight).toBeGreaterThanOrEqual(0.2);
    // glide_path requires horizonAge + retirementAge >= currentAge (contract).
    expect(params.horizonAge).toBeGreaterThan(params.currentAge);
    expect(params.retirementAge).toBeGreaterThanOrEqual(params.currentAge);
    expect(Object.keys(params)).not.toContain("displayName");
  });

  it("keeps the horizon above a late retirement age", () => {
    // The schema puts no upper bound on retirementAge, so this profile is valid.
    // Deriving horizonAge from currentAge alone gave max(90, 71) = 90, which sits
    // BELOW a retirement age of 95 and breaks the contract's required ordering
    // currentAge <= retirementAge < horizonAge.
    const base = toPlanningInput(generate({ seed: 3 }));
    const params = toGlidePathParams({
      ...base,
      age: 70,
      retirementAge: 95,
    });
    expect(params.currentAge).toBe(70);
    expect(params.retirementAge).toBe(95);
    expect(params.horizonAge).toBeGreaterThan(params.retirementAge);
  });
});
