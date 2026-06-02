// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, it, expect } from "vitest";
import {
  parseIdList,
  parseReturns,
  validateBracketHeadroom,
  validateCorrelation,
  validateGlidePath,
  validatePortfolioXray,
  validateRegimeGen,
  validateRegimeSwr,
  validateRmd,
  validateRoth,
  validateSequenceStress,
  validateSocialSecurity,
  validateTaxWithdrawal,
} from "./tool-validation";
import type {
  BracketHeadroomInputs,
  CorrelationInputs,
  GlidePathInputs,
  RegimeGenInputs,
  RegimeSwrInputs,
  RmdInputs,
  RothInputs,
  SocialSecurityInputs,
  SorInputs,
  TaxWithdrawalInputs,
} from "../store/scenario";
import type { Account, AssetClass } from "../contract/planning";

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

const validRmd: RmdInputs = { age: 73, balance: 500_000 };

describe("validateRmd", () => {
  it("accepts a well-formed request", () => {
    expect(validateRmd(validRmd)).toEqual([]);
  });
  it("rejects a fractional age", () => {
    expect(validateRmd({ ...validRmd, age: 73.5 })).toContain(
      "Age must be a whole number, zero or more.",
    );
  });
  it("rejects a negative balance", () => {
    expect(validateRmd({ ...validRmd, balance: -1 })).toContain(
      "Balance cannot be negative.",
    );
  });
});

const validBracket: BracketHeadroomInputs = {
  taxableIncome: 100_000,
  filingStatus: "married_joint",
  targetRate: 0.24,
};

describe("validateBracketHeadroom", () => {
  it("accepts a well-formed request", () => {
    expect(validateBracketHeadroom(validBracket)).toEqual([]);
  });
  it("rejects a negative income", () => {
    expect(
      validateBracketHeadroom({ ...validBracket, taxableIncome: -1 }),
    ).toContain("Taxable income cannot be negative.");
  });
  it("rejects a target rate at or above 1", () => {
    expect(
      validateBracketHeadroom({ ...validBracket, targetRate: 1 }),
    ).toContain("Target rate must be between 0 and 1.");
  });
});

const validSs: SocialSecurityInputs = { piaMonthly: 2_500, fraAge: 67 };

describe("validateSocialSecurity", () => {
  it("accepts a well-formed request", () => {
    expect(validateSocialSecurity(validSs)).toEqual([]);
  });
  it("rejects a non-positive PIA", () => {
    expect(validateSocialSecurity({ ...validSs, piaMonthly: 0 })).toContain(
      "Monthly PIA must be greater than zero.",
    );
  });
  it("rejects an out-of-range FRA", () => {
    expect(validateSocialSecurity({ ...validSs, fraAge: 71 })).toContain(
      "Full retirement age must be a whole number in (62, 70].",
    );
  });
});

const validRegimeSwr: RegimeSwrInputs = {
  baseSwr: 0.04,
  portfolioBalance: 1_000_000,
};

describe("validateRegimeSwr", () => {
  it("accepts a well-formed request", () => {
    expect(validateRegimeSwr(validRegimeSwr)).toEqual([]);
  });
  it("rejects a base rate at or above 1", () => {
    expect(validateRegimeSwr({ ...validRegimeSwr, baseSwr: 1 })).toContain(
      "Base withdrawal rate must be between 0 and 1.",
    );
  });
  it("rejects a negative balance", () => {
    expect(
      validateRegimeSwr({ ...validRegimeSwr, portfolioBalance: -1 }),
    ).toContain("Portfolio balance cannot be negative.");
  });
});

describe("parseIdList", () => {
  it("splits comma/space separated ids and trims", () => {
    expect(parseIdList("us_equity, us_bonds  intl_equity")).toEqual([
      "us_equity",
      "us_bonds",
      "intl_equity",
    ]);
  });
  it("returns [] on blank input", () => {
    expect(parseIdList("  ")).toEqual([]);
  });
});

