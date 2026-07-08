// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, it, expect } from "vitest";
import {
  allocationSum,
  isAllocationBalanced,
  duplicateAssetClassIds,
  validateScenario,
  ALLOCATION_TOLERANCE,
} from "./scenario-validation";
import type { Account, AssetClass } from "../contract/planning";

const assetClasses: AssetClass[] = [
  {
    id: "us_equity",
    label: "US Equity",
    expectedReturn: 0.07,
    volatility: 0.16,
  },
  { id: "us_bonds", label: "US Bonds", expectedReturn: 0.03, volatility: 0.05 },
];

function account(allocation: Record<string, number>): Account {
  return { type: "taxable", balance: 100, allocation };
}

describe("allocationSum", () => {
  it("sums the weights", () => {
    expect(
      allocationSum(account({ us_equity: 0.6, us_bonds: 0.4 })),
    ).toBeCloseTo(1);
  });

  it("treats an empty allocation as zero", () => {
    expect(allocationSum(account({}))).toBe(0);
  });
});

describe("isAllocationBalanced", () => {
  it("accepts weights that total 1", () => {
    expect(
      isAllocationBalanced(account({ us_equity: 0.6, us_bonds: 0.4 })),
    ).toBe(true);
  });

  it("accepts a sum just inside the tolerance band", () => {
    // Deterministic boundary check (half a tolerance avoids FP edge fragility):
    // a hair off 1 on either side still passes, and would fail if the tolerance
    // were tightened (e.g. 1e-6 -> 1e-7).
    expect(
      isAllocationBalanced(account({ a: 1 + ALLOCATION_TOLERANCE / 2 })),
    ).toBe(true);
    expect(
      isAllocationBalanced(account({ a: 1 - ALLOCATION_TOLERANCE / 2 })),
    ).toBe(true);
  });

  it("rejects a sum just outside the tolerance band", () => {
    // Twice the tolerance on either side is clearly out and must be rejected;
    // would pass (wrongly) if the tolerance were loosened.
    expect(
      isAllocationBalanced(account({ a: 1 + ALLOCATION_TOLERANCE * 2 })),
    ).toBe(false);
    expect(
      isAllocationBalanced(account({ a: 1 - ALLOCATION_TOLERANCE * 2 })),
    ).toBe(false);
  });

  it("rejects weights that do not total 1", () => {
    expect(isAllocationBalanced(account({ us_equity: 0.6 }))).toBe(false);
    expect(
      isAllocationBalanced(account({ us_equity: 0.6, us_bonds: 0.5 })),
    ).toBe(false);
  });
});

describe("duplicateAssetClassIds", () => {
  it("returns nothing for unique ids", () => {
    expect(duplicateAssetClassIds(assetClasses)).toEqual([]);
  });

  it("flags repeated ids (ignoring surrounding whitespace)", () => {
    expect(
      duplicateAssetClassIds([
        ...assetClasses,
        { id: " us_equity ", label: "dup", expectedReturn: 0, volatility: 0 },
      ]),
    ).toEqual(["us_equity"]);
  });
});

