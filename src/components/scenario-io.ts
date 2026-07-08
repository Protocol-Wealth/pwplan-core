// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * scenario-io — pure, dependency-free serialize/parse for plan inputs.
 *
 * Scenarios are saved and loaded as a small, versioned JSON envelope so demos
 * and case-study variations can be shared as files. This is NOT persistence to
 * the browser (no localStorage / sessionStorage — see CLAUDE.md); the UI turns
 * the serialized object into a download and reads it back from a file input.
 *
 * Two safety properties:
 *  - PII-free on the way IN. parse() runs the same `assertNoPII` tripwire the
 *    gateway uses, so loading a hand-edited file that smuggled an identity-shaped
 *    key is refused, not silently accepted. (A scenario carries only derived
 *    planning variables by construction; this is the fail-closed backstop.)
 *  - Versioned. A `fileVersion` lets a future format change be detected instead
 *    of mis-parsed; `contractVersion` is recorded for traceability.
 *
 * It contains no quant or compliance logic — only shape validation and JSON
 * marshalling (thin-shell invariant intact).
 */

import { PLANNING_CONTRACT_VERSION } from "../contract/planning";
import type {
  Account,
  AccountType,
  AssetClass,
  FilingStatus,
  GuaranteedIncome,
  HistoricalBlendRebalanceFrequency,
  InheritedIraBeneficiaryType,
  PlanningReportPreset,
  ReturnModel,
  TwrFlowTiming,
  WealthRoadmapScope,
} from "../contract/planning";
import { assertNoPII, PiiTripwireError } from "../lib/compliance";
import { DEFAULT_HISTORICAL_BLEND_INPUTS } from "../lib/historical-blend-defaults";
import { DEFAULT_INCOME_LAYERING_INPUTS } from "../lib/income-layering-defaults";
import { DEFAULT_PERFORMANCE_ANALYSIS_INPUTS } from "../lib/performance-analysis-defaults";
import {
  answerIdsForQuestion,
  DEFAULT_RISK_PROFILE_ANSWERS,
  RISK_PROFILE_QUESTION_IDS,
} from "../lib/risk-profile-questionnaire";
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
  GlidePathShape,
  HistoricalBlendInputs,
  InheritedIraInputs,
  IncomeLayeringInputs,
  IncomeLayeringStreamDraft,
  OptimizeAllocationInputs,
  PerformanceAnalysisInputs,
  PerformanceMwrFlowDraft,
  PerformanceTwrPeriodDraft,
  PlanningTool,
  RebalanceInputs,
  RegimeGenInputs,
  RegimeSwrInputs,
  ReportSectionDraft,
  RiskProfileScoreInputs,
  RiskMetricsInputs,
  RmdInputs,
  RothInputs,
  RothIrmaaInputs,
  ScenarioSnapshot,
  ScenarioInputs,
  SocialSecurityInputs,
  SorInputs,
  TaxWithdrawalInputs,
} from "../store/scenario";
export type { ScenarioSnapshot } from "../store/scenario";

/** Bump when the envelope shape changes incompatibly. */
export const SCENARIO_FILE_VERSION = "4" as const;

/** Tag identifying a pwplan-core scenario file, to reject unrelated JSON. */
export const SCENARIO_FILE_KIND = "pwplan-core/scenario" as const;

/** The portable, PII-free plan-inputs envelope (no engine results). */
export interface SerializedScenario extends ScenarioSnapshot {
  kind: typeof SCENARIO_FILE_KIND;
  fileVersion: typeof SCENARIO_FILE_VERSION;
  /** Contract version the inputs were authored against (traceability only). */
  contractVersion: string;
}

export type ScenarioParseResult =
  | { ok: true; value: ScenarioSnapshot }
  | { ok: false; error: string };

/** Wrap the current plan inputs in a versioned, PII-free envelope. */
export function serializeScenario(
  snapshot: ScenarioSnapshot,
): SerializedScenario {
  const envelope: SerializedScenario = {
    kind: SCENARIO_FILE_KIND,
    fileVersion: SCENARIO_FILE_VERSION,
    contractVersion: PLANNING_CONTRACT_VERSION,
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
    historicalBlendInputs: snapshot.historicalBlendInputs,
    performanceAnalysisInputs: snapshot.performanceAnalysisInputs,
    inheritedIraInputs: snapshot.inheritedIraInputs,
    riskProfileScoreInputs: snapshot.riskProfileScoreInputs,
    rebalanceInputs: snapshot.rebalanceInputs,
    optimizeAllocationInputs: snapshot.optimizeAllocationInputs,
    buildReportInputs: snapshot.buildReportInputs,
    educationFundingInputs: snapshot.educationFundingInputs,
    cashflowPlanningBridgeInputs: snapshot.cashflowPlanningBridgeInputs,
    cashReserveAnalysisInputs: snapshot.cashReserveAnalysisInputs,
    budgetPacingProjectionInputs: snapshot.budgetPacingProjectionInputs,
  };
  // Fail-closed: never write a file that carries an identity-shaped key.
  return assertNoPII(envelope);
}

/** Pretty-printed JSON for a downloadable file. */
export function toScenarioJSON(snapshot: ScenarioSnapshot): string {
  return JSON.stringify(serializeScenario(snapshot), null, 2);
}

// --- Parsing (lightweight structural type guards) --------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

function isBool(v: unknown): v is boolean {
  return typeof v === "boolean";
}

