// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, it, expect } from "vitest";
import { validateGlidePath, validateTaxWithdrawal } from "./tool-validation";
import type { GlidePathInputs, TaxWithdrawalInputs } from "../store/scenario";
import type { Account } from "../contract/planning";

const validGlide: GlidePathInputs = {
  currentAge: 45,
  retirementAge: 65,
  horizonAge: 95,
  startEquityWeight: 0.7,
  endEquityWeight: 0.3,
  shape: "linear",
};

const validTax: TaxWithdrawalInputs = {
  year: 2026,
  age: 65,
  filingStatus: "married_joint",
  grossNeed: 120_000,
  otherTaxableIncome: 0,
};

const accounts: Account[] = [
  { type: "traditional", balance: 1_000_000, allocation: { eq: 1 } },
];

describe("validateGlidePath", () => {
  it("passes a well-formed glide path", () => {
    expect(validateGlidePath(validGlide)).toEqual([]);
  });

  it("rejects retirement age below current age", () => {
    expect(validateGlidePath({ ...validGlide, retirementAge: 40 })).toContain(
      "Retirement age must not be below current age.",
    );
  });

  it("rejects a horizon at or before retirement", () => {
    expect(validateGlidePath({ ...validGlide, horizonAge: 65 })).toContain(
      "Horizon age must be beyond retirement age.",
    );
  });

  it("rejects equity weights outside 0..1", () => {
    expect(
      validateGlidePath({ ...validGlide, startEquityWeight: 1.5 }),
    ).toContain("Start equity weight must be between 0 and 1.");
    expect(
      validateGlidePath({ ...validGlide, endEquityWeight: -0.1 }),
    ).toContain("End equity weight must be between 0 and 1.");
  });

  it("accepts the boundary weights 0 and 1", () => {
    expect(
      validateGlidePath({
        ...validGlide,
        startEquityWeight: 1,
        endEquityWeight: 0,
      }),
    ).toEqual([]);
  });
});

describe("validateTaxWithdrawal", () => {
  it("passes a well-formed request", () => {
    expect(validateTaxWithdrawal(validTax, accounts)).toEqual([]);
  });

  it("requires a portfolio", () => {
    expect(validateTaxWithdrawal(validTax, [])).toContain(
      "Add accounts in the Monte Carlo tab to model withdrawals.",
    );
  });

  it("rejects a non-positive gross need", () => {
    expect(
      validateTaxWithdrawal({ ...validTax, grossNeed: 0 }, accounts),
    ).toContain("Gross need must be greater than zero.");
  });

  it("rejects negative other taxable income", () => {
    expect(
      validateTaxWithdrawal({ ...validTax, otherTaxableIncome: -1 }, accounts),
    ).toContain("Other taxable income cannot be negative.");
  });

  it("rejects an implausible tax year", () => {
    expect(
      validateTaxWithdrawal({ ...validTax, year: 1800 }, accounts),
    ).toContain("Enter a valid tax year.");
  });
});
