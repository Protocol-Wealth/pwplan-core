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
  RothConversionResult,
  SequenceOfReturnsStressResult,
  RmdResult,
  TaxBracketHeadroomResult,
  SocialSecurityClaimingResult,
  RegimeConditionedSwrResult,
  TaxWithdrawalResult,
} from "../contract/planning";

/** Which planning tool the UI is currently showing. */
export type PlanningTool =
  | "monte_carlo"
  | "glide_path"
  | "tax_withdrawal"
  | "roth_conversion"
  | "sequence_stress"
  | "rmd"
  | "bracket_headroom"
  | "social_security"
  | "regime_swr";

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

export interface RothInputs {
  currentTaxableIncome: number;
  filingStatus: FilingStatus;
  conversionAmount: number;
  growthRate: number;
  years: number;
  retirementMarginalRate: number;
  taxesPaidFromConversion: boolean;
}

export interface SorInputs {
  initialBalance: number;
  /** Constant net withdrawal applied each year (kept simple for the demo UI). */
  annualSpend: number;
  /** Comma/space-separated annual returns (decimals), parsed at dispatch. */
  returnsText: string;
}

export interface RmdInputs {
  age: number;
  balance: number;
}

export interface BracketHeadroomInputs {
  taxableIncome: number;
  filingStatus: FilingStatus;
  targetRate: number;
}

export interface SocialSecurityInputs {
  piaMonthly: number;
  fraAge: number;
}

export interface RegimeSwrInputs {
  baseSwr: number;
  portfolioBalance: number;
}

/**
 * Live, engine-sourced capital-market assumptions (the "real data, fake clients"
 * flow). Fetched from the `capital_market_assumptions` tool and threaded into the
 * Monte Carlo run as `correlations`; the refreshed per-asset returns/vols/λ land
 * directly in `inputs.assetClasses`. Deliberately NOT part of `ScenarioInputs`:
 * it is live data, re-fetched rather than persisted, so it is cleared on load.
 */
export interface MarketAssumptions {
  /** ISO date the engine's assumptions are as-of (provenance). */
  asOf: string;
  /** assetClassId → assetClassId → ρ; drop-in for MonteCarloRequest.correlations. */
  correlations: Record<string, Record<string, number>>;
}

interface ScenarioState {
  tool: PlanningTool;

  inputs: ScenarioInputs;
  glidePathInputs: GlidePathInputs;
  taxInputs: TaxWithdrawalInputs;
  rothInputs: RothInputs;
  sorInputs: SorInputs;
  rmdInputs: RmdInputs;
  bracketInputs: BracketHeadroomInputs;
  socialSecurityInputs: SocialSecurityInputs;
  regimeSwrInputs: RegimeSwrInputs;

  result: MonteCarloResult | null;
  glidePathResult: GlidePathResult | null;
  taxResult: TaxWithdrawalResult | null;
  rothResult: RothConversionResult | null;
  sorResult: SequenceOfReturnsStressResult | null;
  rmdResult: RmdResult | null;
  bracketResult: TaxBracketHeadroomResult | null;
  socialSecurityResult: SocialSecurityClaimingResult | null;
  regimeSwrResult: RegimeConditionedSwrResult | null;