const ACCOUNT_TYPES: AccountType[] = ["taxable", "traditional", "roth"];
const FILING_STATUSES: FilingStatus[] = [
  "single",
  "married_joint",
  "married_separate",
  "head_of_household",
];
const RETURN_MODELS: ReturnModel[] = [
  "multivariate_normal",
  "student_t",
  "block_bootstrap",
  "markov_regime",
  "emf_regime",
];
const GLIDE_SHAPES: GlidePathShape[] = [
  "linear",
  "to_through",
  "rising_equity",
];
const CASE_FILING_STATUSES = ["single", "mfj", "mfs"] as const;
const TARGET_RULES = [
  "fill_to_rate",
  "fill_to_irmaa_tier",
  "fixed_amount",
] as const;
const RISK_PROFILES = [
  "conservative",
  "moderate_conservative",
  "moderate",
  "moderate_aggressive",
  "aggressive",
] as const;
const ALLOCATION_OBJECTIVES = [
  "max_sharpe",
  "min_volatility",
  "max_quadratic_utility",
  "efficient_return",
  "efficient_risk",
] as const;
const OPTIMIZE_RETURN_MODELS = ["house_view", "historical"] as const;
const HISTORICAL_BLEND_REBALANCE_FREQUENCIES = [
  "monthly",
  "annual",
  "none",
] as const;
const TWR_FLOW_TIMINGS = ["start", "end"] as const;
const INHERITED_IRA_BENEFICIARY_TYPES = [
  "spouse",
  "minor_child_of_decedent",
  "disabled",
  "chronically_ill",
  "not_more_than_10_years_younger",
  "other_designated_beneficiary",
  "non_designated_beneficiary",
] as const;
const INCOME_STREAM_KINDS = ["pension", "annuity"] as const;
const SPENDING_VOLATILITY = ["low", "medium", "high"] as const;
const PLANNING_TOOLS: PlanningTool[] = [
  "monte_carlo",
  "glide_path",
  "tax_withdrawal",
  "roth_conversion",
  "roth_irmaa",
  "sequence_stress",
  "rmd",
  "bracket_headroom",
  "social_security",
  "regime_swr",
  "correlation",
  "regime_paths",
  "portfolio_xray",
  "fire",
  "risk_metrics",
  "income_layering",
  "historical_blend",
  "performance_analysis",
  "inherited_ira",
  "risk_profile",
  "rebalance",
  "optimize_allocation",
  "build_report",
  "education",
  "cashflow_bridge",
  "compare",
];

function parseAssetClass(v: unknown): AssetClass | null {
  if (!isObject(v)) return null;
  if (!isStr(v.id) || !isStr(v.label)) return null;
  if (!isNum(v.expectedReturn) || !isNum(v.volatility)) return null;
  if (v.lambda !== undefined && !isNum(v.lambda)) return null;
  const ac: AssetClass = {
    id: v.id,
    label: v.label,
    expectedReturn: v.expectedReturn,
    volatility: v.volatility,
  };
  if (v.lambda !== undefined) ac.lambda = v.lambda;
  return ac;
}

function parseAllocation(v: unknown): Record<string, number> | null {
  if (!isObject(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, w] of Object.entries(v)) {
    if (!isNum(w)) return null;
    out[k] = w;
  }
  return out;
}

function parseAccount(v: unknown): Account | null {
  if (!isObject(v)) return null;
  if (!isStr(v.type) || !ACCOUNT_TYPES.includes(v.type as AccountType)) {
    return null;
  }
  if (!isNum(v.balance)) return null;
  const allocation = parseAllocation(v.allocation);
  if (allocation === null) return null;
  return { type: v.type as AccountType, balance: v.balance, allocation };
}

function parseGuaranteedIncome(v: unknown): GuaranteedIncome | null {
  if (!isObject(v)) return null;
  if (!isStr(v.label)) return null;
  if (!isNum(v.annualAmount) || !isNum(v.startAge) || !isNum(v.colaRate)) {
    return null;
  }
  return {
    label: v.label,
    annualAmount: v.annualAmount,
    startAge: v.startAge,
    colaRate: v.colaRate,
  };
}

