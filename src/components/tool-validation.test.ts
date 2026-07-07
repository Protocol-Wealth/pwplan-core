// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, it, expect } from "vitest";
import {
  parseIdList,
  parseReturns,
  validateBudgetPacingProjection,
  validateCashReserveAnalysis,
  validateCashflowPlanningBridge,
  validateBracketHeadroom,
  validateBuildPlanningReport,
  validateCorrelation,
  validateEducationFunding,
  validateFire,
  validateGlidePath,
  validateOptimizeAllocation,
  validatePortfolioXray,
  validateRebalance,
  validateRegimeGen,
  validateRegimeSwr,
  validateRiskMetrics,
  validateRmd,
  validateRoth,
  validateRothIrmaa,
  validateSequenceStress,
  validateSocialSecurity,
  validateTaxWithdrawal,
} from "./tool-validation";
import type {
  BracketHeadroomInputs,
  BuildPlanningReportInputs,
  BudgetPacingProjectionInputs,
  CashReserveAnalysisInputs,
  CashflowPlanningBridgeInputs,
  CorrelationInputs,
  EducationFundingInputs,
  FireInputs,
  GlidePathInputs,
  OptimizeAllocationInputs,
  RebalanceInputs,
  RegimeGenInputs,
  RegimeSwrInputs,
  RiskMetricsInputs,
  RmdInputs,
  RothInputs,
  RothIrmaaInputs,
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

const validRothIrmaa: RothIrmaaInputs = {
  taxYear: 2026,
  filingStatus: "mfj",
  stateCode: "PA",
  birthYearSelf: 1962,
  birthYearSpouse: 1963,
  medicareEnrolled: 2,
  conversionYears: 2,
  targetRule: "fill_to_irmaa_tier",
  targetRate: 0.24,
  fixedAmount: 100_000,
  pension: 30_000,
  socialSecurityGross: 48_000,
  taxableInterest: 5_000,
  taxExemptInterest: 8_000,
  ordinaryDividends: 12_000,
  qualifiedDividends: 9_000,
  longTermGains: 10_000,
  tradIraAggregate: 1_400_000,
  nondeductibleBasis: 0,
  taxableLiquidity: 250_000,
  employerPlanAggregate: 0,
  irmaaInflation: 0.03,
  irmaaBuffer: 5_000,
};

describe("validateRothIrmaa", () => {
  it("accepts a well-formed composite planner request", () => {
    expect(validateRothIrmaa(validRothIrmaa)).toEqual([]);
  });

  it("validates spouse birth year for married filing statuses", () => {
    expect(
      validateRothIrmaa({
        ...validRothIrmaa,
        filingStatus: "mfs",
        birthYearSpouse: 1800,
      }),
    ).toContain("Married filing statuses need a plausible spouse birth year.");
  });

  it("rejects Medicare enrollment counts outside the household size", () => {
    expect(
      validateRothIrmaa({ ...validRothIrmaa, medicareEnrolled: -1 }),
    ).toContain("Medicare enrollment count must fit the filing household.");
    expect(
      validateRothIrmaa({
        ...validRothIrmaa,
        filingStatus: "single",
        medicareEnrolled: 2,
      }),
    ).toContain("Medicare enrollment count must fit the filing household.");
  });
});

const validCashflowBridge: CashflowPlanningBridgeInputs = {
  monthsAnalyzed: 6,
  averageMonthlySpending: 8_000,
  essentialMonthlySpending: 5_000,
  lifestyleMonthlySpending: 3_000,
  averageMonthlyIncome: 12_000,
  averageMonthlySavings: 4_000,
  currentCashReserve: 25_000,
  targetCashReserveMonths: 6,
  oneTimeExpenseAdjustment: 500,
  spendingVolatility: "medium",
};

describe("validateCashflowPlanningBridge", () => {
  it("accepts public-safe monthly-close aggregates", () => {
    expect(validateCashflowPlanningBridge(validCashflowBridge)).toEqual([]);
  });
  it("requires a positive whole months analyzed value", () => {
    expect(
      validateCashflowPlanningBridge({
        ...validCashflowBridge,
        monthsAnalyzed: 0,
      }),
    ).toContain("Months analyzed must be a positive whole number.");
  });
  it("rejects negative aggregate values", () => {
    expect(
      validateCashflowPlanningBridge({
        ...validCashflowBridge,
        averageMonthlyIncome: -1,
      }),
    ).toContain("Average monthly income cannot be negative.");
  });
  it("rejects unsupported volatility", () => {
    const bad = {
      ...validCashflowBridge,
      spendingVolatility: "extreme",
    } as unknown as CashflowPlanningBridgeInputs;
    expect(validateCashflowPlanningBridge(bad)).toContain(
      "Spending volatility must be low, medium, or high.",
    );
  });
  it("rejects raw transaction-shaped fields", () => {
    const bad = {
      ...validCashflowBridge,
      transactions: [],
    } as unknown as CashflowPlanningBridgeInputs;
    expect(validateCashflowPlanningBridge(bad)).toContain(
      "Cash-flow bridge inputs must not include raw transaction fields.",
    );
  });
});

const validCashReserve: CashReserveAnalysisInputs = {
  monthlyEssentialSpending: 5_000,
  monthlyTotalSpending: 8_000,
  currentCashReserve: 25_000,
  targetMonths: 6,
  secondaryTargetMonths: 9,
};

describe("validateCashReserveAnalysis", () => {
  it("accepts aggregate reserve inputs", () => {
    expect(validateCashReserveAnalysis(validCashReserve)).toEqual([]);
  });
  it("requires total spending to cover essential spending", () => {
    expect(
      validateCashReserveAnalysis({
        ...validCashReserve,
        monthlyTotalSpending: 4_000,
      }),
    ).toContain("Monthly total spending must be at least essential spending.");
  });
  it("requires positive target months", () => {
    expect(
      validateCashReserveAnalysis({ ...validCashReserve, targetMonths: 0 }),
    ).toContain("Target months must be greater than zero.");
  });
  it("allows secondary target months to be omitted with zero", () => {
    expect(
      validateCashReserveAnalysis({
        ...validCashReserve,
        secondaryTargetMonths: 0,
      }),
    ).toEqual([]);
  });
});

const validBudgetPacing: BudgetPacingProjectionInputs = {
  monthDay: 15,
  daysInMonth: 30,
  monthToDateSpending: 3_400,
  monthlyBudget: 8_000,
  recurringRemaining: 1_250,
  knownOneTimeRemaining: 300,
};

describe("validateBudgetPacingProjection", () => {
  it("accepts aggregate budget pacing inputs", () => {
    expect(validateBudgetPacingProjection(validBudgetPacing)).toEqual([]);
  });
  it("rejects invalid month-day bounds", () => {
    expect(
      validateBudgetPacingProjection({ ...validBudgetPacing, monthDay: 31 }),
    ).toContain("Month day must be a whole number within the month.");
  });
  it("rejects invalid days-in-month values", () => {
    expect(
      validateBudgetPacingProjection({ ...validBudgetPacing, daysInMonth: 27 }),
    ).toContain("Days in month must be a whole number in [28, 31].");
  });
  it("requires a positive monthly budget", () => {
    expect(
      validateBudgetPacingProjection({
        ...validBudgetPacing,
        monthlyBudget: 0,
      }),
    ).toContain("Monthly budget must be greater than zero.");
  });
  it("rejects raw CSV-shaped fields", () => {
    const bad = {
      ...validBudgetPacing,
      csv: "raw",
    } as unknown as BudgetPacingProjectionInputs;
    expect(validateBudgetPacingProjection(bad)).toContain(
      "Cash-flow bridge inputs must not include raw transaction fields.",
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

const validFire: FireInputs = {
  currentAge: 40,
  retirementAge: 65,
  currentBalance: 400_000,
  annualContribution: 30_000,
  growthRate: 0.05,
  annualSpend: 80_000,
  swr: 0.04,
};

describe("validateFire", () => {
  it("accepts a well-formed request", () => {
    expect(validateFire(validFire)).toEqual([]);
  });
  it("requires retirement age at or above current age", () => {
    expect(validateFire({ ...validFire, retirementAge: 30 })).toContain(
      "Retirement age must be a whole number at or above current age.",
    );
  });
  it("rejects a non-positive annual spend", () => {
    expect(validateFire({ ...validFire, annualSpend: 0 })).toContain(
      "Annual spend must be greater than zero.",
    );
  });
  it("rejects a swr outside (0, 1)", () => {
    expect(validateFire({ ...validFire, swr: 1.5 })).toContain(
      "Safe withdrawal rate must be between 0 and 1.",
    );
  });
});

const validRisk: RiskMetricsInputs = {
  returnsText: "0.12, -0.08, 0.15",
  riskFreeRate: 0.02,
  periodsPerYear: 1,
};

describe("validateRiskMetrics", () => {
  it("accepts a well-formed request", () => {
    expect(validateRiskMetrics(validRisk)).toEqual([]);
  });
  it("requires at least two returns", () => {
    expect(validateRiskMetrics({ ...validRisk, returnsText: "0.1" })).toContain(
      "Enter at least two returns.",
    );
  });
  it("rejects a non-numeric return list", () => {
    expect(
      validateRiskMetrics({ ...validRisk, returnsText: "0.1, oops" }),
    ).toContain("Returns must be a list of numbers (e.g. 0.07, -0.1).");
  });
  it("rejects a return at or below -1", () => {
    expect(
      validateRiskMetrics({ ...validRisk, returnsText: "0.1, -1.0" }),
    ).toContain("Each return must be greater than -1.");
  });
  it("rejects periods-per-year below 1", () => {
    expect(validateRiskMetrics({ ...validRisk, periodsPerYear: 0 })).toContain(
      "Periods per year must be a whole number, one or more.",
    );
  });
});

describe("validateRebalance", () => {
  const balanced: RebalanceInputs = {
    targetWeights: { us_equity: 0.6, us_bonds: 0.4 },
  };
  it("accepts targets that sum to 1 over the shared portfolio", () => {
    expect(validateRebalance(balanced, xrayAssets, xrayAccounts)).toEqual([]);
  });
  it("requires target weights to sum to 1", () => {
    const off: RebalanceInputs = {
      targetWeights: { us_equity: 0.6, us_bonds: 0.3 },
    };
    expect(validateRebalance(off, xrayAssets, xrayAccounts)).toContain(
      "Target weights must sum to 1.",
    );
  });
  it("rejects negative target weights", () => {
    const neg: RebalanceInputs = {
      targetWeights: { us_equity: 1.2, us_bonds: -0.2 },
    };
    expect(validateRebalance(neg, xrayAssets, xrayAccounts)).toContain(
      "Target weights cannot be negative.",
    );
  });
  it("requires asset classes and accounts", () => {
    expect(validateRebalance(balanced, [], [])).toContain(
      "Add asset classes in the Monte Carlo tab.",
    );
    expect(validateRebalance(balanced, [], [])).toContain(
      "Add accounts in the Monte Carlo tab.",
    );
  });
});

const validOptimize: OptimizeAllocationInputs = {
  riskProfile: "moderate",
  objective: "",
  assetClassIdsText: "",
  weightMin: 0,
  weightMax: 1,
  returnModel: "house_view",
  regimeAware: true,
  riskFreeRate: 0.02,
};

describe("validateOptimizeAllocation", () => {
  it("accepts the full-universe default (no id subset)", () => {
    expect(validateOptimizeAllocation(validOptimize)).toEqual([]);
  });
  it("accepts a subset of at least two distinct ids", () => {
    expect(
      validateOptimizeAllocation({
        ...validOptimize,
        assetClassIdsText: "us_equity, us_bonds",
      }),
    ).toEqual([]);
  });
  it("rejects a single-id subset", () => {
    expect(
      validateOptimizeAllocation({
        ...validOptimize,
        assetClassIdsText: "us_equity",
      }),
    ).toContain("Optimize over the full universe, or name at least two ids.");
  });
  it("rejects duplicate ids", () => {
    expect(
      validateOptimizeAllocation({
        ...validOptimize,
        assetClassIdsText: "us_equity, us_equity",
      }),
    ).toContain("Asset-class ids must be distinct.");
  });
  it("rejects weight bounds outside 0..1", () => {
    expect(
      validateOptimizeAllocation({ ...validOptimize, weightMax: 1.5 }),
    ).toContain("Weight bounds must each be between 0 and 1.");
  });
  it("rejects min > max", () => {
    expect(
      validateOptimizeAllocation({
        ...validOptimize,
        weightMin: 0.8,
        weightMax: 0.2,
      }),
    ).toContain("Minimum weight bound cannot exceed the maximum.");
  });
});

const validReport: BuildPlanningReportInputs = {
  title: "Planning summary",
  includeRegime: true,
  sections: [
    { kind: "summary", title: "Overview", findingsText: "funds the horizon" },
  ],
};

describe("validateBuildPlanningReport", () => {
  it("accepts a well-formed report", () => {
    expect(validateBuildPlanningReport(validReport)).toEqual([]);
  });
  it("requires at least one section", () => {
    expect(
      validateBuildPlanningReport({ ...validReport, sections: [] }),
    ).toContain("Add at least one section.");
  });
  it("requires a non-empty kind on every section", () => {
    expect(
      validateBuildPlanningReport({
        ...validReport,
        sections: [{ kind: "  ", title: "x", findingsText: "" }],
      }),
    ).toContain("Every section needs a kind.");
  });
});

const validEducation: EducationFundingInputs = {
  taxYear: 2026,
  selectedVehicle: "529",
  tuitionInflation: 0.05,
  afterTaxReturn: 0.055,
  students: [
    {
      subjectRef: "student-1",
      annualCost: 45_000,
      yearsUntilStart: 8,
      fundingYears: 4,
      currentSavings: 15_000,
      monthlyContribution: 500,
    },
  ],
};

describe("validateEducationFunding", () => {
  it("accepts a well-formed education funding request", () => {
    expect(validateEducationFunding(validEducation)).toEqual([]);
  });

  it("requires an opaque subject ref token", () => {
    expect(
      validateEducationFunding({
        ...validEducation,
        students: [
          { ...validEducation.students[0], subjectRef: "Jane Student" },
        ],
      }),
    ).toContain(
      "Student 1 subject ref must be an opaque token of letters, digits, '.', '_', ':', or '-'.",
    );
  });

  it("requires at least one student and caps row count", () => {
    expect(
      validateEducationFunding({ ...validEducation, students: [] }),
    ).toContain("Add at least one student row.");
    expect(
      validateEducationFunding({
        ...validEducation,
        students: Array.from({ length: 13 }, (_, i) => ({
          ...validEducation.students[0],
          subjectRef: `student-${i + 1}`,
        })),
      }),
    ).toContain("Education funding supports at most 12 student rows.");
  });

  it("requires unique subject refs for result reconciliation", () => {
    expect(
      validateEducationFunding({
        ...validEducation,
        students: [
          validEducation.students[0],
          { ...validEducation.students[0], annualCost: 30_000 },
        ],
      }),
    ).toContain("Student 2 subject ref must be unique.");
  });

  it("checks rates and non-negative amounts", () => {
    expect(
      validateEducationFunding({
        ...validEducation,
        tuitionInflation: -1,
        students: [{ ...validEducation.students[0], annualCost: -1 }],
      }),
    ).toEqual(
      expect.arrayContaining([
        "Tuition inflation must be greater than -1.",
        "Student 1 annual cost cannot be negative.",
      ]),
    );
  });
});