  /** Live engine assumptions from capital_market_assumptions; null until loaded. */
  assumptions: MarketAssumptions | null;
  loadingAssumptions: boolean;

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
  setRothInputs: (patch: Partial<RothInputs>) => void;
  setSorInputs: (patch: Partial<SorInputs>) => void;
  setRmdInputs: (patch: Partial<RmdInputs>) => void;
  setBracketInputs: (patch: Partial<BracketHeadroomInputs>) => void;
  setSocialSecurityInputs: (patch: Partial<SocialSecurityInputs>) => void;
  setRegimeSwrInputs: (patch: Partial<RegimeSwrInputs>) => void;
  setResult: (r: MonteCarloResult | null) => void;
  setGlidePathResult: (r: GlidePathResult | null) => void;
  setTaxResult: (r: TaxWithdrawalResult | null) => void;
  setRothResult: (r: RothConversionResult | null) => void;
  setSorResult: (r: SequenceOfReturnsStressResult | null) => void;
  setRmdResult: (r: RmdResult | null) => void;
  setBracketResult: (r: TaxBracketHeadroomResult | null) => void;
  setSocialSecurityResult: (r: SocialSecurityClaimingResult | null) => void;
  setRegimeSwrResult: (r: RegimeConditionedSwrResult | null) => void;
  setAssumptions: (a: MarketAssumptions | null) => void;
  setLoadingAssumptions: (b: boolean) => void;
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

const DEFAULT_ROTH: RothInputs = {
  currentTaxableIncome: 150_000,
  filingStatus: "married_joint",
  conversionAmount: 100_000,
  growthRate: 0.06,
  years: 15,
  retirementMarginalRate: 0.24,
  taxesPaidFromConversion: false,
};

const DEFAULT_SOR: SorInputs = {
  initialBalance: 1_000_000,
  annualSpend: 50_000,
  returnsText: "0.07, 0.05, -0.10, 0.12, 0.04, -0.03, 0.09, 0.06, 0.02, 0.08",
};

const DEFAULT_RMD: RmdInputs = {
  age: 73,
  balance: 500_000,
};

const DEFAULT_BRACKET: BracketHeadroomInputs = {
  taxableIncome: 100_000,
  filingStatus: "married_joint",
  targetRate: 0.24,
};

const DEFAULT_SOCIAL_SECURITY: SocialSecurityInputs = {
  piaMonthly: 2_500,
  fraAge: 67,
};

const DEFAULT_REGIME_SWR: RegimeSwrInputs = {
  baseSwr: 0.04,
  portfolioBalance: 1_000_000,
};

export const useScenario = create<ScenarioState>((set) => ({
  tool: "monte_carlo",

  inputs: DEFAULT_INPUTS,
  glidePathInputs: DEFAULT_GLIDE_PATH,
  taxInputs: DEFAULT_TAX,
  rothInputs: DEFAULT_ROTH,
  sorInputs: DEFAULT_SOR,
  rmdInputs: DEFAULT_RMD,
  bracketInputs: DEFAULT_BRACKET,
  socialSecurityInputs: DEFAULT_SOCIAL_SECURITY,
  regimeSwrInputs: DEFAULT_REGIME_SWR,

  result: null,
  glidePathResult: null,
  taxResult: null,
  rothResult: null,
  sorResult: null,
  rmdResult: null,
  bracketResult: null,
  socialSecurityResult: null,
  regimeSwrResult: null,

  assumptions: null,
  loadingAssumptions: false,

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
      // Assumptions are live engine data tied to the prior inputs; drop them so a
      // loaded plan does not silently reuse a stale correlation matrix.
      assumptions: null,
      error: null,
      running: false,
    }),
  setInputs: (patch) => set((s) => ({ inputs: { ...s.inputs, ...patch } })),
  setGlidePathInputs: (patch) =>
    set((s) => ({ glidePathInputs: { ...s.glidePathInputs, ...patch } })),
  setTaxInputs: (patch) =>
    set((s) => ({ taxInputs: { ...s.taxInputs, ...patch } })),
  setRothInputs: (patch) =>
    set((s) => ({ rothInputs: { ...s.rothInputs, ...patch } })),
  setSorInputs: (patch) =>
    set((s) => ({ sorInputs: { ...s.sorInputs, ...patch } })),
  setRmdInputs: (patch) =>
    set((s) => ({ rmdInputs: { ...s.rmdInputs, ...patch } })),
  setBracketInputs: (patch) =>
    set((s) => ({ bracketInputs: { ...s.bracketInputs, ...patch } })),
  setSocialSecurityInputs: (patch) =>
    set((s) => ({
      socialSecurityInputs: { ...s.socialSecurityInputs, ...patch },
    })),
  setRegimeSwrInputs: (patch) =>
    set((s) => ({ regimeSwrInputs: { ...s.regimeSwrInputs, ...patch } })),
  setResult: (result) => set({ result }),
  setGlidePathResult: (glidePathResult) => set({ glidePathResult }),
  setTaxResult: (taxResult) => set({ taxResult }),
  setRothResult: (rothResult) => set({ rothResult }),
  setSorResult: (sorResult) => set({ sorResult }),
  setRmdResult: (rmdResult) => set({ rmdResult }),
  setBracketResult: (bracketResult) => set({ bracketResult }),
  setSocialSecurityResult: (socialSecurityResult) =>
    set({ socialSecurityResult }),
  setRegimeSwrResult: (regimeSwrResult) => set({ regimeSwrResult }),
  setAssumptions: (assumptions) => set({ assumptions }),
  setLoadingAssumptions: (loadingAssumptions) => set({ loadingAssumptions }),
  setRunning: (running) => set({ running }),
  setError: (error) => set({ error }),
}));
