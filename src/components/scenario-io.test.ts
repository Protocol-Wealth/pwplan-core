// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, it, expect } from "vitest";
import {
  serializeScenario,
  toScenarioJSON,
  parseScenario,
  parseScenarioJSON,
  SCENARIO_FILE_KIND,
  SCENARIO_FILE_VERSION,
  type ScenarioSnapshot,
} from "./scenario-io";
import { PLANNING_CONTRACT_VERSION } from "../contract/planning";

const snapshot: ScenarioSnapshot = {
  tool: "monte_carlo",
  inputs: {
    currentAge: 45,
    retirementAge: 65,
    horizonAge: 95,
    filingStatus: "married_joint",
    annualSpend: 120_000,
    spendColaRate: 0.025,
    accounts: [
      {
        type: "traditional",
        balance: 1_200_000,
        allocation: { us_equity: 0.6, us_bonds: 0.4 },
      },
    ],
    assetClasses: [
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
      },
    ],
    guaranteedIncome: [
      {
        label: "Social Security",
        annualAmount: 42_000,
        startAge: 67,
        colaRate: 0.02,
      },
    ],
    returnModel: "emf_regime",
    paths: 10_000,
  },
  glidePathInputs: {
    currentAge: 45,
    retirementAge: 65,
    horizonAge: 95,
    startEquityWeight: 0.7,
    endEquityWeight: 0.3,
    shape: "linear",
  },
  taxInputs: {
    year: 2026,
    age: 65,
    filingStatus: "married_joint",
    grossNeed: 120_000,
    otherTaxableIncome: 0,
  },
  rothInputs: {
    currentTaxableIncome: 150_000,
    filingStatus: "married_joint",
    conversionAmount: 100_000,
    growthRate: 0.06,
    years: 15,
    retirementMarginalRate: 0.24,
    taxesPaidFromConversion: false,
  },
  rothIrmaaInputs: {
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
  },
  sorInputs: {
    initialBalance: 1_000_000,
    annualSpend: 50_000,
    returnsText: "0.07, -0.1, 0.12",
  },
  rmdInputs: { age: 73, balance: 500_000 },
  bracketInputs: {
    taxableIncome: 100_000,
    filingStatus: "married_joint",
    targetRate: 0.24,
  },
  socialSecurityInputs: { piaMonthly: 2_500, fraAge: 67 },
  regimeSwrInputs: { baseSwr: 0.04, portfolioBalance: 1_000_000 },
  correlationInputs: {
    assetClassIdsText: "us_equity, us_bonds",
    lookbackDays: 1260,
    shrinkage: true,
  },
  regimeGenInputs: { horizonYears: 50, paths: 10_000 },
  fireInputs: {
    currentAge: 40,
    retirementAge: 65,
    currentBalance: 400_000,
    annualContribution: 30_000,
    growthRate: 0.05,
    annualSpend: 80_000,
    swr: 0.04,
  },
  riskMetricsInputs: {
    returnsText: "0.12, -0.08, 0.15",
    riskFreeRate: 0.02,
    periodsPerYear: 1,
  },
  rebalanceInputs: { targetWeights: { us_equity: 0.6, us_bonds: 0.4 } },
  optimizeAllocationInputs: {
    riskProfile: "moderate",
    objective: "",
    assetClassIdsText: "",
    weightMin: 0,
    weightMax: 1,
    returnModel: "house_view",
    regimeAware: true,
    riskFreeRate: 0.02,
  },
  buildReportInputs: {
    title: "Planning summary",
    includeRegime: true,
    sections: [
      {
        kind: "summary",
        title: "Overview",
        findingsText: "Plan funds the full horizon in the base case.",
      },
    ],
  },
  cashflowPlanningBridgeInputs: {
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
  },
  cashReserveAnalysisInputs: {
    monthlyEssentialSpending: 5_000,
    monthlyTotalSpending: 8_000,
    currentCashReserve: 25_000,
    targetMonths: 6,
    secondaryTargetMonths: 9,
  },
  budgetPacingProjectionInputs: {
    monthDay: 15,
    daysInMonth: 30,
    monthToDateSpending: 3_400,
    monthlyBudget: 8_000,
    recurringRemaining: 1_250,
    knownOneTimeRemaining: 300,
  },
  educationFundingInputs: {
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
  },
};

