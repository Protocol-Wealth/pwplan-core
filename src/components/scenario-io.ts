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
  ReturnModel,
} from "../contract/planning";
import { assertNoPII, PiiTripwireError } from "../lib/compliance";
import type {
  BracketHeadroomInputs,
  BuildPlanningReportInputs,
  CorrelationInputs,
  FireInputs,
  GlidePathInputs,
  GlidePathShape,
  OptimizeAllocationInputs,
  PlanningTool,
  RebalanceInputs,
  RegimeGenInputs,
  RegimeSwrInputs,
  ReportSectionDraft,
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
export const SCENARIO_FILE_VERSION = "2" as const;

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
    rebalanceInputs: snapshot.rebalanceInputs,
    optimizeAllocationInputs: snapshot.optimizeAllocationInputs,
    buildReportInputs: snapshot.buildReportInputs,
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
  "rebalance",
  "optimize_allocation",
  "build_report",
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

function parseBuildReport(v: unknown): BuildPlanningReportInputs | null {
  if (!isObject(v) || !isStr(v.title) || !isBool(v.includeRegime)) {
    return null;
  }
  const sections = parseArray(v.sections, parseReportSectionDraft);
  if (sections === null) return null;
  return { title: v.title, includeRegime: v.includeRegime, sections };
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
    rebalanceInputs,
    optimizeAllocationInputs,
    buildReportInputs,
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
