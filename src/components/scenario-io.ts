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
  GlidePathInputs,
  GlidePathShape,
  PlanningTool,
  ScenarioInputs,
  TaxWithdrawalInputs,
} from "../store/scenario";

/** Bump when the envelope shape changes incompatibly. */
export const SCENARIO_FILE_VERSION = "1" as const;

/** Tag identifying a pwplan-core scenario file, to reject unrelated JSON. */
export const SCENARIO_FILE_KIND = "pwplan-core/scenario" as const;

/** The portable, PII-free plan-inputs envelope (no engine results). */
export interface SerializedScenario {
  kind: typeof SCENARIO_FILE_KIND;
  fileVersion: typeof SCENARIO_FILE_VERSION;
  /** Contract version the inputs were authored against (traceability only). */
  contractVersion: string;
  tool: PlanningTool;
  inputs: ScenarioInputs;
  glidePathInputs: GlidePathInputs;
  taxInputs: TaxWithdrawalInputs;
}

/** The subset of store state a scenario file captures. */
export interface ScenarioSnapshot {
  tool: PlanningTool;
  inputs: ScenarioInputs;
  glidePathInputs: GlidePathInputs;
  taxInputs: TaxWithdrawalInputs;
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
const PLANNING_TOOLS: PlanningTool[] = [
  "monte_carlo",
  "glide_path",
  "tax_withdrawal",
  "roth_conversion",
  "sequence_stress",
  "rmd",
  "bracket_headroom",
  "social_security",
  "regime_swr",
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

  const snapshot: ScenarioSnapshot = {
    tool: raw.tool as PlanningTool,
    inputs,
    glidePathInputs,
    taxInputs,
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
