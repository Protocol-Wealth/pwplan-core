// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * scenario-presets — built-in, PII-free example scenarios for demos and
 * case-study variations. Each preset is a full ScenarioSnapshot (the same shape
 * the store loads and scenario-io serializes), so loading one is identical to
 * loading a saved file.
 *
 * These are illustrative inputs only — no quant logic, no real client data, and
 * no identity. Every allocation sums to 1 per account so a loaded preset is
 * immediately runnable. Returns/volatilities are round demo numbers, NOT
 * Protocol Wealth capital-market assumptions (those come from the engine).
 */

import type { ScenarioSnapshot } from "./scenario-io";

export interface ScenarioPreset {
  id: string;
  label: string;
  description: string;
  snapshot: ScenarioSnapshot;
}

const EQUITY = {
  id: "us_equity",
  label: "US Equity",
  expectedReturn: 0.07,
  volatility: 0.16,
  lambda: 0.35,
};
const BONDS = {
  id: "us_bonds",
  label: "US Bonds",
  expectedReturn: 0.03,
  volatility: 0.05,
  lambda: 0.1,
};

const DEFAULT_TOOL_INPUTS: Omit<
  ScenarioSnapshot,
  "tool" | "inputs" | "glidePathInputs" | "taxInputs"
> = {
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
    returnsText: "0.07, 0.05, -0.10, 0.12, 0.04",
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
    returnsText: "0.12, -0.08, 0.21, 0.15, -0.18",
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
      {
        kind: "allocation",
        title: "Allocation",
        findingsText: "Growth sleeve sized to the moderate risk profile.",
      },
    ],
  },
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "accumulator",
    label: "Accumulator (age 35)",
    description:
      "Early-career saver, long horizon, equity-heavy, still contributing. Tests growth and sequence risk far from retirement.",
    snapshot: {
      tool: "monte_carlo",
      inputs: {
        currentAge: 35,
        retirementAge: 67,
        horizonAge: 95,
        filingStatus: "single",
        annualSpend: 70_000,
        spendColaRate: 0.025,
        assetClasses: [EQUITY, BONDS],
        accounts: [
          {
            type: "traditional",
            balance: 250_000,
            allocation: { us_equity: 0.9, us_bonds: 0.1 },
          },
          {
            type: "taxable",
            balance: 100_000,
            allocation: { us_equity: 0.85, us_bonds: 0.15 },
          },
        ],
        guaranteedIncome: [
          {
            label: "Social Security",
            annualAmount: 30_000,
            startAge: 67,
            colaRate: 0.02,
          },
        ],
        returnModel: "emf_regime",
        paths: 10_000,
      },
      glidePathInputs: {
        currentAge: 35,
        retirementAge: 67,
        horizonAge: 95,
        startEquityWeight: 0.9,
        endEquityWeight: 0.4,
        shape: "linear",
      },
      taxInputs: {
        year: 2026,
        age: 35,
        filingStatus: "single",
        grossNeed: 70_000,
        otherTaxableIncome: 0,
      },
      ...DEFAULT_TOOL_INPUTS,
    },
  },
  {
    id: "near-retiree",
    label: "Near-retiree (age 62)",
    description:
      "Five years from retirement, balanced allocation, Social Security soon. Tests withdrawal readiness and tax ordering across account types.",
    snapshot: {
      tool: "tax_withdrawal",
      inputs: {
        currentAge: 62,
        retirementAge: 65,
        horizonAge: 92,
        filingStatus: "married_joint",
        annualSpend: 130_000,
        spendColaRate: 0.025,
        assetClasses: [EQUITY, BONDS],
        accounts: [
          {
            type: "traditional",
            balance: 1_600_000,
            allocation: { us_equity: 0.55, us_bonds: 0.45 },
          },
          {
            type: "roth",
            balance: 400_000,
            allocation: { us_equity: 0.7, us_bonds: 0.3 },
          },
          {
            type: "taxable",
            balance: 500_000,
            allocation: { us_equity: 0.5, us_bonds: 0.5 },
          },
        ],
        guaranteedIncome: [
          {
            label: "Social Security",
            annualAmount: 48_000,
            startAge: 67,
            colaRate: 0.02,
          },
          {
            label: "Pension",
            annualAmount: 24_000,
            startAge: 65,
            colaRate: 0.0,
          },
        ],
        returnModel: "emf_regime",
        paths: 10_000,
      },
      glidePathInputs: {
        currentAge: 62,
        retirementAge: 65,
        horizonAge: 92,
        startEquityWeight: 0.6,
        endEquityWeight: 0.35,
        shape: "to_through",
      },
      taxInputs: {
        year: 2026,
        age: 65,
        filingStatus: "married_joint",
        grossNeed: 130_000,
        otherTaxableIncome: 24_000,
      },
      ...DEFAULT_TOOL_INPUTS,
    },
  },
  {
    id: "crisis-stress",
    label: "Crisis stress (age 70, RMDs)",
    description:
      "Retiree drawing down through a stressed regime, taking RMDs, high spend relative to assets. Tests downside and sequence-of-returns risk.",
    snapshot: {
      tool: "monte_carlo",
      inputs: {
        currentAge: 70,
        retirementAge: 70,
        horizonAge: 95,
        filingStatus: "married_joint",
        annualSpend: 160_000,
        spendColaRate: 0.03,
        assetClasses: [EQUITY, BONDS],
        accounts: [
          {
            type: "traditional",
            balance: 1_800_000,
            allocation: { us_equity: 0.5, us_bonds: 0.5 },
          },
          {
            type: "roth",
            balance: 200_000,
            allocation: { us_equity: 0.6, us_bonds: 0.4 },
          },
        ],
        guaranteedIncome: [
          {
            label: "Social Security",
            annualAmount: 52_000,
            startAge: 70,
            colaRate: 0.02,
          },
        ],
        returnModel: "emf_regime",
        paths: 10_000,
      },
      glidePathInputs: {
        currentAge: 70,
        retirementAge: 70,
        horizonAge: 95,
        startEquityWeight: 0.5,
        endEquityWeight: 0.3,
        shape: "linear",
      },
      taxInputs: {
        year: 2026,
        age: 73,
        filingStatus: "married_joint",
        grossNeed: 160_000,
        otherTaxableIncome: 52_000,
      },
      ...DEFAULT_TOOL_INPUTS,
    },
  },
];

/** Look up a preset by id (used by the UI selector). */
export function findPreset(id: string): ScenarioPreset | undefined {
  return SCENARIO_PRESETS.find((p) => p.id === id);
}