function parseArray<T>(v: unknown, each: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const item of v) {
    const parsed = each(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

function parseInputs(v: unknown): ScenarioInputs | null {
  if (!isObject(v)) return null;
  if (
    !isNum(v.currentAge) ||
    !isNum(v.retirementAge) ||
    !isNum(v.horizonAge) ||
    !isNum(v.annualSpend) ||
    !isNum(v.spendColaRate) ||
    !isNum(v.paths)
  ) {
    return null;
  }
  if (
    !isStr(v.filingStatus) ||
    !FILING_STATUSES.includes(v.filingStatus as FilingStatus)
  ) {
    return null;
  }
  if (
    !isStr(v.returnModel) ||
    !RETURN_MODELS.includes(v.returnModel as ReturnModel)
  ) {
    return null;
  }
  const accounts = parseArray(v.accounts, parseAccount);
  const assetClasses = parseArray(v.assetClasses, parseAssetClass);
  const guaranteedIncome = parseArray(
    v.guaranteedIncome,
    parseGuaranteedIncome,
  );
  if (accounts === null || assetClasses === null || guaranteedIncome === null) {
    return null;
  }
  return {
    currentAge: v.currentAge,
    retirementAge: v.retirementAge,
    horizonAge: v.horizonAge,
    filingStatus: v.filingStatus as FilingStatus,
    annualSpend: v.annualSpend,
    spendColaRate: v.spendColaRate,
    accounts,
    assetClasses,
    guaranteedIncome,
    returnModel: v.returnModel as ReturnModel,
    paths: v.paths,
  };
}

function parseGlide(v: unknown): GlidePathInputs | null {
  if (!isObject(v)) return null;
  if (
    !isNum(v.currentAge) ||
    !isNum(v.retirementAge) ||
    !isNum(v.horizonAge) ||
    !isNum(v.startEquityWeight) ||
    !isNum(v.endEquityWeight)
  ) {
    return null;
  }
  if (!isStr(v.shape) || !GLIDE_SHAPES.includes(v.shape as GlidePathShape)) {
    return null;
  }
  return {
    currentAge: v.currentAge,
    retirementAge: v.retirementAge,
    horizonAge: v.horizonAge,
    startEquityWeight: v.startEquityWeight,
    endEquityWeight: v.endEquityWeight,
    shape: v.shape as GlidePathShape,
  };
}

function parseTax(v: unknown): TaxWithdrawalInputs | null {
  if (!isObject(v)) return null;
  if (
    !isNum(v.year) ||
    !isNum(v.age) ||
    !isNum(v.grossNeed) ||
    !isNum(v.otherTaxableIncome)
  ) {
    return null;
  }
  if (
    !isStr(v.filingStatus) ||
    !FILING_STATUSES.includes(v.filingStatus as FilingStatus)
  ) {
    return null;
  }
  return {
    year: v.year,
    age: v.age,
    filingStatus: v.filingStatus as FilingStatus,
    grossNeed: v.grossNeed,
    otherTaxableIncome: v.otherTaxableIncome,
  };
}

function parseRoth(v: unknown): RothInputs | null {
  if (!isObject(v)) return null;
  if (
    !isNum(v.currentTaxableIncome) ||
    !isStr(v.filingStatus) ||
    !FILING_STATUSES.includes(v.filingStatus as FilingStatus) ||
    !isNum(v.conversionAmount) ||
    !isNum(v.growthRate) ||
    !isNum(v.years) ||
    !isNum(v.retirementMarginalRate) ||
    !isBool(v.taxesPaidFromConversion)
  ) {
    return null;
  }
  return {
    currentTaxableIncome: v.currentTaxableIncome,
    filingStatus: v.filingStatus as FilingStatus,
    conversionAmount: v.conversionAmount,
    growthRate: v.growthRate,
    years: v.years,
    retirementMarginalRate: v.retirementMarginalRate,
    taxesPaidFromConversion: v.taxesPaidFromConversion,
  };
}

function parseRothIrmaa(v: unknown): RothIrmaaInputs | null {
  if (!isObject(v)) return null;
  if (
    !isNum(v.taxYear) ||
    !isStr(v.filingStatus) ||
    !(CASE_FILING_STATUSES as readonly string[]).includes(v.filingStatus) ||
    !isStr(v.stateCode) ||
    !isNum(v.birthYearSelf) ||
    !isNum(v.birthYearSpouse) ||
    !isNum(v.medicareEnrolled) ||
    !isNum(v.conversionYears) ||
    !isStr(v.targetRule) ||
    !(TARGET_RULES as readonly string[]).includes(v.targetRule) ||
    !isNum(v.targetRate) ||
    !isNum(v.fixedAmount) ||
    !isNum(v.pension) ||
    !isNum(v.socialSecurityGross) ||
    !isNum(v.taxableInterest) ||
    !isNum(v.taxExemptInterest) ||
    !isNum(v.ordinaryDividends) ||
    !isNum(v.qualifiedDividends) ||
    !isNum(v.longTermGains) ||
    !isNum(v.tradIraAggregate) ||
    !isNum(v.nondeductibleBasis) ||
    !isNum(v.taxableLiquidity) ||
    !isNum(v.employerPlanAggregate) ||
    !isNum(v.irmaaInflation) ||
    !isNum(v.irmaaBuffer)
  ) {
    return null;
  }
  return {
    taxYear: v.taxYear,
    filingStatus: v.filingStatus as RothIrmaaInputs["filingStatus"],
    stateCode: v.stateCode,
    birthYearSelf: v.birthYearSelf,
    birthYearSpouse: v.birthYearSpouse,
    medicareEnrolled: v.medicareEnrolled,
    conversionYears: v.conversionYears,
    targetRule: v.targetRule as RothIrmaaInputs["targetRule"],
    targetRate: v.targetRate,
    fixedAmount: v.fixedAmount,
    pension: v.pension,
    socialSecurityGross: v.socialSecurityGross,
    taxableInterest: v.taxableInterest,
    taxExemptInterest: v.taxExemptInterest,
    ordinaryDividends: v.ordinaryDividends,
    qualifiedDividends: v.qualifiedDividends,
    longTermGains: v.longTermGains,
    tradIraAggregate: v.tradIraAggregate,
    nondeductibleBasis: v.nondeductibleBasis,
    taxableLiquidity: v.taxableLiquidity,
    employerPlanAggregate: v.employerPlanAggregate,
    irmaaInflation: v.irmaaInflation,
    irmaaBuffer: v.irmaaBuffer,
  };
}

function parseSor(v: unknown): SorInputs | null {
  if (!isObject(v)) return null;
  if (
    !isNum(v.initialBalance) ||
    !isNum(v.annualSpend) ||
    !isStr(v.returnsText)
  ) {
    return null;
  }
  return {
    initialBalance: v.initialBalance,
    annualSpend: v.annualSpend,
    returnsText: v.returnsText,
  };
}

function parseRmd(v: unknown): RmdInputs | null {
  if (!isObject(v) || !isNum(v.age) || !isNum(v.balance)) return null;
  return { age: v.age, balance: v.balance };
}

function parseBracket(v: unknown): BracketHeadroomInputs | null {
  if (
    !isObject(v) ||
    !isNum(v.taxableIncome) ||
    !isStr(v.filingStatus) ||
    !FILING_STATUSES.includes(v.filingStatus as FilingStatus) ||
    !isNum(v.targetRate)
  ) {
    return null;
  }
  return {
    taxableIncome: v.taxableIncome,
    filingStatus: v.filingStatus as FilingStatus,
    targetRate: v.targetRate,
  };
}

function parseSocialSecurity(v: unknown): SocialSecurityInputs | null {
  if (!isObject(v) || !isNum(v.piaMonthly) || !isNum(v.fraAge)) return null;
  return { piaMonthly: v.piaMonthly, fraAge: v.fraAge };
}

function parseRegimeSwr(v: unknown): RegimeSwrInputs | null {
  if (!isObject(v) || !isNum(v.baseSwr) || !isNum(v.portfolioBalance)) {
    return null;
  }
  return { baseSwr: v.baseSwr, portfolioBalance: v.portfolioBalance };
}

function parseCorrelation(v: unknown): CorrelationInputs | null {
  if (
    !isObject(v) ||
    !isStr(v.assetClassIdsText) ||
    !isNum(v.lookbackDays) ||
    !isBool(v.shrinkage)
  ) {
    return null;
  }
  return {
    assetClassIdsText: v.assetClassIdsText,
    lookbackDays: v.lookbackDays,
    shrinkage: v.shrinkage,
  };
}

function parseRegimeGen(v: unknown): RegimeGenInputs | null {
  if (!isObject(v) || !isNum(v.horizonYears) || !isNum(v.paths)) return null;
  return { horizonYears: v.horizonYears, paths: v.paths };
}

function parseFire(v: unknown): FireInputs | null {
  if (
    !isObject(v) ||
    !isNum(v.currentAge) ||
    !isNum(v.retirementAge) ||
    !isNum(v.currentBalance) ||
    !isNum(v.annualContribution) ||
    !isNum(v.growthRate) ||
    !isNum(v.annualSpend) ||
    !isNum(v.swr)
  ) {
    return null;
  }
  return {
    currentAge: v.currentAge,
    retirementAge: v.retirementAge,
    currentBalance: v.currentBalance,
    annualContribution: v.annualContribution,
    growthRate: v.growthRate,
    annualSpend: v.annualSpend,
    swr: v.swr,
  };
}

function parseRiskMetrics(v: unknown): RiskMetricsInputs | null {
  if (
    !isObject(v) ||
    !isStr(v.returnsText) ||
    !isNum(v.riskFreeRate) ||
    !isNum(v.periodsPerYear)
  ) {
    return null;
  }
  return {
    returnsText: v.returnsText,
    riskFreeRate: v.riskFreeRate,
    periodsPerYear: v.periodsPerYear,
  };
}

function defaultIncomeLayering(): IncomeLayeringInputs {
  return {
    ...DEFAULT_INCOME_LAYERING_INPUTS,
    incomeStreams: DEFAULT_INCOME_LAYERING_INPUTS.incomeStreams.map(
      (stream) => ({ ...stream }),
    ),
  };
}

function parseIncomeLayeringStream(
  v: unknown,
): IncomeLayeringStreamDraft | null {
  if (
    !isObject(v) ||
    !isStr(v.kind) ||
    !(INCOME_STREAM_KINDS as readonly string[]).includes(v.kind) ||
    !isNum(v.annualAmount) ||
    !isNum(v.startAge) ||
    !isNum(v.endAge) ||
    !isNum(v.colaRate)
  ) {
    return null;
  }
  return {
    kind: v.kind as IncomeLayeringStreamDraft["kind"],
    annualAmount: v.annualAmount,
    startAge: v.startAge,
    endAge: v.endAge,
    colaRate: v.colaRate,
  };
}

function parseIncomeLayering(v: unknown): IncomeLayeringInputs | null {
  if (v === undefined) return defaultIncomeLayering();
  if (
    !isObject(v) ||
    !isNum(v.currentAge) ||
    !isNum(v.retirementAge) ||
    !isNum(v.terminalAge) ||
    !isNum(v.spendingTarget) ||
    !isNum(v.earnedIncome) ||
    !isNum(v.wageGrowthRate) ||
    !isNum(v.spendingInflationRate) ||
    !isStr(v.filingStatus) ||
    !FILING_STATUSES.includes(v.filingStatus as FilingStatus) ||
    !isNum(v.taxYear) ||
    !isNum(v.baseYear) ||
    !isNum(v.expectedReturn) ||
    !isNum(v.bracketFillTargetRate) ||
    !isNum(v.birthYear) ||
    !isStr(v.stateCode) ||
    !isNum(v.primaryPiaMonthly) ||
    !isNum(v.primaryClaimAge) ||
    !isNum(v.primaryFraAge) ||
    !isNum(v.primaryColaRate) ||
    !isNum(v.spousePiaMonthly) ||
    !isNum(v.spouseClaimAge) ||
    !isNum(v.spouseFraAge) ||
    !isNum(v.spouseColaRate) ||
    !isNum(v.survivorYear) ||
    !isStr(v.survivorFilingStatus) ||
    !FILING_STATUSES.includes(v.survivorFilingStatus as FilingStatus)
  ) {
    return null;
  }
  const incomeStreams = parseArray(v.incomeStreams, parseIncomeLayeringStream);
  if (incomeStreams === null) return null;
  return {
    currentAge: v.currentAge,
    retirementAge: v.retirementAge,
    terminalAge: v.terminalAge,
    spendingTarget: v.spendingTarget,
    earnedIncome: v.earnedIncome,
    wageGrowthRate: v.wageGrowthRate,
    spendingInflationRate: v.spendingInflationRate,
    filingStatus: v.filingStatus as FilingStatus,
    taxYear: v.taxYear,
    baseYear: v.baseYear,
    expectedReturn: v.expectedReturn,
    bracketFillTargetRate: v.bracketFillTargetRate,
    birthYear: v.birthYear,
    stateCode: v.stateCode,
    primaryPiaMonthly: v.primaryPiaMonthly,
    primaryClaimAge: v.primaryClaimAge,
    primaryFraAge: v.primaryFraAge,
    primaryColaRate: v.primaryColaRate,
    spousePiaMonthly: v.spousePiaMonthly,
    spouseClaimAge: v.spouseClaimAge,
    spouseFraAge: v.spouseFraAge,
    spouseColaRate: v.spouseColaRate,
    incomeStreams,
    survivorYear: v.survivorYear,
    survivorFilingStatus: v.survivorFilingStatus as FilingStatus,
  };
}

function defaultHistoricalBlend(): HistoricalBlendInputs {
  return {
    ...DEFAULT_HISTORICAL_BLEND_INPUTS,
    weights: { ...DEFAULT_HISTORICAL_BLEND_INPUTS.weights },
  };
}

function parseHistoricalBlend(v: unknown): HistoricalBlendInputs | null {
  if (v === undefined) return defaultHistoricalBlend();
  if (
    !isObject(v) ||
    !isStr(v.assetClassIdsText) ||
    !isNum(v.lookbackDays) ||
    !isStr(v.asOf) ||
    !isStr(v.rebalanceFrequency) ||
    !(HISTORICAL_BLEND_REBALANCE_FREQUENCIES as readonly string[]).includes(
      v.rebalanceFrequency,
    ) ||
    !isNum(v.initialValue)
  ) {
    return null;
  }
  const weights = parseNumberRecord(v.weights);
  if (weights === null) return null;
  return {
    assetClassIdsText: v.assetClassIdsText,
    weights,
    lookbackDays: v.lookbackDays,
    asOf: v.asOf,
    rebalanceFrequency:
      v.rebalanceFrequency as HistoricalBlendRebalanceFrequency,
    initialValue: v.initialValue,
  };
}

function defaultPerformanceAnalysis(): PerformanceAnalysisInputs {
  return {
    ...DEFAULT_PERFORMANCE_ANALYSIS_INPUTS,
    twrPeriods: DEFAULT_PERFORMANCE_ANALYSIS_INPUTS.twrPeriods.map(
      (period) => ({
        ...period,
      }),
    ),
    mwrFlows: DEFAULT_PERFORMANCE_ANALYSIS_INPUTS.mwrFlows.map((flow) => ({
      ...flow,
    })),
  };
}

function parsePerformanceTwrPeriod(
  v: unknown,
): PerformanceTwrPeriodDraft | null {
  if (
    !isObject(v) ||
    !isNum(v.startValue) ||
    !isNum(v.endValue) ||
    !isNum(v.netExternalFlow)
  ) {
    return null;
  }
  return {
    startValue: v.startValue,
    endValue: v.endValue,
    netExternalFlow: v.netExternalFlow,
  };
}

function parsePerformanceMwrFlow(v: unknown): PerformanceMwrFlowDraft | null {
  if (!isObject(v) || !isNum(v.tYears) || !isNum(v.amount)) return null;
  return { tYears: v.tYears, amount: v.amount };
}

function parsePerformanceAnalysis(
  v: unknown,
): PerformanceAnalysisInputs | null {
  if (v === undefined) return defaultPerformanceAnalysis();
  if (
    !isObject(v) ||
    !isStr(v.flowTiming) ||
    !(TWR_FLOW_TIMINGS as readonly string[]).includes(v.flowTiming) ||
    !isNum(v.periodsPerYear) ||
    !isNum(v.terminalValue) ||
    !isNum(v.terminalTimeYears) ||
    !isStr(v.grossReturnsText) ||
    !isStr(v.feeRatesText) ||
    !isStr(v.portfolioReturnsText) ||
    !isStr(v.benchmarkReturnsText)
  ) {
    return null;
  }
  const twrPeriods = parseArray(v.twrPeriods, parsePerformanceTwrPeriod);
  const mwrFlows = parseArray(v.mwrFlows, parsePerformanceMwrFlow);
  if (twrPeriods === null || mwrFlows === null) return null;
  return {
    twrPeriods,
    flowTiming: v.flowTiming as TwrFlowTiming,
    periodsPerYear: v.periodsPerYear,
    mwrFlows,
    terminalValue: v.terminalValue,
    terminalTimeYears: v.terminalTimeYears,
    grossReturnsText: v.grossReturnsText,
    feeRatesText: v.feeRatesText,
    portfolioReturnsText: v.portfolioReturnsText,
    benchmarkReturnsText: v.benchmarkReturnsText,
  };
}

function defaultInheritedIra(): InheritedIraInputs {
  return {
    inheritedBalance: 500_000,
    beneficiaryOrdinaryIncome: 120_000,
    beneficiaryOrdinaryIncomeByYear: [],
    filingStatus: "single",
    taxYear: 2026,
    yearsRemaining: 10,
    annualReturn: 0.04,
    taxableDistributionRatio: 1,
    beneficiaryType: "other_designated_beneficiary",
    beneficiaryAge: 55,
    decedentAge: 82,
    targetRate: 0.24,
  };
}

function parseInheritedIra(v: unknown): InheritedIraInputs | null {
  if (v === undefined) return defaultInheritedIra();
  const beneficiaryOrdinaryIncomeByYear =
    v !== null &&
    typeof v === "object" &&
    "beneficiaryOrdinaryIncomeByYear" in v
      ? parseArray(
          (v as Record<string, unknown>).beneficiaryOrdinaryIncomeByYear,
          (x) => (isNum(x) ? x : null),
        )
      : [];
  if (
    !isObject(v) ||
    !isNum(v.inheritedBalance) ||
    !isNum(v.beneficiaryOrdinaryIncome) ||
    beneficiaryOrdinaryIncomeByYear === null ||
    !isStr(v.filingStatus) ||
    !FILING_STATUSES.includes(v.filingStatus as FilingStatus) ||
    !isNum(v.taxYear) ||
    !isNum(v.yearsRemaining) ||
    !isNum(v.annualReturn) ||
    !isNum(v.taxableDistributionRatio) ||
    !isStr(v.beneficiaryType) ||
    !(INHERITED_IRA_BENEFICIARY_TYPES as readonly string[]).includes(
      v.beneficiaryType,
    ) ||
    !isNum(v.beneficiaryAge) ||
    !isNum(v.decedentAge) ||
    !isNum(v.targetRate)
  ) {
    return null;
  }
  return {
    inheritedBalance: v.inheritedBalance,
    beneficiaryOrdinaryIncome: v.beneficiaryOrdinaryIncome,
    beneficiaryOrdinaryIncomeByYear,
    filingStatus: v.filingStatus as FilingStatus,
    taxYear: v.taxYear,
    yearsRemaining: v.yearsRemaining,
    annualReturn: v.annualReturn,
    taxableDistributionRatio: v.taxableDistributionRatio,
    beneficiaryType: v.beneficiaryType as InheritedIraBeneficiaryType,
    beneficiaryAge: v.beneficiaryAge,
    decedentAge: v.decedentAge,
    targetRate: v.targetRate,
  };
}

function parseRiskProfileScore(v: unknown): RiskProfileScoreInputs | null {
  if (v === undefined) {
    return { answers: { ...DEFAULT_RISK_PROFILE_ANSWERS } };
  }
  if (!isObject(v) || !isObject(v.answers)) return null;
  const answers: Record<string, string> = {};
  for (const [questionId, answerId] of Object.entries(v.answers)) {
    if (!isStr(answerId)) return null;
    if (!RISK_PROFILE_QUESTION_IDS.includes(questionId)) return null;
    if (!answerIdsForQuestion(questionId).includes(answerId)) return null;
    answers[questionId] = answerId;
  }
  for (const questionId of RISK_PROFILE_QUESTION_IDS) {
    if (!isStr(answers[questionId])) return null;
  }
  return { answers };
}

function parseNumberRecord(v: unknown): Record<string, number> | null {
  if (!isObject(v)) return null;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(v)) {
    if (!isNum(value)) return null;
    out[key] = value;
  }
  return out;
}

function parseRebalance(v: unknown): RebalanceInputs | null {
  if (!isObject(v)) return null;
  const targetWeights = parseNumberRecord(v.targetWeights);
  if (targetWeights === null) return null;
  return { targetWeights };
}

function parseOptimizeAllocation(v: unknown): OptimizeAllocationInputs | null {
  if (
    !isObject(v) ||
    !isStr(v.riskProfile) ||
    !(RISK_PROFILES as readonly string[]).includes(v.riskProfile) ||
    !isStr(v.objective) ||
    (v.objective !== "" &&
      !(ALLOCATION_OBJECTIVES as readonly string[]).includes(v.objective)) ||
    !isStr(v.assetClassIdsText) ||
    !isNum(v.weightMin) ||
    !isNum(v.weightMax) ||
    !isStr(v.returnModel) ||
    !(OPTIMIZE_RETURN_MODELS as readonly string[]).includes(v.returnModel) ||
    !isBool(v.regimeAware) ||
    !isNum(v.riskFreeRate)
  ) {
    return null;
  }
  return {
    riskProfile: v.riskProfile as OptimizeAllocationInputs["riskProfile"],
    objective: v.objective as OptimizeAllocationInputs["objective"],
    assetClassIdsText: v.assetClassIdsText,
    weightMin: v.weightMin,
    weightMax: v.weightMax,
    returnModel: v.returnModel as OptimizeAllocationInputs["returnModel"],
    regimeAware: v.regimeAware,
    riskFreeRate: v.riskFreeRate,
  };
}

function parseReportSectionDraft(v: unknown): ReportSectionDraft | null {
  if (
    !isObject(v) ||
    !isStr(v.kind) ||
    !isStr(v.title) ||
    !isStr(v.findingsText)
  ) {
    return null;
  }
  return { kind: v.kind, title: v.title, findingsText: v.findingsText };
}

function parsePlanningReportPreset(v: unknown): PlanningReportPreset | null {
  if (v === undefined) return "custom";
  if (v === "custom" || v === "wealth_roadmap") return v;
  return null;
}

function parseWealthRoadmapScope(v: unknown): WealthRoadmapScope | null {
  if (v === undefined) return "focused";
  if (v === "focused" || v === "full") return v;
  return null;
}

function parseBuildReport(v: unknown): BuildPlanningReportInputs | null {
  if (!isObject(v) || !isStr(v.title) || !isBool(v.includeRegime)) {
    return null;
  }
  const sections = parseArray(v.sections, parseReportSectionDraft);
  if (sections === null) return null;
  const preset = parsePlanningReportPreset(v.preset);
  const scope = parseWealthRoadmapScope(v.scope);
  if (preset === null || scope === null) return null;
  return {
    title: v.title,
    includeRegime: v.includeRegime,
    preset,
    scope,
    assumptionVersion: isStr(v.assumptionVersion)
      ? v.assumptionVersion
      : "2026.07",
    cmaVersion: isStr(v.cmaVersion) ? v.cmaVersion : "engine-default-cma",
    taxYear: isNum(v.taxYear) ? v.taxYear : 2026,
    seed: isNum(v.seed) ? v.seed : 20260707,
    engineReference: isStr(v.engineReference)
      ? v.engineReference
      : "nexus-core",
    sections,
  };
}

function isSubjectRefToken(v: unknown): v is string {
  return isStr(v) && /^[A-Za-z0-9._:-]{1,80}$/.test(v);
}

function parseEducationStudent(
  v: unknown,
): EducationFundingInputs["students"][number] | null {
  if (
    !isObject(v) ||
    !isSubjectRefToken(v.subjectRef) ||
    !isNum(v.annualCost) ||
    !isNum(v.yearsUntilStart) ||
    !isNum(v.fundingYears)
  ) {
    return null;
  }
  const student: EducationFundingInputs["students"][number] = {
    subjectRef: v.subjectRef,
    annualCost: v.annualCost,
    yearsUntilStart: v.yearsUntilStart,
    fundingYears: v.fundingYears,
  };
  if (isNum(v.currentSavings)) student.currentSavings = v.currentSavings;
  if (isNum(v.monthlyContribution)) {
    student.monthlyContribution = v.monthlyContribution;
  }
  return student;
}

function parseEducationFunding(v: unknown): EducationFundingInputs | null {
  if (
    !isObject(v) ||
    !isNum(v.taxYear) ||
    !isStr(v.selectedVehicle) ||
    !isNum(v.tuitionInflation) ||
    !isNum(v.afterTaxReturn)
  ) {
    return null;
  }
  const students = parseArray(v.students, parseEducationStudent);
  if (students === null) return null;
  return {
    taxYear: v.taxYear,
    selectedVehicle: v.selectedVehicle,
    tuitionInflation: v.tuitionInflation,
    afterTaxReturn: v.afterTaxReturn,
    students,
  };
}

function parseCashflowPlanningBridge(
  v: unknown,
): CashflowPlanningBridgeInputs | null {
  if (
    !isObject(v) ||
    !isNum(v.monthsAnalyzed) ||
    !isNum(v.averageMonthlySpending) ||
    !isNum(v.essentialMonthlySpending) ||
    !isNum(v.lifestyleMonthlySpending) ||
    !isNum(v.averageMonthlyIncome) ||
    !isNum(v.averageMonthlySavings) ||
    !isNum(v.currentCashReserve) ||
    !isNum(v.targetCashReserveMonths) ||
    !isNum(v.oneTimeExpenseAdjustment) ||
    !isStr(v.spendingVolatility) ||
    !(SPENDING_VOLATILITY as readonly string[]).includes(v.spendingVolatility)
  ) {
    return null;
  }
  return {
    monthsAnalyzed: v.monthsAnalyzed,
    averageMonthlySpending: v.averageMonthlySpending,
    essentialMonthlySpending: v.essentialMonthlySpending,
    lifestyleMonthlySpending: v.lifestyleMonthlySpending,
    averageMonthlyIncome: v.averageMonthlyIncome,
    averageMonthlySavings: v.averageMonthlySavings,
    currentCashReserve: v.currentCashReserve,
    targetCashReserveMonths: v.targetCashReserveMonths,
    oneTimeExpenseAdjustment: v.oneTimeExpenseAdjustment,
    spendingVolatility:
      v.spendingVolatility as CashflowPlanningBridgeInputs["spendingVolatility"],
  };
}

function parseCashReserveAnalysis(
  v: unknown,
): CashReserveAnalysisInputs | null {
  if (
    !isObject(v) ||
    !isNum(v.monthlyEssentialSpending) ||
    !isNum(v.monthlyTotalSpending) ||
    !isNum(v.currentCashReserve) ||
    !isNum(v.targetMonths) ||
    !isNum(v.secondaryTargetMonths)
  ) {
    return null;
  }
  return {
    monthlyEssentialSpending: v.monthlyEssentialSpending,
    monthlyTotalSpending: v.monthlyTotalSpending,
    currentCashReserve: v.currentCashReserve,
    targetMonths: v.targetMonths,
    secondaryTargetMonths: v.secondaryTargetMonths,
  };
}

function parseBudgetPacingProjection(
  v: unknown,
): BudgetPacingProjectionInputs | null {
  if (
    !isObject(v) ||
    !isNum(v.monthDay) ||
    !isNum(v.daysInMonth) ||
    !isNum(v.monthToDateSpending) ||
    !isNum(v.monthlyBudget) ||
    !isNum(v.recurringRemaining) ||
    !isNum(v.knownOneTimeRemaining)
  ) {
    return null;
  }
  return {
    monthDay: v.monthDay,
    daysInMonth: v.daysInMonth,
    monthToDateSpending: v.monthToDateSpending,
    monthlyBudget: v.monthlyBudget,
    recurringRemaining: v.recurringRemaining,
    knownOneTimeRemaining: v.knownOneTimeRemaining,
  };
}

/**
 * Validate and unwrap a parsed JSON value into a ScenarioSnapshot. Returns a
 * discriminated result rather than throwing for the expected failure modes
 * (wrong kind/version, malformed shape); a PII hit is reported as an error too.
 */
export function parseScenario(raw: unknown): ScenarioParseResult {
  if (!isObject(raw)) {
    return {
      ok: false,
      error: "Not a scenario file (expected a JSON object).",
    };
  }

  // Fail-closed PII check on the RAW input, before the field-whitelisting
  // parsers below would silently drop an identity-shaped key. A file that
  // smuggled one in is refused with an error, not quietly cleaned.
  try {
    assertNoPII(raw);
  } catch (e) {
    if (e instanceof PiiTripwireError) return { ok: false, error: e.message };
    throw e;
  }

  if (raw.kind !== SCENARIO_FILE_KIND) {
    return {
      ok: false,
      error: `Not a pwplan-core scenario file (kind="${String(raw.kind)}").`,
    };
  }
  if (raw.fileVersion !== SCENARIO_FILE_VERSION) {
    return {
      ok: false,
      error: `Unsupported scenario file version "${String(
        raw.fileVersion,
      )}" (expected "${SCENARIO_FILE_VERSION}").`,
    };
  }
  if (!isStr(raw.tool) || !PLANNING_TOOLS.includes(raw.tool as PlanningTool)) {
    return { ok: false, error: `Unknown tool "${String(raw.tool)}".` };
  }

  const inputs = parseInputs(raw.inputs);
  if (inputs === null) {
    return { ok: false, error: "Malformed or missing Monte Carlo inputs." };
  }
  const glidePathInputs = parseGlide(raw.glidePathInputs);
  if (glidePathInputs === null) {
    return { ok: false, error: "Malformed or missing glide-path inputs." };
  }
  const taxInputs = parseTax(raw.taxInputs);
  if (taxInputs === null) {
    return { ok: false, error: "Malformed or missing tax-withdrawal inputs." };
  }
  const rothInputs = parseRoth(raw.rothInputs);
  if (rothInputs === null) {
    return { ok: false, error: "Malformed or missing Roth-conversion inputs." };
  }
  const rothIrmaaInputs = parseRothIrmaa(raw.rothIrmaaInputs);
  if (rothIrmaaInputs === null) {
    return { ok: false, error: "Malformed or missing Roth/IRMAA inputs." };
  }
  const sorInputs = parseSor(raw.sorInputs);
  if (sorInputs === null) {
    return { ok: false, error: "Malformed or missing sequence-risk inputs." };
  }
  const rmdInputs = parseRmd(raw.rmdInputs);
  if (rmdInputs === null) {
    return { ok: false, error: "Malformed or missing RMD inputs." };
  }
  const bracketInputs = parseBracket(raw.bracketInputs);
  if (bracketInputs === null) {
    return { ok: false, error: "Malformed or missing bracket-room inputs." };
  }
  const socialSecurityInputs = parseSocialSecurity(raw.socialSecurityInputs);
  if (socialSecurityInputs === null) {
    return {
      ok: false,
      error: "Malformed or missing Social Security inputs.",
    };
  }
  const regimeSwrInputs = parseRegimeSwr(raw.regimeSwrInputs);
  if (regimeSwrInputs === null) {
    return { ok: false, error: "Malformed or missing regime-SWR inputs." };
  }
  const correlationInputs = parseCorrelation(raw.correlationInputs);
  if (correlationInputs === null) {
    return { ok: false, error: "Malformed or missing correlation inputs." };
  }
  const regimeGenInputs = parseRegimeGen(raw.regimeGenInputs);
  if (regimeGenInputs === null) {
    return { ok: false, error: "Malformed or missing regime-path inputs." };
  }
  const fireInputs = parseFire(raw.fireInputs);
  if (fireInputs === null) {
    return { ok: false, error: "Malformed or missing FIRE inputs." };
  }
  const riskMetricsInputs = parseRiskMetrics(raw.riskMetricsInputs);
  if (riskMetricsInputs === null) {
    return { ok: false, error: "Malformed or missing risk-metrics inputs." };
  }
  const incomeLayeringInputs = parseIncomeLayering(raw.incomeLayeringInputs);
  if (incomeLayeringInputs === null) {
    return {
      ok: false,
      error: "Malformed or missing income-layering inputs.",
    };
  }
  const historicalBlendInputs = parseHistoricalBlend(raw.historicalBlendInputs);
  if (historicalBlendInputs === null) {
    return {
      ok: false,
      error: "Malformed or missing historical-blend inputs.",
    };
  }
  const performanceAnalysisInputs = parsePerformanceAnalysis(
    raw.performanceAnalysisInputs,
  );
  if (performanceAnalysisInputs === null) {
    return {
      ok: false,
      error: "Malformed or missing performance-analysis inputs.",
    };
  }
  const inheritedIraInputs = parseInheritedIra(raw.inheritedIraInputs);
  if (inheritedIraInputs === null) {
    return { ok: false, error: "Malformed inherited-IRA inputs." };
  }
  const riskProfileScoreInputs = parseRiskProfileScore(
    raw.riskProfileScoreInputs,
  );
  if (riskProfileScoreInputs === null) {
    return {
      ok: false,
      error: "Malformed or missing risk-profile inputs.",
    };
  }
  const rebalanceInputs = parseRebalance(raw.rebalanceInputs);
  if (rebalanceInputs === null) {
    return { ok: false, error: "Malformed or missing rebalance inputs." };
  }
  const optimizeAllocationInputs = parseOptimizeAllocation(
    raw.optimizeAllocationInputs,
  );
  if (optimizeAllocationInputs === null) {
    return {
      ok: false,
      error: "Malformed or missing optimize-allocation inputs.",
    };
  }
  const buildReportInputs = parseBuildReport(raw.buildReportInputs);
  if (buildReportInputs === null) {
    return { ok: false, error: "Malformed or missing report-builder inputs." };
  }
  const educationFundingInputs = parseEducationFunding(
    raw.educationFundingInputs,
  );
  if (educationFundingInputs === null) {
    return { ok: false, error: "Malformed or missing education inputs." };
  }
  const cashflowPlanningBridgeInputs = parseCashflowPlanningBridge(
    raw.cashflowPlanningBridgeInputs,
  );
  if (cashflowPlanningBridgeInputs === null) {
    return {
      ok: false,
      error: "Malformed or missing cash-flow bridge inputs.",
    };
  }
  const cashReserveAnalysisInputs = parseCashReserveAnalysis(
    raw.cashReserveAnalysisInputs,
  );
  if (cashReserveAnalysisInputs === null) {
    return {
      ok: false,
      error: "Malformed or missing cash-reserve inputs.",
    };
  }
  const budgetPacingProjectionInputs = parseBudgetPacingProjection(
    raw.budgetPacingProjectionInputs,
  );
  if (budgetPacingProjectionInputs === null) {
    return {
      ok: false,
      error: "Malformed or missing budget-pacing inputs.",
    };
  }

  const snapshot: ScenarioSnapshot = {
    tool: raw.tool as PlanningTool,
    inputs,
    glidePathInputs,
    taxInputs,
    rothInputs,
    rothIrmaaInputs,
    sorInputs,
    rmdInputs,
    bracketInputs,
    socialSecurityInputs,
    regimeSwrInputs,
    correlationInputs,
    regimeGenInputs,
    fireInputs,
    riskMetricsInputs,
    incomeLayeringInputs,
    historicalBlendInputs,
    performanceAnalysisInputs,
    inheritedIraInputs,
    riskProfileScoreInputs,
    rebalanceInputs,
    optimizeAllocationInputs,
    buildReportInputs,
    educationFundingInputs,
    cashflowPlanningBridgeInputs,
    cashReserveAnalysisInputs,
    budgetPacingProjectionInputs,
  };

  return { ok: true, value: snapshot };
}

/** Parse a raw JSON string (file contents) into a ScenarioSnapshot. */
export function parseScenarioJSON(text: string): ScenarioParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      error: `File is not valid JSON: ${e instanceof Error ? e.message : e}`,
    };
  }
  return parseScenario(raw);
}
