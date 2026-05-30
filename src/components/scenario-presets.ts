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
    },
  },
];

/** Look up a preset by id (used by the UI selector). */
export function findPreset(id: string): ScenarioPreset | undefined {
  return SCENARIO_PRESETS.find((p) => p.id === id);
}
