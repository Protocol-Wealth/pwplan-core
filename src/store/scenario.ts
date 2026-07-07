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
  CorrelationResult,
  RegimeReturnResult,
  PortfolioXrayResult,
  FireResult,
  RiskMetricsResult,
  IncomeLayeringResult,
  RebalanceResult,
  OptimizeAllocationResult,
  BuildPlanningReportResult,
  RiskProfileScoreResult,
  BudgetPacingProjectionRequest,
  BudgetPacingProjectionResult,
  CashReserveAnalysisRequest,
  CashReserveAnalysisResult,
  CashflowPlanningBridgeRequest,
  CashflowPlanningBridgeResult,
  EducationFundingRequest,
  EducationFundingResult,
  EducationVehicleRulesResult,
  RiskProfile,
  IncomeStreamInput,
  AllocationObjective,
  SpendingVolatility,
  TaxWithdrawalResult,
  PlanningReportPreset,
  WealthRoadmapScope,
} from "../contract/planning";
import { DEFAULT_INCOME_LAYERING_INPUTS } from "../lib/income-layering-defaults";
import { DEFAULT_RISK_PROFILE_ANSWERS } from "../lib/risk-profile-questionnaire";
import type {
  ContractFilingStatus,
  RothConversionAnalysis,
  TargetRule,
} from "../contract/roth-conversion";

/** Which planning tool the UI is currently showing. */
export type PlanningTool =
  | "monte_carlo"
  | "glide_path"
  | "tax_withdrawal"
  | "roth_conversion"
  | "roth_irmaa"
  | "sequence_stress"
  | "rmd"
  | "bracket_headroom"
  | "social_security"
  | "regime_swr"
  | "correlation"
  | "regime_paths"
  | "portfolio_xray"
  | "fire"
  | "risk_metrics"
  | "income_layering"
  | "risk_profile"
  | "rebalance"
  | "optimize_allocation"
  | "build_report"
  | "education"
  | "cashflow_bridge"
  | "compare";

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

/** Form state for the composite Roth/IRMAA planner. Maps to a PlanningContract
 *  (case contract v1.1.0); `case_id` is generated opaquely at dispatch, never
 *  collected here. */
