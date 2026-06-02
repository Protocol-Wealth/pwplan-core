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
  /** A `pathCacheKey` returned by `regime_return_generator`, replayed here so the
   *  engine reuses its cached EMF paths instead of regenerating them. Omit to
   *  generate fresh; a stale/unknown key is treated as a cache miss (regenerate,
   *  not an error). */
  pathCacheKey?: string;
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
// Tool: capital_market_assumptions — "real data, fake clients"
// ---------------------------------------------------------------------------

/** Source REAL capital-market assumptions (returns, vols, λ, correlations) from
 *  the engine, then run them against fake / de-identified portfolios. The result
 *  is drop-in for a MonteCarloRequest: `assetClasses` + `correlations` slot
 *  straight into the MC payload. */
export interface CapitalMarketAssumptionsRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  /** Optional filter. Omit ⇒ the engine's full default asset universe; when
   *  provided, the engine returns exactly those ids (400 on an unknown id). */
  assetClassIds?: string[];
  /** Optional ISO date. Omit ⇒ latest available; otherwise assumptions as of
   *  that date (or the most recent on/before it). */
  asOf?: string;
}

export interface CapitalMarketAssumptionsResult {
  contractVersion: string;
  /** Real expectedReturn / volatility / lambda per asset class; lambda is
   *  populated so the result is usable with returnModel "emf_regime". */
  assetClasses: AssetClass[];
  /** Same shape as MonteCarloRequest.correlations — symmetric, diagonal = 1 —
   *  so the client can pass it straight through. */
  correlations: Record<string, Record<string, number>>;
  asOf: string; // ISO date of the assumptions, for provenance
}

// ---------------------------------------------------------------------------
// Tool: roth_conversion
// ---------------------------------------------------------------------------

/** Convert pre-tax (traditional) dollars to Roth now, paying ordinary tax this
 *  year, vs. leaving them pre-tax and taxing them in retirement. The engine
 *  computes the conversion's TRUE incremental federal tax (bracket creep), not a
 *  flat marginal rate. Educational — not tax advice. */
export interface RothConversionRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  /** This year's ordinary income before the conversion (gross; the engine
   *  applies the standard deduction). */
  currentTaxableIncome: number;
  filingStatus: FilingStatus;
  conversionAmount: number;
  growthRate: number; // annual, decimal
  years: number; // until withdrawal
  /** Marginal rate the traditional dollars would face at withdrawal, decimal. */
  retirementMarginalRate: number;
  /** Pay the conversion tax from the converted amount (true) or outside funds
   *  (false, default). */
  taxesPaidFromConversion?: boolean;
}

export interface RothConversionResult {
  contractVersion: string;
  conversionTax: number;
  effectiveConversionRate: number;
  rothSeed: number;
  externalTaxPaidToday: number;
  convertedAfterTaxValue: number;
  notConvertedAfterTaxValue: number;
  /** convertedAfterTaxValue − notConvertedAfterTaxValue (positive favors converting). */
  netBenefit: number;
  /** Retirement marginal rate above which converting wins (= effective rate). */
  breakevenRetirementRate: number;
}

// ---------------------------------------------------------------------------
// Tool: sequence_of_returns_stress
// ---------------------------------------------------------------------------

/** One ordering's outcome: terminal balance + the 0-based year it depleted
 *  (null if it funded the full horizon). */
export interface SequenceOutcome {
  terminalBalance: number;
  depletedYear: number | null;
}

/** Replay one fixed multiset of annual returns under different orderings to
 *  isolate sequence-of-returns risk. The mean is order-invariant, so the
 *  best-first vs worst-first terminal spread is pure ordering effect. */
export interface SequenceOfReturnsStressRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  initialBalance: number;
  /** Per-year net withdrawal; length defines the horizon. */
  netSpendByYear: number[];
  /** Annual returns (decimal), one per year; same length as netSpendByYear. */
  annualReturns: number[];
}

export interface SequenceOfReturnsStressResult {
  contractVersion: string;
  years: number;
  meanAnnualReturn: number;
  worstFirst: SequenceOutcome;
  bestFirst: SequenceOutcome;
  asGiven: SequenceOutcome;
  /** bestFirst.terminalBalance − worstFirst.terminalBalance. */
  sequenceRiskGap: number;
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
  capitalMarketAssumptions: "capital_market_assumptions",
  rothConversion: "roth_conversion",
  sequenceOfReturnsStress: "sequence_of_returns_stress",
} as const;

export type PlanningToolName =
  (typeof PLANNING_TOOLS)[keyof typeof PLANNING_TOOLS];
