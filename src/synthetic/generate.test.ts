import { describe, expect, it } from "vitest";
import { generate } from "./generate.js";
import { ClientProfileSchema } from "./schema.js";

describe("generate", () => {
  it("is deterministic for a given seed", () => {
    expect(generate({ seed: 42 })).toEqual(generate({ seed: 42 }));
  });

  it("differs across seeds", () => {
    expect(generate({ seed: 1 })).not.toEqual(generate({ seed: 2 }));
  });

  it("derives a stable id from the seed", () => {
    expect(generate({ seed: 42 }).id).toBe("demo-042");
  });

  it("always uses an obviously-synthetic display name", () => {
    expect(generate({ seed: 7 }).displayName).toMatch(/synthetic/i);
  });

  it("takes the tax bracket from the profile pin, not from income", () => {
    // hardAssetHedger is $220k filing marriedJoint. Deriving from income on
    // single-filer thresholds produced 32%, contradicting the profile. The
    // bracket is now pinned in the spec -- deriving it would be tax logic, which
    // belongs in nexus-core (CLAUDE.md invariant 1).
    const p = generate({ seed: 11, profile: "hardAssetHedger" });
    expect(p.filingStatus).toBe("marriedJoint");
    expect(p.annualIncome).toBe(220_000);
    expect(p.federalMarginalBracket).toBe("24");
  });

  it("validates against the schema across a fuzz range of seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(() => generate({ seed })).not.toThrow();
      expect(ClientProfileSchema.safeParse(generate({ seed })).success).toBe(
        true,
      );
    }
  });
});
