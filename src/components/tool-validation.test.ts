// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, it, expect } from "vitest";
import {
  parseReturns,
  validateGlidePath,
  validateRoth,
  validateSequenceStress,
  validateTaxWithdrawal,
} from "./tool-validation";
import type {
  GlidePathInputs,
  RothInputs,
  SorInputs,
  TaxWithdrawalInputs,
} from "../store/scenario";
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

const validRoth: RothInputs = {
  currentTaxableIncome: 150_000,
  filingStatus: "married_joint",
  conversionAmount: 100_000,
  growthRate: 0.06,
  years: 15,
  retirementMarginalRate: 0.24,
  taxesPaidFromConversion: false,
};

describe("validateRoth", () => {
  it("accepts a well-formed request", () => {
    expect(validateRoth(validRoth)).toEqual([]);
  });

  it("rejects a non-positive conversion amount", () => {
    expect(validateRoth({ ...validRoth, conversionAmount: 0 })).toContain(
      "Conversion amount must be greater than zero.",
    );
  });

  it("rejects a retirement marginal rate at or above 1", () => {
    expect(validateRoth({ ...validRoth, retirementMarginalRate: 1 })).toContain(
      "Retirement marginal rate must be between 0 and 1.",
    );
  });

  it("rejects fractional years", () => {
    expect(validateRoth({ ...validRoth, years: 1.5 })).toContain(
      "Years must be a whole number, zero or more.",
    );
  });
});

const validSor: SorInputs = {
  initialBalance: 1_000_000,
  annualSpend: 50_000,
  returnsText: "0.07, 0.05, -0.10",
};

describe("parseReturns", () => {
  it("parses comma- and space-separated decimals", () => {
    expect(parseReturns("0.07, 0.05 -0.1")).toEqual([0.07, 0.05, -0.1]);
  });

  it("returns null on a non-numeric token", () => {
    expect(parseReturns("0.07, banana")).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(parseReturns("   ")).toBeNull();
  });
});

describe("validateSequenceStress", () => {
  it("accepts a well-formed request", () => {
    expect(validateSequenceStress(validSor)).toEqual([]);
  });

  it("rejects a non-positive initial balance", () => {
    expect(
      validateSequenceStress({ ...validSor, initialBalance: 0 }),
    ).toContain("Initial balance must be greater than zero.");
  });

  it("rejects unparseable returns", () => {
    expect(
      validateSequenceStress({ ...validSor, returnsText: "n/a" }),
    ).toContain("Annual returns must be a list of numbers (e.g. 0.07, -0.1).");
  });

  it("rejects a return at or below -1", () => {
    expect(
      validateSequenceStress({ ...validSor, returnsText: "0.05, -1" }),
    ).toContain("Each annual return must be greater than -1.");
  });
});