export interface RothIrmaaInputs {
  taxYear: number;
  filingStatus: ContractFilingStatus;
  stateCode: string;
  birthYearSelf: number;
  birthYearSpouse: number;
  medicareEnrolled: number;
  /** 1..5 conversion years starting at taxYear. */
  conversionYears: number;
  targetRule: TargetRule;
  targetRate: number;
  fixedAmount: number;
  // income (ex-conversion)
  pension: number;
  socialSecurityGross: number;
  taxableInterest: number;
  taxExemptInterest: number;
  ordinaryDividends: number;
  qualifiedDividends: number;
  longTermGains: number;
  // accounts
  tradIraAggregate: number;
  nondeductibleBasis: number;
  taxableLiquidity: number;
  employerPlanAggregate: number;
  // assumptions (snapshotted in the result)
  irmaaInflation: number;
  irmaaBuffer: number;
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

export interface CorrelationInputs {
  /** Comma/space-separated asset-class ids (must be in the engine's universe). */
  assetClassIdsText: string;
  lookbackDays: number;
  shrinkage: boolean;
}

export interface RegimeGenInputs {
  /** Uses the shared portfolio's asset classes (each needs a λ). */
  horizonYears: number;
  paths: number;
}

export interface FireInputs {
  currentAge: number;
  retirementAge: number;
  currentBalance: number;
  annualContribution: number;
  growthRate: number;
  annualSpend: number;
  swr: number;
}

export interface RiskMetricsInputs {
  /** Comma/space-separated per-period returns (decimals), parsed at dispatch. */
  returnsText: string;
  riskFreeRate: number;
  periodsPerYear: number;
}

export type IncomeLayeringStreamDraft = Omit<
  IncomeStreamInput,
  "endAge" | "colaRate"
> & {
  /** 0 means open-ended in the UI and is omitted from the wire request. */
  endAge: number;
  colaRate: number;
};

export interface IncomeLayeringInputs {
  currentAge: number;
  retirementAge: number;
  terminalAge: number;
  spendingTarget: number;
  earnedIncome: number;
  wageGrowthRate: number;
  spendingInflationRate: number;
  filingStatus: FilingStatus;
  taxYear: number;
  baseYear: number;
  expectedReturn: number;
  bracketFillTargetRate: number;
  /** Year-only, not DOB. 0 means omit and let the engine default policy apply. */
  birthYear: number;
  /** Two-letter state code, blank means omit. */
  stateCode: string;
  primaryPiaMonthly: number;
  primaryClaimAge: number;
  primaryFraAge: number;
  primaryColaRate: number;
  spousePiaMonthly: number;
  spouseClaimAge: number;
  spouseFraAge: number;
  spouseColaRate: number;
  incomeStreams: IncomeLayeringStreamDraft[];
  /** 0 means no survivor-year switch. */
  survivorYear: number;
  survivorFilingStatus: FilingStatus;
}

export interface RiskProfileScoreInputs {
  /** Fixed questionnaire answer ids keyed by canonical question id. */
  answers: Record<string, string>;
}

export interface RebalanceInputs {
  /** Target weight per shared-portfolio asset-class id; must sum to 1. */
  targetWeights: Record<string, number>;
}

export interface OptimizeAllocationInputs {
  riskProfile: RiskProfile;
  /** "" ⇒ let the risk profile / regime choose; otherwise overrides it. */
  objective: AllocationObjective | "";
  /** Comma/space-separated asset-class id subset; "" ⇒ the full default universe. */
  assetClassIdsText: string;
  weightMin: number;
  weightMax: number;
  returnModel: "house_view" | "historical";
  regimeAware: boolean;
  riskFreeRate: number;
}

/** A single de-identified report section row in the editor. `findingsText` is
 *  newline-separated and split at dispatch. */
export interface ReportSectionDraft {
  kind: string;
  title: string;
  findingsText: string;
}

export interface BuildPlanningReportInputs {
  title: string;
  includeRegime: boolean;
  preset: PlanningReportPreset;
  scope: WealthRoadmapScope;
  assumptionVersion: string;
  cmaVersion: string;
  taxYear: number;
  seed: number;
  engineReference: string;
  sections: ReportSectionDraft[];
}

export type CashflowPlanningBridgeInputs = Omit<
  CashflowPlanningBridgeRequest,
  "contractVersion" | "oneTimeExpenseAdjustment" | "spendingVolatility"
> & {
  oneTimeExpenseAdjustment: number;
  spendingVolatility: SpendingVolatility;
};

export type CashReserveAnalysisInputs = Omit<
  CashReserveAnalysisRequest,
  "contractVersion" | "secondaryTargetMonths"
> & {
  secondaryTargetMonths: number;
};

export type BudgetPacingProjectionInputs = Omit<
  BudgetPacingProjectionRequest,
  "contractVersion" | "recurringRemaining" | "knownOneTimeRemaining"
> & {
  recurringRemaining: number;
  knownOneTimeRemaining: number;
};

export type EducationFundingInputs = Omit<
  EducationFundingRequest,
  "contractVersion"
> & {
  taxYear: number;
  selectedVehicle: string;
};

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

export interface CompareScenario {
  id: string;
  label: string;
  snapshot: ScenarioSnapshot;
  assumptions: MarketAssumptions | null;
}

export interface CompareRunResult {
  id: string;
  label: string;
  result: MonteCarloResult;
}

export interface ScenarioSnapshot {
  tool: PlanningTool;
  inputs: ScenarioInputs;
  glidePathInputs: GlidePathInputs;
  taxInputs: TaxWithdrawalInputs;
  rothInputs: RothInputs;
  rothIrmaaInputs: RothIrmaaInputs;
  sorInputs: SorInputs;
  rmdInputs: RmdInputs;
  bracketInputs: BracketHeadroomInputs;
  socialSecurityInputs: SocialSecurityInputs;
  regimeSwrInputs: RegimeSwrInputs;
  correlationInputs: CorrelationInputs;
  regimeGenInputs: RegimeGenInputs;
  fireInputs: FireInputs;
  riskMetricsInputs: RiskMetricsInputs;
  incomeLayeringInputs: IncomeLayeringInputs;
  riskProfileScoreInputs: RiskProfileScoreInputs;
  rebalanceInputs: RebalanceInputs;
  optimizeAllocationInputs: OptimizeAllocationInputs;
  buildReportInputs: BuildPlanningReportInputs;
  educationFundingInputs: EducationFundingInputs;
  cashflowPlanningBridgeInputs: CashflowPlanningBridgeInputs;
  cashReserveAnalysisInputs: CashReserveAnalysisInputs;
  budgetPacingProjectionInputs: BudgetPacingProjectionInputs;
}

interface ScenarioState {
  tool: PlanningTool;

