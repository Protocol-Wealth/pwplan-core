// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * scenario-compare — pure helpers for the Scenario Compare tab.
 *
 * This file contains display/replay guard logic only. It does not introduce a
 * planning method; it compares Monte Carlo outputs that nexus-core computed
 * from de-identified scenario snapshots.
 */

import type { MonteCarloResult } from "../contract/planning";
import type { CompareRunResult, CompareScenario } from "../store/scenario";

export interface CompareCheck {
  ok: boolean;
  message?: string;
}

export interface CompareRow {
  id: string;
  label: string;
  successProbability: number;
  successDelta: number;
  medianTerminal: number;
  medianTerminalDelta: number;
  worstPathTerminal: number;
  worstPathDelta: number;
  seedUsed: number;
  cmaVersion: string | null;
}

export function scenarioCmaReference(scenario: CompareScenario): string {
  return scenario.assumptions?.asOf
    ? `cma-as-of:${scenario.assumptions.asOf}`
    : "engine-default-cma";
}

export function checkCompareInputs(
  scenarios: CompareScenario[],
  seed: number,
): CompareCheck {
  if (scenarios.length < 2 || scenarios.length > 3) {
    return { ok: false, message: "Choose 2 or 3 scenarios to compare." };
  }
  if (!Number.isInteger(seed) || seed < 0) {
    return {
      ok: false,
      message: "Use a non-negative integer seed for deterministic replay.",
    };
  }

  const cmaRefs = new Set(scenarios.map(scenarioCmaReference));
  if (cmaRefs.size > 1) {
    return {
      ok: false,
      message:
        "Scenario Compare requires one CMA source. Reload or add scenarios from the same market-assumptions state.",
    };
  }

  return { ok: true };
}

function readObject(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function readStringPath(value: unknown, path: string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    const obj = readObject(current);
    if (obj === null) return null;
    current = obj[key];
  }
  return typeof current === "string" && current.length > 0 ? current : null;
}

/**
 * The current pwplan-core Monte Carlo contract does not yet expose a stable
 * cmaVersion field. This extractor is intentionally duck-typed so the compare
 * gate tightens automatically when the additive field appears in a future
 * contract reconciliation.
 */
export function extractCmaVersion(result: MonteCarloResult): string | null {
  return (
    readStringPath(result, ["cmaVersion"]) ??
    readStringPath(result, ["cma_version"]) ??
    readStringPath(result, ["runManifest", "cmaVersion"]) ??
    readStringPath(result, ["run_manifest", "cma_version"]) ??
    readStringPath(result, ["manifest", "cmaVersion"]) ??
    readStringPath(result, ["metadata", "cmaVersion"])
  );
}

export function checkCompareResults(
  runs: CompareRunResult[],
  requestedSeed: number,
): CompareCheck {
  const mismatchedSeed = runs.find(
    (run) => run.result.seedUsed !== requestedSeed,
  );
  if (mismatchedSeed) {
    return {
      ok: false,
      message: `${mismatchedSeed.label} returned seed ${mismatchedSeed.result.seedUsed}; expected ${requestedSeed}.`,
    };
  }

  const cmaVersions = new Set(
    runs
      .map((run) => extractCmaVersion(run.result))
      .filter((value): value is string => value !== null),
  );
  if (cmaVersions.size > 0 && cmaVersions.size !== runs.length) {
    return {
      ok: false,
      message:
        "Scenario Compare refused results with partial cmaVersion coverage.",
    };
  }
  if (cmaVersions.size > 1) {
    return {
      ok: false,
      message: "Scenario Compare refused results with mismatched cmaVersion.",
    };
  }

  return { ok: true };
}

function p50Terminal(result: MonteCarloResult): number {
  const direct = result.terminalValues.p50;
  if (Number.isFinite(direct)) return direct;
  return result.medianBalanceByYear[result.medianBalanceByYear.length - 1] ?? 0;
}

export function buildCompareRows(runs: CompareRunResult[]): CompareRow[] {
  const base = runs[0]?.result;
  const baseSuccess = base?.successProbability ?? 0;
  const baseMedianTerminal = base ? p50Terminal(base) : 0;
  const baseWorstTerminal = base?.worstPathTerminal ?? 0;

  return runs.map((run) => {
    const medianTerminal = p50Terminal(run.result);
    return {
      id: run.id,
      label: run.label,
      successProbability: run.result.successProbability,
      successDelta: run.result.successProbability - baseSuccess,
      medianTerminal,
      medianTerminalDelta: medianTerminal - baseMedianTerminal,
      worstPathTerminal: run.result.worstPathTerminal,
      worstPathDelta: run.result.worstPathTerminal - baseWorstTerminal,
      seedUsed: run.result.seedUsed,
      cmaVersion: extractCmaVersion(run.result),
    };
  });
}
