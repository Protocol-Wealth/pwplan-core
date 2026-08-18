import { describe, expect, it } from "vitest";
import { caseStudies } from "./cases.js";
import { generate } from "./generate.js";
import { CASE_SEEDS, PROFILE_NAMES, PROFILES } from "./profiles.js";
import { ClientProfileSchema } from "./schema.js";

describe("named case-study profiles", () => {
  it("defines ten profiles", () => {
    expect(PROFILE_NAMES).toHaveLength(10);
  });

  it.each(PROFILE_NAMES)("%s validates and pins its drivers", (name) => {
    const client = generate({ seed: CASE_SEEDS[name], profile: name });
    const spec = PROFILES[name];

    expect(ClientProfileSchema.safeParse(client).success).toBe(true);
    expect(client.displayName).toBe(spec.label);
    expect(client.displayName).toMatch(/synthetic/i);

    if (spec.age !== undefined) expect(client.age).toBe(spec.age);
    if (spec.riskTolerance) expect(client.riskTolerance).toBe(spec.riskTolerance);
    if (spec.hasTrust !== undefined) expect(client.hasTrust).toBe(spec.hasTrust);
    if (spec.retirementAge !== undefined) expect(client.retirementAge).toBe(spec.retirementAge);

    if (spec.targetAssets !== undefined) {
      const total =
        client.investmentAssets.taxable +
        client.investmentAssets.traditional401k +
        client.investmentAssets.rothIra +
        client.investmentAssets.otherRetirement;
      // Buckets snap to $100, so the total stays within a small rounding band.
      expect(Math.abs(total - spec.targetAssets)).toBeLessThanOrEqual(400);
    }
  });

  it("riskScore derives the correct riskTolerance", () => {
    const scoreMap: Array<[string, number, string]> = [
      ["conservativeRetiree", 2, "conservative"],
      ["recentDivorcee", 3, "conservative"],
      ["crowdedDecade", 4, "moderate"],
      ["hardAssetHedger", 5, "moderate"],
      ["familyOfficeUHNW", 6, "moderate"],
      ["aggressiveBuilder", 9, "aggressive"],
      ["cryptoConcentrated", 10, "aggressive"],
    ];
    for (const [name, score, tolerance] of scoreMap) {
      const client = caseStudies[name as keyof typeof caseStudies];
      expect(client.riskScore, `${name}.riskScore`).toBe(score);
      expect(client.riskTolerance, `${name}.riskTolerance`).toBe(tolerance);
    }
  });

  it("case studies are deterministic", () => {
    expect(caseStudies.familyOfficeUHNW).toEqual(
      generate({ seed: CASE_SEEDS.familyOfficeUHNW, profile: "familyOfficeUHNW" }),
    );
  });

  it("the family office uses an obviously-synthetic label", () => {
    expect(caseStudies.familyOfficeUHNW.displayName).toBe("Test Family Office (Alpha) — synthetic");
  });
});