  inputs: ScenarioInputs;
  glidePathInputs: GlidePathInputs;
  taxInputs: TaxWithdrawalInputs;
  rothInputs: RothInputs;
  rothIrmaaInputs: RothIrmaaInputs;
  sorInputs: SorInputs;
  rmdInputs: RmdInputs;
  bracketInputs: BracketHeadroomInputs;
  socialSecurityInputs: SocialSecurityInputs;
  regimeSwrInputs: RegimeSwrInputs;
  correlationInputs: CorrelationInputs;
  regimeGenInputs: RegimeGenInputs;
  fireInputs: FireInputs;
  riskMetricsInputs: RiskMetricsInputs;
  incomeLayeringInputs: IncomeLayeringInputs;
  riskProfileScoreInputs: RiskProfileScoreInputs;
  rebalanceInputs: RebalanceInputs;
  optimizeAllocationInputs: OptimizeAllocationInputs;
  buildReportInputs: BuildPlanningReportInputs;
  educationFundingInputs: EducationFundingInputs;
  cashflowPlanningBridgeInputs: CashflowPlanningBridgeInputs;
  cashReserveAnalysisInputs: CashReserveAnalysisInputs;
  budgetPacingProjectionInputs: BudgetPacingProjectionInputs;

  result: MonteCarloResult | null;
  glidePathResult: GlidePathResult | null;
  taxResult: TaxWithdrawalResult | null;
  rothResult: RothConversionResult | null;
  rothIrmaaResult: RothConversionAnalysis | null;
  sorResult: SequenceOfReturnsStressResult | null;
  rmdResult: RmdResult | null;
  bracketResult: TaxBracketHeadroomResult | null;
  socialSecurityResult: SocialSecurityClaimingResult | null;
  regimeSwrResult: RegimeConditionedSwrResult | null;
  correlationResult: CorrelationResult | null;
  regimeGenResult: RegimeReturnResult | null;
  xrayResult: PortfolioXrayResult | null;
  fireResult: FireResult | null;
  riskMetricsResult: RiskMetricsResult | null;
  incomeLayeringResult: IncomeLayeringResult | null;
  riskProfileScoreResult: RiskProfileScoreResult | null;
  rebalanceResult: RebalanceResult | null;
  optimizeAllocationResult: OptimizeAllocationResult | null;
  buildReportResult: BuildPlanningReportResult | null;
  educationFundingResult: EducationFundingResult | null;
  educationVehicleRulesResult: EducationVehicleRulesResult | null;
  cashflowPlanningBridgeResult: CashflowPlanningBridgeResult | null;
  cashReserveAnalysisResult: CashReserveAnalysisResult | null;
  budgetPacingProjectionResult: BudgetPacingProjectionResult | null;
  compareScenarios: CompareScenario[];
  compareSeed: number;
  compareResults: CompareRunResult[] | null;

  /** Live engine assumptions from capital_market_assumptions; null until loaded. */
  assumptions: MarketAssumptions | null;
  loadingAssumptions: boolean;

  running: boolean;
  error: string | null;

