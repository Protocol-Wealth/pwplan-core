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
});