const validCorr: CorrelationInputs = {
  assetClassIdsText: "us_equity, us_bonds",
  lookbackDays: 1260,
  shrinkage: true,
};

describe("validateCorrelation", () => {
  it("accepts a well-formed request", () => {
    expect(validateCorrelation(validCorr)).toEqual([]);
  });
  it("requires at least two ids", () => {
    expect(
      validateCorrelation({ ...validCorr, assetClassIdsText: "us_equity" }),
    ).toContain("Enter at least two asset-class ids.");
  });
  it("rejects an out-of-range lookback", () => {
    expect(validateCorrelation({ ...validCorr, lookbackDays: 10 })).toContain(
      "Lookback days must be a whole number in [30, 3650].",
    );
  });
});

const assetClassesWithLambda: AssetClass[] = [
  {
    id: "us_equity",
    label: "US Equity",
    expectedReturn: 0.07,
    volatility: 0.16,
    lambda: 0.35,
  },
  {
    id: "us_bonds",
    label: "US Bonds",
    expectedReturn: 0.03,
    volatility: 0.05,
    lambda: 0.1,
  },
];
const validRegimeGen: RegimeGenInputs = { horizonYears: 50, paths: 10_000 };

describe("validateRegimeGen", () => {
  it("accepts a well-formed request with λ on every asset class", () => {
    expect(validateRegimeGen(validRegimeGen, assetClassesWithLambda)).toEqual(
      [],
    );
  });
  it("rejects an empty portfolio", () => {
    expect(validateRegimeGen(validRegimeGen, [])).toContain(
      "Add asset classes in the Monte Carlo tab (each needs a λ).",
    );
  });
  it("requires λ on every asset class", () => {
    const noLambda: AssetClass[] = [
      { id: "x", label: "X", expectedReturn: 0.05, volatility: 0.1 },
    ];
    expect(validateRegimeGen(validRegimeGen, noLambda)).toContain(
      "Every asset class needs a λ (EMF decay) for regime paths.",
    );
  });
  it("rejects an out-of-range horizon", () => {
    expect(
      validateRegimeGen(
        { ...validRegimeGen, horizonYears: 0 },
        assetClassesWithLambda,
      ),
    ).toContain("Horizon years must be a whole number in [1, 200].");
  });
});

const xrayAssets: AssetClass[] = [
  {
    id: "us_equity",
    label: "US Equity",
    expectedReturn: 0.07,
    volatility: 0.16,
    lambda: 0.35,
  },
  {
    id: "us_bonds",
    label: "US Bonds",
    expectedReturn: 0.03,
    volatility: 0.05,
    lambda: 0.1,
  },
];
const xrayAccounts: Account[] = [
  {
    type: "traditional",
    balance: 700_000,
    allocation: { us_equity: 0.6, us_bonds: 0.4 },
  },
];

describe("validatePortfolioXray", () => {
  it("accepts a well-formed shared portfolio", () => {
    expect(validatePortfolioXray(xrayAssets, xrayAccounts)).toEqual([]);
  });
  it("requires asset classes", () => {
    expect(validatePortfolioXray([], xrayAccounts)).toContain(
      "Add asset classes in the Monte Carlo tab.",
    );
  });
  it("requires accounts", () => {
    expect(validatePortfolioXray(xrayAssets, [])).toContain(
      "Add accounts in the Monte Carlo tab.",
    );
  });
  it("rejects an unbalanced allocation", () => {
    const bad: Account[] = [
      {
        type: "roth",
        balance: 100,
        allocation: { us_equity: 0.5, us_bonds: 0.4 },
      },
    ];
    expect(validatePortfolioXray(xrayAssets, bad)).toContain(
      "Each account's allocation must sum to 1.",
    );
  });
  it("rejects an unknown asset-class reference", () => {
    const bad: Account[] = [
      { type: "roth", balance: 100, allocation: { mystery: 1 } },
    ];
    expect(validatePortfolioXray(xrayAssets, bad)).toContain(
      "An account references an unknown asset class.",
    );
  });
});