  setTool: (tool: PlanningTool) => void;
  /** Replace all plan inputs at once (e.g. loading a saved scenario or a
   *  preset). Clears stale results + error so panels do not show a prior run. */
  loadSnapshot: (snapshot: ScenarioSnapshot) => void;
  setInputs: (patch: Partial<ScenarioInputs>) => void;
  setGlidePathInputs: (patch: Partial<GlidePathInputs>) => void;
  setTaxInputs: (patch: Partial<TaxWithdrawalInputs>) => void;
  setRothInputs: (patch: Partial<RothInputs>) => void;
  setRothIrmaaInputs: (patch: Partial<RothIrmaaInputs>) => void;
  setSorInputs: (patch: Partial<SorInputs>) => void;
  setRmdInputs: (patch: Partial<RmdInputs>) => void;
  setBracketInputs: (patch: Partial<BracketHeadroomInputs>) => void;
  setSocialSecurityInputs: (patch: Partial<SocialSecurityInputs>) => void;
  setRegimeSwrInputs: (patch: Partial<RegimeSwrInputs>) => void;
  setCorrelationInputs: (patch: Partial<CorrelationInputs>) => void;
  setRegimeGenInputs: (patch: Partial<RegimeGenInputs>) => void;
  setFireInputs: (patch: Partial<FireInputs>) => void;
  setRiskMetricsInputs: (patch: Partial<RiskMetricsInputs>) => void;
  setIncomeLayeringInputs: (patch: Partial<IncomeLayeringInputs>) => void;
  setRiskProfileScoreInputs: (patch: Partial<RiskProfileScoreInputs>) => void;
  setRebalanceInputs: (patch: Partial<RebalanceInputs>) => void;
  setOptimizeAllocationInputs: (
    patch: Partial<OptimizeAllocationInputs>,
  ) => void;
  setBuildReportInputs: (patch: Partial<BuildPlanningReportInputs>) => void;
  setEducationFundingInputs: (patch: Partial<EducationFundingInputs>) => void;
  setCashflowPlanningBridgeInputs: (
    patch: Partial<CashflowPlanningBridgeInputs>,
  ) => void;
  setCashReserveAnalysisInputs: (
    patch: Partial<CashReserveAnalysisInputs>,
  ) => void;
  setBudgetPacingProjectionInputs: (
    patch: Partial<BudgetPacingProjectionInputs>,
  ) => void;
  setResult: (r: MonteCarloResult | null) => void;
  setGlidePathResult: (r: GlidePathResult | null) => void;
  setTaxResult: (r: TaxWithdrawalResult | null) => void;
  setRothResult: (r: RothConversionResult | null) => void;
  setRothIrmaaResult: (r: RothConversionAnalysis | null) => void;
  setSorResult: (r: SequenceOfReturnsStressResult | null) => void;
  setRmdResult: (r: RmdResult | null) => void;
  setBracketResult: (r: TaxBracketHeadroomResult | null) => void;
  setSocialSecurityResult: (r: SocialSecurityClaimingResult | null) => void;
  setRegimeSwrResult: (r: RegimeConditionedSwrResult | null) => void;
  setCorrelationResult: (r: CorrelationResult | null) => void;
  setRegimeGenResult: (r: RegimeReturnResult | null) => void;
  setXrayResult: (r: PortfolioXrayResult | null) => void;
  setFireResult: (r: FireResult | null) => void;
  setRiskMetricsResult: (r: RiskMetricsResult | null) => void;
  setIncomeLayeringResult: (r: IncomeLayeringResult | null) => void;
  setRiskProfileScoreResult: (r: RiskProfileScoreResult | null) => void;
  setRebalanceResult: (r: RebalanceResult | null) => void;
  setOptimizeAllocationResult: (r: OptimizeAllocationResult | null) => void;
  setBuildReportResult: (r: BuildPlanningReportResult | null) => void;
  setEducationFundingResult: (r: EducationFundingResult | null) => void;
  setEducationVehicleRulesResult: (
    r: EducationVehicleRulesResult | null,
  ) => void;
  setCashflowPlanningBridgeResult: (
    r: CashflowPlanningBridgeResult | null,
  ) => void;
  setCashReserveAnalysisResult: (r: CashReserveAnalysisResult | null) => void;
  setBudgetPacingProjectionResult: (
    r: BudgetPacingProjectionResult | null,
  ) => void;
  setCompareScenarios: (scenarios: CompareScenario[]) => void;
  setCompareSeed: (seed: number) => void;
  setCompareResults: (results: CompareRunResult[] | null) => void;
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

const DEFAULT_ROTH_IRMAA: RothIrmaaInputs = {
  // A ~60-something MFJ retiree converting over 2026 + 2027, IRMAA-constrained.
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

const DEFAULT_CORRELATION: CorrelationInputs = {
  assetClassIdsText: "us_equity, us_bonds",
  lookbackDays: 1260,
  shrinkage: true,
};

const DEFAULT_REGIME_GEN: RegimeGenInputs = {
  horizonYears: 50,
  paths: 10_000,
};

const DEFAULT_FIRE: FireInputs = {
  currentAge: 40,
  retirementAge: 65,
  currentBalance: 400_000,
  annualContribution: 30_000,
  growthRate: 0.05,
  annualSpend: 80_000,
  swr: 0.04,
};

const DEFAULT_RISK_METRICS: RiskMetricsInputs = {
  returnsText: "0.12, -0.08, 0.21, 0.15, -0.18, 0.24, 0.06, -0.03, 0.17, 0.09",
  riskFreeRate: 0.02,
  periodsPerYear: 1,
};

const DEFAULT_RISK_PROFILE_SCORE: RiskProfileScoreInputs = {
  answers: DEFAULT_RISK_PROFILE_ANSWERS,
};

const DEFAULT_REBALANCE: RebalanceInputs = {
  // Keyed to the shared portfolio's default asset classes; the form renders one
  // editable target per current asset-class id (missing ids default to 0).
  targetWeights: { us_equity: 0.6, us_bonds: 0.4 },
};

const DEFAULT_OPTIMIZE_ALLOCATION: OptimizeAllocationInputs = {
  // A balanced, regime-aware default over the engine's full default universe
  // (no id subset), long-only weight bounds.
  riskProfile: "moderate",
  objective: "",
  assetClassIdsText: "",
  weightMin: 0,
  weightMax: 1,
  returnModel: "house_view",
  regimeAware: true,
  riskFreeRate: 0.02,
};

const DEFAULT_BUILD_REPORT: BuildPlanningReportInputs = {
  // A small example outline so the editor is usable out of the box; the engine
  // normalizes titles and collates findings. Sections are de-identified.
  title: "Planning summary",
  includeRegime: true,
  preset: "custom",
  scope: "focused",
  assumptionVersion: "2026.07",
  cmaVersion: "engine-default-cma",
  taxYear: 2026,
  seed: 20260707,
  engineReference: "nexus-core",
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
};

const DEFAULT_EDUCATION_FUNDING: EducationFundingInputs = {
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

const DEFAULT_CASHFLOW_PLANNING_BRIDGE: CashflowPlanningBridgeInputs = {
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

const DEFAULT_CASH_RESERVE_ANALYSIS: CashReserveAnalysisInputs = {
  monthlyEssentialSpending: 5_000,
  monthlyTotalSpending: 8_000,
  currentCashReserve: 25_000,
  targetMonths: 6,
  secondaryTargetMonths: 9,
};

const DEFAULT_BUDGET_PACING: BudgetPacingProjectionInputs = {
  monthDay: 15,
  daysInMonth: 30,
  monthToDateSpending: 3_400,
  monthlyBudget: 8_000,
  recurringRemaining: 1_250,
  knownOneTimeRemaining: 300,
};

export const useScenario = create<ScenarioState>((set) => ({
  tool: "monte_carlo",

  inputs: DEFAULT_INPUTS,
  glidePathInputs: DEFAULT_GLIDE_PATH,
  taxInputs: DEFAULT_TAX,
  rothInputs: DEFAULT_ROTH,
  rothIrmaaInputs: DEFAULT_ROTH_IRMAA,
  sorInputs: DEFAULT_SOR,
  rmdInputs: DEFAULT_RMD,
  bracketInputs: DEFAULT_BRACKET,
  socialSecurityInputs: DEFAULT_SOCIAL_SECURITY,
  regimeSwrInputs: DEFAULT_REGIME_SWR,
  correlationInputs: DEFAULT_CORRELATION,
  regimeGenInputs: DEFAULT_REGIME_GEN,
  fireInputs: DEFAULT_FIRE,
  riskMetricsInputs: DEFAULT_RISK_METRICS,
  incomeLayeringInputs: DEFAULT_INCOME_LAYERING_INPUTS,
  riskProfileScoreInputs: DEFAULT_RISK_PROFILE_SCORE,
  rebalanceInputs: DEFAULT_REBALANCE,
  optimizeAllocationInputs: DEFAULT_OPTIMIZE_ALLOCATION,
  buildReportInputs: DEFAULT_BUILD_REPORT,
  educationFundingInputs: DEFAULT_EDUCATION_FUNDING,
  cashflowPlanningBridgeInputs: DEFAULT_CASHFLOW_PLANNING_BRIDGE,
  cashReserveAnalysisInputs: DEFAULT_CASH_RESERVE_ANALYSIS,
  budgetPacingProjectionInputs: DEFAULT_BUDGET_PACING,

  result: null,
  glidePathResult: null,
  taxResult: null,
  rothResult: null,
  rothIrmaaResult: null,
  sorResult: null,
  rmdResult: null,
  bracketResult: null,
  socialSecurityResult: null,
  regimeSwrResult: null,
  correlationResult: null,
  regimeGenResult: null,
  xrayResult: null,
  fireResult: null,
  riskMetricsResult: null,
  incomeLayeringResult: null,
  riskProfileScoreResult: null,
  rebalanceResult: null,
  optimizeAllocationResult: null,
  buildReportResult: null,
  educationFundingResult: null,
  educationVehicleRulesResult: null,
  cashflowPlanningBridgeResult: null,
  cashReserveAnalysisResult: null,
  budgetPacingProjectionResult: null,
  compareScenarios: [],
  compareSeed: 20260707,
  compareResults: null,

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
      rothInputs: snapshot.rothInputs,
      rothIrmaaInputs: snapshot.rothIrmaaInputs,
      sorInputs: snapshot.sorInputs,
      rmdInputs: snapshot.rmdInputs,
      bracketInputs: snapshot.bracketInputs,
      socialSecurityInputs: snapshot.socialSecurityInputs,
      regimeSwrInputs: snapshot.regimeSwrInputs,
      correlationInputs: snapshot.correlationInputs,
      regimeGenInputs: snapshot.regimeGenInputs,
      fireInputs: snapshot.fireInputs,
      riskMetricsInputs: snapshot.riskMetricsInputs,
      incomeLayeringInputs: snapshot.incomeLayeringInputs,
      riskProfileScoreInputs: snapshot.riskProfileScoreInputs,
      rebalanceInputs: snapshot.rebalanceInputs,
      optimizeAllocationInputs: snapshot.optimizeAllocationInputs,
      buildReportInputs: snapshot.buildReportInputs,
      educationFundingInputs: snapshot.educationFundingInputs,
      cashflowPlanningBridgeInputs: snapshot.cashflowPlanningBridgeInputs,
      cashReserveAnalysisInputs: snapshot.cashReserveAnalysisInputs,
      budgetPacingProjectionInputs: snapshot.budgetPacingProjectionInputs,
      result: null,
      glidePathResult: null,
      taxResult: null,
      rothResult: null,
      rothIrmaaResult: null,
      sorResult: null,
      rmdResult: null,
      bracketResult: null,
      socialSecurityResult: null,
      regimeSwrResult: null,
      correlationResult: null,
      regimeGenResult: null,
      xrayResult: null,
      fireResult: null,
      riskMetricsResult: null,
      incomeLayeringResult: null,
      riskProfileScoreResult: null,
      rebalanceResult: null,
      optimizeAllocationResult: null,
      buildReportResult: null,
      educationFundingResult: null,
      educationVehicleRulesResult: null,
      cashflowPlanningBridgeResult: null,
      cashReserveAnalysisResult: null,
      budgetPacingProjectionResult: null,
      compareResults: null,
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
  setRothIrmaaInputs: (patch) =>
    set((s) => ({ rothIrmaaInputs: { ...s.rothIrmaaInputs, ...patch } })),
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
  setCorrelationInputs: (patch) =>
    set((s) => ({ correlationInputs: { ...s.correlationInputs, ...patch } })),
  setRegimeGenInputs: (patch) =>
    set((s) => ({ regimeGenInputs: { ...s.regimeGenInputs, ...patch } })),
  setFireInputs: (patch) =>
    set((s) => ({ fireInputs: { ...s.fireInputs, ...patch } })),
  setRiskMetricsInputs: (patch) =>
    set((s) => ({ riskMetricsInputs: { ...s.riskMetricsInputs, ...patch } })),
  setIncomeLayeringInputs: (patch) =>
    set((s) => ({
      incomeLayeringInputs: {
        ...s.incomeLayeringInputs,
        ...patch,
        ...(patch.incomeStreams
          ? {
              incomeStreams: patch.incomeStreams,
            }
          : {}),
      },
    })),
  setRiskProfileScoreInputs: (patch) =>
    set((s) => ({
      riskProfileScoreInputs: {
        ...s.riskProfileScoreInputs,
        ...patch,
        ...(patch.answers
          ? {
              answers: {
                ...s.riskProfileScoreInputs.answers,
                ...patch.answers,
              },
            }
          : {}),
      },
    })),
  setRebalanceInputs: (patch) =>
    set((s) => ({ rebalanceInputs: { ...s.rebalanceInputs, ...patch } })),
  setOptimizeAllocationInputs: (patch) =>
    set((s) => ({
      optimizeAllocationInputs: { ...s.optimizeAllocationInputs, ...patch },
    })),
  setBuildReportInputs: (patch) =>
    set((s) => ({ buildReportInputs: { ...s.buildReportInputs, ...patch } })),
  setEducationFundingInputs: (patch) =>
    set((s) => ({
      educationFundingInputs: { ...s.educationFundingInputs, ...patch },
    })),
  setCashflowPlanningBridgeInputs: (patch) =>
    set((s) => ({
      cashflowPlanningBridgeInputs: {
        ...s.cashflowPlanningBridgeInputs,
        ...patch,
      },
    })),
  setCashReserveAnalysisInputs: (patch) =>
    set((s) => ({
      cashReserveAnalysisInputs: {
        ...s.cashReserveAnalysisInputs,
        ...patch,
      },
    })),
  setBudgetPacingProjectionInputs: (patch) =>
    set((s) => ({
      budgetPacingProjectionInputs: {
        ...s.budgetPacingProjectionInputs,
        ...patch,
      },
    })),
  setResult: (result) => set({ result }),
  setGlidePathResult: (glidePathResult) => set({ glidePathResult }),
  setTaxResult: (taxResult) => set({ taxResult }),
  setRothResult: (rothResult) => set({ rothResult }),
  setRothIrmaaResult: (rothIrmaaResult) => set({ rothIrmaaResult }),
  setSorResult: (sorResult) => set({ sorResult }),
  setRmdResult: (rmdResult) => set({ rmdResult }),
  setBracketResult: (bracketResult) => set({ bracketResult }),
  setSocialSecurityResult: (socialSecurityResult) =>
    set({ socialSecurityResult }),
  setRegimeSwrResult: (regimeSwrResult) => set({ regimeSwrResult }),
  setCorrelationResult: (correlationResult) => set({ correlationResult }),
  setRegimeGenResult: (regimeGenResult) => set({ regimeGenResult }),
  setXrayResult: (xrayResult) => set({ xrayResult }),
  setFireResult: (fireResult) => set({ fireResult }),
  setRiskMetricsResult: (riskMetricsResult) => set({ riskMetricsResult }),
  setIncomeLayeringResult: (incomeLayeringResult) =>
    set({ incomeLayeringResult }),
  setRiskProfileScoreResult: (riskProfileScoreResult) =>
    set({ riskProfileScoreResult }),
  setRebalanceResult: (rebalanceResult) => set({ rebalanceResult }),
  setOptimizeAllocationResult: (optimizeAllocationResult) =>
    set({ optimizeAllocationResult }),
  setBuildReportResult: (buildReportResult) => set({ buildReportResult }),
  setEducationFundingResult: (educationFundingResult) =>
    set({ educationFundingResult }),
  setEducationVehicleRulesResult: (educationVehicleRulesResult) =>
    set({ educationVehicleRulesResult }),
  setCashflowPlanningBridgeResult: (cashflowPlanningBridgeResult) =>
    set({ cashflowPlanningBridgeResult }),
  setCashReserveAnalysisResult: (cashReserveAnalysisResult) =>
    set({ cashReserveAnalysisResult }),
  setBudgetPacingProjectionResult: (budgetPacingProjectionResult) =>
    set({ budgetPacingProjectionResult }),
  setCompareScenarios: (compareScenarios) => set({ compareScenarios }),
  setCompareSeed: (compareSeed) => set({ compareSeed }),
  setCompareResults: (compareResults) => set({ compareResults }),
  setAssumptions: (assumptions) => set({ assumptions }),
  setLoadingAssumptions: (loadingAssumptions) => set({ loadingAssumptions }),
  setRunning: (running) => set({ running }),
  setError: (error) => set({ error }),
}));