describe("serializeScenario", () => {
  it("wraps inputs in a tagged, versioned envelope stamped with the contract version", () => {
    const env = serializeScenario(snapshot);
    expect(env.kind).toBe(SCENARIO_FILE_KIND);
    expect(env.fileVersion).toBe(SCENARIO_FILE_VERSION);
    expect(env.contractVersion).toBe(PLANNING_CONTRACT_VERSION);
    expect(env.tool).toBe("monte_carlo");
  });

  it("throws if the snapshot somehow carries an identity-shaped key", () => {
    const leaky = {
      ...snapshot,
      inputs: {
        ...snapshot.inputs,
        guaranteedIncome: [
          {
            label: "Pension",
            annualAmount: 1,
            startAge: 65,
            colaRate: 0,
            ssn: "000-00-0000",
          },
        ],
      },
    } as unknown as ScenarioSnapshot;
    expect(() => serializeScenario(leaky)).toThrow();
  });
});

describe("round-trip", () => {
  it("parses what it serializes back to an equal snapshot", () => {
    const json = toScenarioJSON(snapshot);
    const result = parseScenarioJSON(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(snapshot);
  });

  it("preserves an optional omitted lambda (does not invent one)", () => {
    const result = parseScenarioJSON(toScenarioJSON(snapshot));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const bonds = result.value.inputs.assetClasses.find(
        (a) => a.id === "us_bonds",
      );
      expect(bonds?.lambda).toBeUndefined();
    }
  });

  it("round-trips newer tool selections instead of rejecting them as unknown", () => {
    const newer: ScenarioSnapshot = {
      ...snapshot,
      tool: "cashflow_bridge",
      optimizeAllocationInputs: {
        ...snapshot.optimizeAllocationInputs,
        objective: "max_sharpe",
      },
    };

    const result = parseScenarioJSON(toScenarioJSON(newer));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(newer);
  });
});

describe("parseScenario rejections", () => {
  it("rejects a non-object", () => {
    expect(parseScenario(42)).toMatchObject({ ok: false });
    expect(parseScenario(null)).toMatchObject({ ok: false });
  });

  it("rejects an unrelated JSON object (wrong kind)", () => {
    expect(parseScenario({ kind: "something-else" })).toMatchObject({
      ok: false,
    });
  });

  it("rejects an unsupported file version", () => {
    const env = serializeScenario(snapshot);
    expect(parseScenario({ ...env, fileVersion: "99" })).toMatchObject({
      ok: false,
    });
  });

  it("rejects an unknown tool", () => {
    const env = serializeScenario(snapshot);
    expect(parseScenario({ ...env, tool: "crystal_ball" })).toMatchObject({
      ok: false,
    });
  });

  it("rejects malformed inputs (missing numeric field)", () => {
    const env = serializeScenario(snapshot);
    const broken = {
      ...env,
      inputs: { ...env.inputs, currentAge: "old" },
    };
    expect(parseScenario(broken)).toMatchObject({ ok: false });
  });

  it("rejects an account with a bad type", () => {
    const env = serializeScenario(snapshot);
    const broken = {
      ...env,
      inputs: {
        ...env.inputs,
        accounts: [{ type: "crypto", balance: 1, allocation: {} }],
      },
    };
    expect(parseScenario(broken)).toMatchObject({ ok: false });
  });

  it("rejects a non-numeric allocation weight", () => {
    const env = serializeScenario(snapshot);
    const broken = {
      ...env,
      inputs: {
        ...env.inputs,
        accounts: [
          { type: "roth", balance: 1, allocation: { us_equity: "lots" } },
        ],
      },
    };
    expect(parseScenario(broken)).toMatchObject({ ok: false });
  });

  it("reports a PII hit as an error result (does not throw) on load", () => {
    const env = serializeScenario(snapshot);
    const leaky = {
      ...env,
      taxInputs: { ...env.taxInputs, email: "jane@example.com" },
    };
    const result = parseScenario(leaky);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/PII tripwire/);
  });

  it("rejects non-JSON text", () => {
    expect(parseScenarioJSON("{not json")).toMatchObject({ ok: false });
  });
});
