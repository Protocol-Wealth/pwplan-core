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
// Tools: public-safe Cash Flow OS planning bridge
// ---------------------------------------------------------------------------

export type SpendingVolatility = "low" | "medium" | "high";

/** Derived monthly-close aggregates only. This is not a transaction ingestion
 *  contract: no CSV rows, merchant/payee strings, account names, household
 *  records, notes, approvals, release state, or audit trail fields. */
export interface CashflowPlanningBridgeRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  monthsAnalyzed: number;
  averageMonthlySpending: number;
  essentialMonthlySpending: number;
  lifestyleMonthlySpending: number;
  averageMonthlyIncome: number;
  averageMonthlySavings: number;
  currentCashReserve: number;
  targetCashReserveMonths: number;
  oneTimeExpenseAdjustment?: number;
  spendingVolatility?: SpendingVolatility;
}

export interface CashflowPlanningBridgeResult {
  contractVersion: string;
  monthsAnalyzed: number;
  annualSpend: number;
  normalizedAnnualSpend: number;
  essentialAnnualSpend: number;
  lifestyleAnnualSpend: number;
  annualIncome: number;
  annualSavings: number;
  savingsRate: number;
  cashReserveTarget: number;
  cashReserveGap: number;
  retirementIncomeFloor: number;
  retirementLifestyleBand: {
    lower: number;
    target: number;
    upper: number;
  };
  spendingVolatility: SpendingVolatility;
  planningWarnings: string[];
  recommendedNextTools: string[];
  assumptions: Record<string, unknown>;
  disclaimer?: string;
}

export type CashReserveStatus =
  | "underfunded"
  | "on_track"
  | "funded"
  | "overfunded";

export interface CashReserveAnalysisRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  monthlyEssentialSpending: number;
  monthlyTotalSpending: number;
  currentCashReserve: number;
  targetMonths: number;
  secondaryTargetMonths?: number;
}

export interface CashReserveAnalysisResult {
  contractVersion: string;
  targetReserve: number;
  secondaryTargetReserve: number | null;
  currentReserve: number;
  gapToTarget: number;
  gapToSecondaryTarget: number | null;
  monthsCoveredEssential: number;
  monthsCoveredTotal: number;
  status: CashReserveStatus;
  disclaimer?: string;
}

export type BudgetPacingStatus = "under" | "on_track" | "over";
export type BudgetWarningLevel = "none" | "info" | "warn" | "alert";

export interface BudgetPacingProjectionRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  monthDay: number;
  daysInMonth: number;
  monthToDateSpending: number;
  monthlyBudget: number;
  recurringRemaining?: number;
  knownOneTimeRemaining?: number;
}

export interface BudgetPacingProjectionResult {
  contractVersion: string;
  projectedMonthEndSpending: number;
  projectedVariance: number;
  budgetUsedPct: number;
  pacingStatus: BudgetPacingStatus;
  warningLevel: BudgetWarningLevel;
  assumptions: Record<string, unknown>;
  disclaimer?: string;
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
// Tool: rmd
// ---------------------------------------------------------------------------

/** Required Minimum Distribution on a traditional (pre-tax) account, via the IRS
 *  Uniform Lifetime Table. Educational — not tax advice. */
export interface RmdRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  age: number; // owner's age at year end
  balance: number; // prior-year-end traditional balance
}

export interface RmdResult {
  contractVersion: string;
  rmdStartAge: number; // SECURE 2.0 start age (73)
  applies: boolean; // false before the start age
  distributionPeriod: number; // IRS Uniform Lifetime Table factor
  rmdAmount: number; // 0 before the start age
  effectiveRate: number; // rmdAmount / balance
}

// ---------------------------------------------------------------------------
// Tool: tax_bracket_headroom (Roth-fill)
// ---------------------------------------------------------------------------

/** Marginal federal bracket + how much more ordinary income (e.g. a Roth
 *  conversion) fits before the next rate, or up to a target rate. */