describe("validateScenario", () => {
  const balanced = [
    account({ us_equity: 0.6, us_bonds: 0.4 }),
    account({ us_equity: 0.8, us_bonds: 0.2 }),
  ];

  it("passes a well-formed scenario", () => {
    expect(validateScenario({ assetClasses, accounts: balanced })).toEqual([]);
  });

  it("requires at least one asset class", () => {
    expect(
      validateScenario({ assetClasses: [], accounts: balanced }),
    ).toContain("Add at least one asset class.");
  });

  it("requires at least one account", () => {
    expect(validateScenario({ assetClasses, accounts: [] })).toContain(
      "Add at least one account.",
    );
  });

  it("flags an account whose allocation does not total 100%", () => {
    const issues = validateScenario({
      assetClasses,
      accounts: [account({ us_equity: 0.6, us_bonds: 0.3 })],
    });
    expect(issues.some((m) => /allocation is 90.0%/.test(m))).toBe(true);
  });

  it("flags a blank asset-class id", () => {
    expect(
      validateScenario({
        assetClasses: [
          { id: "", label: "x", expectedReturn: 0, volatility: 0 },
        ],
        accounts: balanced,
      }),
    ).toContain("Every asset class needs an id.");
  });

  it("flags an allocation to an unknown asset class", () => {
    const issues = validateScenario({
      assetClasses,
      accounts: [account({ us_equity: 0.5, us_bonds: 0.3, gold: 0.2 })],
    });
    expect(issues.some((m) => /unknown asset class "gold"/.test(m))).toBe(true);
  });

  it("ignores a zero-weight stale allocation key", () => {
    const issues = validateScenario({
      assetClasses,
      accounts: [account({ us_equity: 0.6, us_bonds: 0.4, gold: 0 })],
    });
    expect(issues).toEqual([]);
  });

  it("accepts a well-ordered age trio", () => {
    expect(
      validateScenario({
        assetClasses,
        accounts: balanced,
        currentAge: 45,
        retirementAge: 65,
        horizonAge: 95,
      }),
    ).toEqual([]);
  });

  it("accepts well-formed path-funded goals and guardrails", () => {
    expect(
      validateScenario({
        assetClasses,
        accounts: balanced,
        currentAge: 45,
        retirementAge: 65,
        horizonAge: 95,
        goals: [
          {
            id: "goal-1",
            targetAmount: 75_000,
            yearsToGoal: 10,
            fundingYears: 2,
            inflationRate: 0.025,
            tier: "want",
          },
        ],
        guardrails: {
          rule: "guyton_klinger",
          band: 0.2,
          raise: 0.1,
          cut: 0.1,
          inflation: 0.025,
          freezeAfterLoss: true,
          preservationFinalYears: 15,
        },
      }),
    ).toEqual([]);
  });

  it("rejects malformed path-funded goals and guardrails", () => {
    const issues = validateScenario({
      assetClasses,
      accounts: balanced,
      currentAge: 45,
      retirementAge: 65,
      horizonAge: 50,
      goals: [
        {
          id: "goalone",
          targetAmount: -1,
          yearsToGoal: 10,
          fundingYears: 0,
          inflationRate: -1.1,
          priority: 101,
        },
      ],
      guardrails: {
        band: 1,
        raise: -0.1,
        cut: 2,
        inflation: -0.01,
        preservationFinalYears: -1,
      },
    });

    expect(issues).toContain("Goal 1 needs an opaque id token.");
    expect(issues).toContain("Goal 1 target amount must be non-negative.");
    expect(issues).toContain(
      "Goal 1 funding years must be an integer in [1, 40].",
    );
    expect(issues).toContain("Goal 1 must fit inside the Monte Carlo horizon.");
    expect(issues).toContain(
      "Goal 1 inflation rate must be greater than -100%.",
    );
    expect(issues).toContain("Goal 1 priority must be an integer in [1, 100].");
    expect(issues).toContain("Guardrail band must be between 0% and 100%.");
    expect(issues).toContain("Guardrail raise must be between 0% and 100%.");
    expect(issues).toContain("Guardrail cut must be between 0% and 100%.");
    expect(issues).toContain("Guardrail inflation must be non-negative.");
    expect(issues).toContain(
      "Guardrail preservation years must be a non-negative integer.",
    );
  });

  it("matches the Nexus limit of 100 path-funded goals", () => {
    const goal = {
      id: "goal-1",
      targetAmount: 1,
      yearsToGoal: 1,
      fundingYears: 1,
    };
    expect(
      validateScenario({
        assetClasses,
        accounts: balanced,
        currentAge: 45,
        retirementAge: 65,
        horizonAge: 95,
        goals: Array.from({ length: 100 }, (_, i) => ({
          ...goal,
          id: `goal-${i + 1}`,
        })),
      }),
    ).toEqual([]);
    expect(
      validateScenario({
        assetClasses,
        accounts: balanced,
        currentAge: 45,
        retirementAge: 65,
        horizonAge: 95,
        goals: Array.from({ length: 101 }, (_, i) => ({
          ...goal,
          id: `goal-${i + 1}`,
        })),
      }),
    ).toContain("Monte Carlo supports at most 100 path-funded goals.");
  });

  it("accepts retirement age equal to current age (already retired)", () => {
    expect(
      validateScenario({
        assetClasses,
        accounts: balanced,
        currentAge: 70,
        retirementAge: 70,
        horizonAge: 95,
      }),
    ).toEqual([]);
  });

  it("flags a retirement age below the current age", () => {
    expect(
      validateScenario({
        assetClasses,
        accounts: balanced,
        currentAge: 65,
        retirementAge: 60,
        horizonAge: 95,
      }),
    ).toContain("Retirement age must not be below current age.");
  });

  it("flags a horizon age not beyond the retirement age", () => {
    expect(
      validateScenario({
        assetClasses,
        accounts: balanced,
        currentAge: 45,
        retirementAge: 65,
        horizonAge: 65,
      }),
    ).toContain("Horizon age must be beyond retirement age.");
  });

  it("skips age ordering when ages are omitted", () => {
    expect(validateScenario({ assetClasses, accounts: balanced })).toEqual([]);
  });
});
