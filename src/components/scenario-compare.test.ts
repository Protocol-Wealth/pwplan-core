// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, expect, it } from "vitest";
import type { MonteCarloResult } from "../contract/planning";
import type { CompareRunResult, CompareScenario } from "../store/scenario";
import {
  buildCompareRows,
  checkCompareInputs,
  checkCompareResults,
  extractCmaVersion,
  scenarioCmaReference,
} from "./scenario-compare";

function scenario(id: string, asOf: string | null = null): CompareScenario {
  return {
    id,
    label: id,
    snapshot: {} as CompareScenario["snapshot"],
    assumptions: asOf
      ? {
          asOf,
          correlations: {},
        }
      : null,
  };
}

function result(
  patch: Partial<MonteCarloResult> & Record<string, unknown> = {},
): MonteCarloResult {
  return {
    contractVersion: "0.1.0",
    successProbability: 0.8,
    terminalValues: { p10: 100_000, p50: 500_000, p90: 1_000_000 },
    medianBalanceByYear: [900_000, 800_000, 500_000],
    worstPathTerminal: 25_000,
    seedUsed: 42,
    ...patch,
  };
}

function run(
  id: string,
  patch: Partial<MonteCarloResult> & Record<string, unknown> = {},
): CompareRunResult {
  return { id, label: id, result: result(patch) };
}

describe("scenario compare helpers", () => {
  it("requires 2 or 3 scenarios and a deterministic integer seed", () => {
    expect(checkCompareInputs([scenario("one")], 42).ok).toBe(false);
    expect(
      checkCompareInputs(
        [scenario("one"), scenario("two"), scenario("three"), scenario("four")],
        42,
      ).ok,
    ).toBe(false);
    expect(checkCompareInputs([scenario("one"), scenario("two")], 1.5).ok).toBe(
      false,
    );
    expect(checkCompareInputs([scenario("one"), scenario("two")], 42).ok).toBe(
      true,
    );
  });

  it("refuses snapshots sourced from different capital-market assumptions", () => {
    const check = checkCompareInputs(
      [scenario("base", "2026-07-01"), scenario("what-if", "2026-07-02")],
      42,
    );
    expect(check.ok).toBe(false);
    expect(check.message).toContain("one CMA source");
  });

  it("labels default and live market assumption references distinctly", () => {
    expect(scenarioCmaReference(scenario("base"))).toBe("engine-default-cma");
    expect(scenarioCmaReference(scenario("live", "2026-07-01"))).toBe(
      "cma-as-of:2026-07-01",
    );
  });

  it("extracts additive cmaVersion fields from future result envelopes", () => {
    expect(extractCmaVersion(result({ cmaVersion: "cma-2026q3" }))).toBe(
      "cma-2026q3",
    );
    expect(
      extractCmaVersion(result({ runManifest: { cmaVersion: "cma-2026q4" } })),
    ).toBe("cma-2026q4");
  });

  it("checks returned seeds and result cmaVersion mismatches", () => {
    expect(checkCompareResults([run("base"), run("what-if")], 42).ok).toBe(
      true,
    );
    expect(
      checkCompareResults([run("base", { seedUsed: 99 }), run("what-if")], 42)
        .ok,
    ).toBe(false);
    expect(
      checkCompareResults(
        [run("base", { cmaVersion: "cma-a" }), run("what-if")],
        42,
      ).ok,
    ).toBe(false);
    expect(
      checkCompareResults(
        [
          run("base", { cmaVersion: "cma-a" }),
          run("what-if", { cmaVersion: "cma-b" }),
        ],
        42,
      ).ok,
    ).toBe(false);
  });

  it("builds rows with deltas from the first scenario", () => {
    const rows = buildCompareRows([
      run("base"),
      run("later", {
        successProbability: 0.9,
        terminalValues: { p50: 650_000 },
        worstPathTerminal: 40_000,
      }),
    ]);

    expect(rows[0]).toMatchObject({
      label: "base",
      successDelta: 0,
      medianTerminalDelta: 0,
      worstPathDelta: 0,
    });
    expect(rows[1]).toMatchObject({
      label: "later",
      medianTerminal: 650_000,
      medianTerminalDelta: 150_000,
      worstPathDelta: 15_000,
    });
    expect(rows[1].successDelta).toBeCloseTo(0.1);
  });
});
