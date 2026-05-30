// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * scenario store — client-side plan state. Holds the inputs and latest engine
 * result for each planning tool (Monte Carlo, glide path, tax withdrawal). No
 * PII leaves this store without passing through compliance.
 *
 * Accounts and asset classes are a single shared portfolio: both the Monte
 * Carlo and tax-withdrawal requests take the contract's `Account[]`, so they
 * read the same `inputs.accounts` rather than re-collecting them.
 */

import { create } from "zustand";
import type {
  Account,
  AssetClass,
  FilingStatus,
  GlidePathRequest,
  GlidePathResult,
  GuaranteedIncome,
  MonteCarloResult,
  ReturnModel,
  TaxWithdrawalResult,
} from "../contract/planning";

/** Which planning tool the UI is currently showing. */
export type PlanningTool = "monte_carlo" | "glide_path" | "tax_withdrawal";

/** Glide-path shape, derived from the wire contract (no new wire type). */
export type GlidePathShape = GlidePathRequest["shape"];

export interface ScenarioInputs {
  currentAge: number;
  retirementAge: number;
  horizonAge: number;
  filingStatus: FilingStatus;
  annualSpend: number;
  spendColaRate: number;
  accounts: Account[];
  assetClasses: AssetClass[];
  guaranteedIncome: GuaranteedIncome[];
  returnModel: ReturnModel;
  paths: number;
}

export interface GlidePathInputs {
  currentAge: number;
  retirementAge: number;
  horizonAge: number;
  startEquityWeight: number;
  endEquityWeight: number;
  shape: GlidePathShape;
}

export interface TaxWithdrawalInputs {
  year: number;
  age: number;
  filingStatus: FilingStatus;
  grossNeed: number;
  otherTaxableIncome: number;
}

interface ScenarioState {
  tool: PlanningTool;

  inputs: ScenarioInputs;
  glidePathInputs: GlidePathInputs;
  taxInputs: TaxWithdrawalInputs;

  result: MonteCarloResult | null;
  glidePathResult: GlidePathResult | null;
  taxResult: TaxWithdrawalResult | null;

  running: boolean;
  error: string | null;

  setTool: (tool: PlanningTool) => void;
  /** Replace all plan inputs at once (e.g. loading a saved scenario or a
   *  preset). Clears stale results + error so panels do not show a prior run. */
  loadSnapshot: (snapshot: {
    tool: PlanningTool;
    inputs: ScenarioInputs;
    glidePathInputs: GlidePathInputs;
    taxInputs: TaxWithdrawalInputs;
  }) => void;
  setInputs: (patch: Partial<ScenarioInputs>) => void;
  setGlidePathInputs: (patch: Partial<GlidePathInputs>) => void;
  setTaxInputs: (patch: Partial<TaxWithdrawalInputs>) => void;
  setResult: (r: MonteCarloResult | null) => void;
  setGlidePathResult: (r: GlidePathResult | null) => void;
  setTaxResult: (r: TaxWithdrawalResult | null) => void;
  setRunning: (b: boolean) => void;
  setError: (e: string | null) => void;
}

const DEFAULT_INPUTS: ScenarioInputs = {
  currentAge: 45,
  retirementAge: 65,
  horizonAge: 95,
  filingStatus: "married_joint",
  annualSpend: 120_000,
  spendColaRate: 0.025,
  // Seeded with a valid, balanced scenario so the expanded form is usable out
  // of the box and the allocation invariant (weights sum to 1) holds initially.
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
      lambda: 0.1,
    },
  ],
  accounts: [
    {
      type: "traditional",
      balance: 1_200_000,
      allocation: { us_equity: 0.6, us_bonds: 0.4 },
    },
    {
      type: "roth",
      balance: 300_000,
      allocation: { us_equity: 0.8, us_bonds: 0.2 },
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
};

const DEFAULT_GLIDE_PATH: GlidePathInputs = {
  currentAge: 45,
  retirementAge: 65,
  horizonAge: 95,
  startEquityWeight: 0.7,
  endEquityWeight: 0.3,
  shape: "linear",
};

const DEFAULT_TAX: TaxWithdrawalInputs = {
  year: 2026,
  age: 65,
  filingStatus: "married_joint",
  grossNeed: 120_000,
  otherTaxableIncome: 0,
};

export const useScenario = create<ScenarioState>((set) => ({
  tool: "monte_carlo",

  inputs: DEFAULT_INPUTS,
  glidePathInputs: DEFAULT_GLIDE_PATH,
  taxInputs: DEFAULT_TAX,

  result: null,
  glidePathResult: null,
  taxResult: null,

  running: false,
  error: null,

  // Switching tools clears any stale error so a failure from one tool does not
  // bleed into another's panel. Each tool keeps its own result slot.
  setTool: (tool) => set({ tool, error: null }),
  loadSnapshot: (snapshot) =>
    set({
      tool: snapshot.tool,
      inputs: snapshot.inputs,
      glidePathInputs: snapshot.glidePathInputs,
      taxInputs: snapshot.taxInputs,
      result: null,
      glidePathResult: null,
      taxResult: null,
      error: null,
      running: false,
    }),
  setInputs: (patch) => set((s) => ({ inputs: { ...s.inputs, ...patch } })),
  setGlidePathInputs: (patch) =>
    set((s) => ({ glidePathInputs: { ...s.glidePathInputs, ...patch } })),
  setTaxInputs: (patch) =>
    set((s) => ({ taxInputs: { ...s.taxInputs, ...patch } })),
  setResult: (result) => set({ result }),
  setGlidePathResult: (glidePathResult) => set({ glidePathResult }),
  setTaxResult: (taxResult) => set({ taxResult }),
  setRunning: (running) => set({ running }),
  setError: (error) => set({ error }),
}));