export interface TaxBracketHeadroomRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  taxableIncome: number; // gross ordinary income (engine applies the std deduction)
  filingStatus: FilingStatus;
  /** Optional: also report room to fill up to this marginal rate ("Roth-fill"). */
  targetRate?: number;
}

export interface TaxBracketHeadroomResult {
  contractVersion: string;
  taxableIncome: number; // after the standard deduction
  marginalRate: number;
  bracketFloor: number;
  bracketCeiling: number | null; // null in the top bracket
  roomToNextBracket: number | null; // null in the top bracket
  nextRate: number | null; // null in the top bracket
  targetRate?: number; // echoed when requested
  roomToTargetRate?: number | null; // null when the target is at/above the top rate
}

// ---------------------------------------------------------------------------
// Tool: social_security_claiming
// ---------------------------------------------------------------------------

export interface SocialSecurityClaimRow {
  claimAge: number;
  monthlyBenefit: number;
  annualBenefit: number;
  pctOfPia: number;
}

export interface SocialSecurityBreakeven {
  earlier: number;
  later: number;
  breakevenAge: number | null;
}

/** Benefit at each claim age 62–70 from the Primary Insurance Amount (the FRA
 *  benefit) + breakeven ages between strategies. Nominal; educational. */
export interface SocialSecurityClaimingRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  piaMonthly: number; // monthly benefit at full retirement age
  fraAge?: number; // full retirement age (default 67)
}

export interface SocialSecurityClaimingResult {
  contractVersion: string;
  fraAge: number;
  pia: number;
  byClaimAge: SocialSecurityClaimRow[];
  breakevens: SocialSecurityBreakeven[];
}

// ---------------------------------------------------------------------------
// Tool: regime_conditioned_swr
// ---------------------------------------------------------------------------

/** A base safe withdrawal rate adjusted for the LIVE macro regime (the engine
 *  classifies the regime server-side; the client supplies only the base rate /
 *  balance). Illustrative overlay — not advice. */
export interface RegimeConditionedSwrRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  baseSwr?: number; // default 0.04
  portfolioBalance?: number; // optional, for a first-year withdrawal figure
}

export interface RegimeConditionedSwrResult {
  contractVersion: string;
  regime: Regime; // the live regime the engine classified
  baseSwr: number;
  regimeMultiplier: number;
  adjustedSwr: number;
  firstYearWithdrawal?: number; // present when a balance was supplied
}

// ---------------------------------------------------------------------------
// Tool: portfolio_xray
// ---------------------------------------------------------------------------

export type XraySeverity = "info" | "warn" | "alert";

export interface XrayFinding {
  id: string;
  severity: XraySeverity;
  title: string;
  detail: string;
}

/** Regime-aware structural diagnostics for a de-identified portfolio. Takes the
 *  same shared portfolio as Monte Carlo (asset classes + accounts); the engine
 *  classifies the LIVE regime server-side and conditions the findings on it. */
export interface PortfolioXrayRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  assetClasses: AssetClass[];
  accounts: Account[];
}

export interface PortfolioXrayResult {
  contractVersion: string;
  regime: Regime; // the live regime the findings are conditioned on
  weightedExpectedReturn: number;
  /** Weight-weighted average asset volatility (diversification-naive; an upper bound). */
  weightedAvgVolatility: number;
  portfolioLambda: number; // EMF regime sensitivity
  growthAllocation: number; // weight in assets with vol >= ~12%
  concentration: {
    maxWeight: number;
    maxWeightAsset: string;
    herfindahl: number;
    effectiveHoldings: number;
  };
  accountMix: { taxable: number; traditional: number; roth: number };
  findings: XrayFinding[];
}

// ---------------------------------------------------------------------------
// Tool: fire (FIRE / Coast-FIRE)
// ---------------------------------------------------------------------------

