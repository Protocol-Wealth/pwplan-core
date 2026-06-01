// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * pw-planner ⇄ nexus-core PLANNING CONTRACT
 * ----------------------------------------------------------------------------
 * This file is the single source of truth for the interface between pw-planner
 * (this thin UI shell) and the nexus-core planning engine (Python / MCP).
 *
 * Dependency direction is CONSUMER-ONLY: pw-planner imports nothing from
 * nexus-core at runtime except over the network. nexus-core MUST treat these
 * shapes as a versioned contract. A breaking change to any request/response
 * shape requires a major bump of PLANNING_CONTRACT_VERSION and a coordinated
 * release (see CONTRIBUTING.md § Cross-repo contract).
 *
 * The engine exposes each of these as an MCP tool (stdio for local agents,
 * HTTP for this browser client via the planning gateway).
 *
 * INVARIANT — PII-FREE BY CONSTRUCTION:
 * No type in this file may carry client identity. Allowed: derived planning
 * variables (age, NOT date of birth) and de-identified financials. Forbidden as
 * field names anywhere: name, firstName, lastName, dob, dateOfBirth, ssn, email,
 * phone, address. Client↔run correlation is handled OUT OF BAND via an opaque,
 * non-identity-derived `subjectRef` carried as a transport header (see
 * planning-gateway.ts), never in these payloads. This invariant is enforced by
 * planning.test.ts and is what makes the thin UI safe to open-source and to
 * point at either the public MCP backend or pw-api.
 */

export const PLANNING_CONTRACT_VERSION = "0.1.0" as const;

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** ISO-4217. Engine math is currency-agnostic; this is for display + tax tables. */
export type Currency = "USD";

export type AccountType = "taxable" | "traditional" | "roth";

export type FilingStatus =
  | "single"
  | "married_joint"
  | "married_separate"
  | "head_of_household";

/** EMF regime classification emitted by nexus-core. Mirrors the regime engine. */
export type Regime =
  | "expansion"
  | "inflationary"
  | "deflationary"
  | "stagflation"
  | "crisis";

/** Return-generation model. `emf_regime` is the differentiated path: it drives
 *  the simulation off nexus-core's live EMF regime classification + per-asset
 *  λ decay coefficients rather than a generic statistical assumption. */
export type ReturnModel =
  | "multivariate_normal"
  | "student_t"
  | "block_bootstrap"
  | "markov_regime"
  | "emf_regime";

export interface AssetClass {
  /** Stable id used to key correlation matrices and per-asset λ. */
  id: string;
  label: string;
  expectedReturn: number; // annualized, decimal (0.07 = 7%)
  volatility: number; // annualized stdev, decimal
  /** EMF structural decay coefficient under stress. Required when ReturnModel
   *  is "emf_regime"; ignored otherwise. */
  lambda?: number;
}

export interface Account {
  type: AccountType;
  balance: number;
  /** Asset-class id → weight (must sum to 1 across the account). */
  allocation: Record<string, number>;
}

export interface GuaranteedIncome {
  label: string; // e.g. "Social Security", "Pension"
  annualAmount: number;
  startAge: number;
  colaRate: number; // cost-of-living adjustment, decimal
}

// ---------------------------------------------------------------------------
// Tool: monte_carlo_decumulation
// ---------------------------------------------------------------------------

export interface MonteCarloRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  currentAge: number;
  /** Age at which employment income stops and portfolio decumulation begins.
   *  Optional for wire compatibility; when omitted the engine begins drawdown
   *  at `currentAge`. The browser UI seeds 65 — without it the default
   *  8%-spend-from-age-45 scenario degenerates to ~0 success. */
  retirementAge?: number;
  horizonAge: number;
  accounts: Account[];
  assetClasses: AssetClass[];
  /** asset-class id → asset-class id → correlation. Symmetric, diagonal = 1.
   *  Omit to have the engine estimate via the correlation_matrix tool. */
  correlations?: Record<string, Record<string, number>>;
  annualSpend: number;
  spendColaRate: number;
  guaranteedIncome: GuaranteedIncome[];
  filingStatus: FilingStatus;
  returnModel: ReturnModel;
  paths: number; // e.g. 10_000
  seed?: number; // deterministic runs for audit reproducibility
}

export interface MonteCarloResult {
  contractVersion: string;
  /** Probability the plan funds the full horizon (terminal value > 0). */
  successProbability: number;
  /** Per-percentile terminal portfolio value. Keys: "p10","p25","p50",... */
  terminalValues: Record<string, number>;
  /** Year-by-year median balance for charting. Length = horizonAge-currentAge. */
  medianBalanceByYear: number[];
  /** Worst-case sequence-of-returns path terminal value. */
  worstPathTerminal: number;
  regimePathSummary?: Regime[]; // populated for regime-aware models
  seedUsed: number;
}

// ---------------------------------------------------------------------------
// Tool: glide_path
// ---------------------------------------------------------------------------

export interface GlidePathRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  currentAge: number;
  retirementAge: number;
  horizonAge: number;
  startEquityWeight: number;
  endEquityWeight: number;
  /** "linear" | "to_through" | "rising_equity" */
  shape: "linear" | "to_through" | "rising_equity";
}

export interface GlidePathResult {
  contractVersion: string;
  /** age → target equity weight. */
  equityWeightByAge: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Tool: tax_aware_withdrawal
// ---------------------------------------------------------------------------

export interface TaxWithdrawalRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  year: number; // tax year for bracket lookup
  filingStatus: FilingStatus;
  accounts: Account[];
  grossNeed: number;
  age: number; // for RMD determination
  otherTaxableIncome: number;
}

export interface TaxWithdrawalResult {
  contractVersion: string;
  /** Ordered withdrawal plan by account type. */
  withdrawals: { type: AccountType; gross: number; tax: number }[];
  totalTax: number;
  effectiveRate: number;
  rmdSatisfied: boolean;
}

// ---------------------------------------------------------------------------
// Tool: correlation_matrix
// ---------------------------------------------------------------------------

export interface CorrelationRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  assetClassIds: string[];
  /** lookback window in trading days for covariance estimation. */
  lookbackDays: number;
  /** shrinkage estimator toggle (Ledoit-Wolf in the engine). */
  shrinkage: boolean;
}

export interface CorrelationResult {
  contractVersion: string;
  matrix: Record<string, Record<string, number>>;
  asOf: string; // ISO date
}

// ---------------------------------------------------------------------------
// Tool: regime_return_generator (EMF-wired)
// ---------------------------------------------------------------------------

export interface RegimeReturnRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  assetClasses: AssetClass[]; // lambda required on each
  horizonYears: number;
  paths: number;
  seed?: number;
}

export interface RegimeReturnResult {
  contractVersion: string;
  currentRegime: Regime;
  /** Transition probabilities between regimes from the EMF classifier. */
  transitionMatrix: Record<Regime, Record<Regime, number>>;
  /** Reference to engine-side path cache; pass to monte_carlo to reuse. */
  pathCacheKey: string;
}

// ---------------------------------------------------------------------------
// Tool registry — names MUST match nexus-core MCP tool ids exactly.
// ---------------------------------------------------------------------------

export const PLANNING_TOOLS = {
  monteCarlo: "monte_carlo_decumulation",
  glidePath: "glide_path",
  taxWithdrawal: "tax_aware_withdrawal",
  correlationMatrix: "correlation_matrix",
  regimeReturnGenerator: "regime_return_generator",
} as const;

export type PlanningToolName =
  (typeof PLANNING_TOOLS)[keyof typeof PLANNING_TOOLS];