/** FIRE / Coast-FIRE accumulation math: the FIRE number (spend ÷ safe withdrawal
 *  rate), the coast number needed today, and years/age to financial independence
 *  with level contributions. A single nominal growth rate; educational. */
export interface FireRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  currentAge: number;
  retirementAge: number;
  currentBalance: number;
  annualContribution: number;
  growthRate: number; // nominal annual, decimal
  annualSpend: number; // target retirement spend, today's dollars
  swr?: number; // safe withdrawal rate for the FIRE number (default 0.04)
}

export interface FireResult {
  contractVersion: string;
  fireNumber: number; // annualSpend / swr
  coastNumber: number; // balance needed today to coast to fireNumber
  coastReached: boolean;
  projectedBalanceAtRetirement: number; // existing + contributions, compounded
  surplusOrGapAtRetirement: number; // projected − fireNumber (>0 is a surplus)
  yearsToFire: number | null; // null if not reached within the search cap
  fireAge: number | null; // currentAge + yearsToFire, or null
}

// ---------------------------------------------------------------------------
// Tool: risk_metrics
// ---------------------------------------------------------------------------

/** Ex-post risk statistics for a realized (or simulated) periodic return series.
 *  Descriptive analysis of the supplied series — not a forecast, not advice. */
export interface RiskMetricsRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  /** Simple per-period returns (decimal); need >= 2, each > -1. */
  returns: number[];
  riskFreeRate?: number; // annual, decimal (default 0)
  periodsPerYear?: number; // 1 annual, 12 monthly, 252 daily (default 1)
}

export interface RiskMetricsResult {
  contractVersion: string;
  periods: number;
  annualizedReturn: number; // geometric
  annualizedVolatility: number; // sample stdev, annualized
  sharpe: number;
  sortino: number;
  maxDrawdown: number; // negative fraction (peak-to-trough)
  valueAtRisk95: number; // positive loss fraction at 95% confidence
  conditionalVaR95: number; // mean loss in the worst-5% tail
}

// ---------------------------------------------------------------------------
// Tool: rebalance (rebalance-to-target)
// ---------------------------------------------------------------------------

export interface RebalanceRow {
  id: string;
  currentWeight: number;
  targetWeight: number;
  drift: number; // current − target
  tradeAmount: number; // >0 buy, <0 sell
}

/** Drift + self-financing trades to move the shared portfolio (asset classes +
 *  accounts) to `targetWeights`. Illustrative — not a trade instruction. */
export interface RebalanceRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  assetClasses: AssetClass[];
  accounts: Account[];
  /** Target weight per declared asset-class id; must sum to 1. */
  targetWeights: Record<string, number>;
}

export interface RebalanceResult {
  contractVersion: string;
  totalValue: number;
  turnover: number; // one-way turnover (buys == sells)
  perAsset: RebalanceRow[];
}

// ---------------------------------------------------------------------------
// Tool: optimize_allocation
// ---------------------------------------------------------------------------

/** Risk-tolerance band; the engine maps it to an objective / risk-aversion when
 *  none is given explicitly. */
export type RiskProfile =
  | "conservative"
  | "moderate_conservative"
  | "moderate"
  | "moderate_aggressive"
  | "aggressive";

/** Mean-variance optimization objective (the engine's PyPortfolioOpt-style set). */
export type AllocationObjective =
  | "max_sharpe"
  | "min_volatility"
  | "max_quadratic_utility"
  | "efficient_return"
  | "efficient_risk";

/** Mean-variance optimal weights for the (real-data) asset universe. The client
 *  picks a risk profile and/or an explicit objective; the engine sources the
 *  expected returns / covariance and solves. `regimeAware` lets the live EMF
 *  regime select the objective. Illustrative — not advice. */
export interface OptimizeAllocationRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  /** Optional universe filter. Omit ⇒ the engine's full default asset universe;
   *  when provided, the engine optimizes over exactly those ids. */
  assetClassIds?: string[];
  riskProfile?: RiskProfile;
  objective?: AllocationObjective;
  /** Risk-aversion for max_quadratic_utility (higher ⇒ more conservative). */
  riskAversion?: number;
  /** Target annual return for efficient_return, decimal. */
  targetReturn?: number;
  /** Target annual volatility for efficient_risk, decimal. */
  targetVolatility?: number;
  /** Per-asset [min, max] weight bounds; defaults to long-only [0, 1]. */
  weightBounds?: [number, number];
  returnModel?: "house_view" | "historical";
  /** Let the live EMF regime select the objective (overrides a default). */
  regimeAware?: boolean;
  riskFreeRate?: number; // annual, decimal
  lookbackDays?: number; // covariance estimation window
  asOf?: string; // ISO date; omit ⇒ latest
}

export interface AllocationAssetClass {
  id: string;
  label: string;
  expectedReturn: number; // annualized, decimal
  volatility: number; // annualized stdev, decimal
  weight: number; // optimal weight, decimal
}

export interface OptimizeAllocationResult {
  contractVersion: string;
  /** asset-class id → optimal weight. */
  weights: Record<string, number>;
  assetClasses: AllocationAssetClass[];
  objective: AllocationObjective;
  /** How the objective was chosen. */
  objectiveSource: "explicit" | "riskProfile" | "regime" | "default";
  returnModel: "house_view" | "historical";
  expectedReturn: number | null;
  expectedVolatility: number | null;
  sharpeRatio: number | null;
  riskFreeRate: number;
  weightBounds: [number, number];
  regime: string; // the live regime at solve time (provenance / regimeAware)
  asOf: string; // ISO date of the assumptions used
  riskProfile?: RiskProfile;
  riskAversion?: number;
  regimeNote?: string; // present when the regime informed the objective
}

// ---------------------------------------------------------------------------
// Tool: build_planning_report
// ---------------------------------------------------------------------------

/** One requested report section. `kind` is a free string the engine recognizes
 *  (e.g. "summary", "allocation"); `data` carries de-identified planning numbers
 *  to render. PII-free by construction (see the file-level invariant). */
export interface PlanningReportSectionInput {
  kind: string;
  title?: string;
  data?: Record<string, unknown>;
  findings?: string[];
  assumptions?: string[];
}

/** Assemble the supplied de-identified sections into an ordered report; the
 *  engine normalizes titles, collates findings, and (optionally) annotates the
 *  live regime. Pure assembly — no quant logic. Educational, not advice. */
export interface BuildPlanningReportRequest {
  contractVersion: typeof PLANNING_CONTRACT_VERSION;
  sections: PlanningReportSectionInput[];
  title?: string;
  includeRegime?: boolean;
}

export interface PlanningReportSection {
  kind: string;
  title: string;
  findings: string[];
  data: Record<string, unknown>;
}

export interface PlanningReport {
  title: string;
  sections: PlanningReportSection[];
  assumptions: string[];
  regime?: string; // present when includeRegime requested it
}

export interface BuildPlanningReportResult {
  contractVersion: string;
  report: PlanningReport;
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
  cashflowPlanningBridge: "cashflow_planning_bridge",
  cashReserveAnalysis: "cash_reserve_analysis",
  budgetPacingProjection: "budget_pacing_projection",
  rothConversion: "roth_conversion",
  sequenceOfReturnsStress: "sequence_of_returns_stress",
  rmd: "rmd",
  taxBracketHeadroom: "tax_bracket_headroom",
  socialSecurityClaiming: "social_security_claiming",
  regimeConditionedSwr: "regime_conditioned_swr",
  portfolioXray: "portfolio_xray",
  fire: "fire",
  riskMetrics: "risk_metrics",
  rebalance: "rebalance",
  optimizeAllocation: "optimize_allocation",
  buildPlanningReport: "build_planning_report",
} as const;

export type PlanningToolName =
  (typeof PLANNING_TOOLS)[keyof typeof PLANNING_TOOLS];
