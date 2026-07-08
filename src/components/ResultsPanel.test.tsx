// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonteCarloResult } from "../contract/planning";
import { MonteCarloResultView } from "./ResultsPanel";

const reportResult: MonteCarloResult = {
  contractVersion: "0.1.0",
  successProbability: 0.83,
  successProbabilityConfidenceInterval: {
    method: "wilson",
    confidenceLevel: 0.95,
    successes: 830,
    paths: 1000,
    lower: 0.804,
    upper: 0.852,
    halfWidth: 0.024,
  },
  terminalValues: { p10: 100_000, p50: 500_000, p90: 1_000_000 },
  balancePercentilesByYear: {
    p10: [900_000, 850_000],
    p50: [1_000_000, 1_050_000],
    p90: [1_100_000, 1_250_000],
  },
  medianBalanceByYear: [1_000_000, 1_050_000],
  depletionStats: {
    failedPathCount: 170,
    failedPathProbability: 0.17,
    depletionYearPercentiles: { p10: 24, p50: 38, p90: 48 },
    depletionAgePercentiles: { p10: 69, p50: 83, p90: 93 },
  },
  depletionCurve: [
    { projectionYear: 1, age: 45, depletionProbability: 0 },
    { projectionYear: 2, age: 46, depletionProbability: 0.01 },
  ],
  conditionalShortfall: {
    basis: "cumulative_unmet_portfolio_withdrawal_nominal",
    failedPathCount: 170,
    p50: 120_000,
    p90: 450_000,
    mean: 180_000,
  },
  firstDecadeReturnVsOutcome: {
    years: 10,
    successfulMedianAnnualReturn: 0.074,
    failedMedianAnnualReturn: -0.012,
    deciles: [
      {
        decile: 1,
        pathCount: 100,
        returnMin: -0.08,
        returnMax: -0.02,
        medianAnnualReturn: -0.04,
        successProbability: 0.12,
      },
    ],
  },
  worstPathTerminal: 0,
  seedUsed: 7,
  runManifest: {
    manifestVersion: "monte_carlo_run_manifest_0.1.0",
    engineVersion: "0.1.0",
    assumptionsHash: "a".repeat(64),
    returnModel: "multivariate_normal",
    paths: 1000,
    years: 50,
    seed: 7,
    regimeSeed: 7,
    successProbabilityCiHalfWidth: 0.024,
    successProbabilityCiMaxReportHalfWidth: 0.015,
    successProbabilityCiWithinReportTolerance: false,
  },
  guardrailActivity: {
    pathsWithCut: 0.42,
    pathsWithRaise: 0.08,
    band: 0.2,
    cut: 0.1,
    raise: 0.1,
  },
  guardrailStats: {
    cutCountPercentiles: { p10: 0, p50: 2, p90: 5 },
    raiseCountPercentiles: { p10: 0, p50: 1, p90: 3 },
    pathsWithMultipleCuts: 0.31,
    firstCutProjectionYearPercentiles: { p10: 4, p50: 9, p90: 18 },
    firstCutAgePercentiles: { p10: 49, p50: 54, p90: 63 },
  },
  withdrawalRule: "guyton_klinger",
  goalFunding: {
    goals: [
      {
        id: "goal-1",
        requestedAmount: 75_000,
        fullyFundedProbability: 0.81,
        averageFundedRatio: 0.9,
        fundedAmountPercentiles: { p10: 40_000, p50: 75_000, p90: 75_000 },
      },
    ],
  },
  ltcShock: {
    onsetAge: 84,
    annualCostToday: 120_000,
    durationYears: 4,
    costInflation: 0.04,
    annualCostConvention: "current_year_dollars_inflated_to_each_active_age",
    nominalTotalCost: 510_000,
    activeYears: [{ projectionYear: 40, age: 84, cost: 120_000 }],
  },
  ltcShockImpact: {
    basis: "same_seed_same_returns_with_vs_without_ltc_shock",
    baselineSuccessProbability: 0.81,
    withShockSuccessProbability: 0.72,
    successProbabilityDelta: -0.09,
    selfInsuredProbability: 0.88,
    baselineTerminalValues: { p50: 1_000_000 },
    withShockTerminalValues: { p50: 800_000 },
  },
};

describe("MonteCarloResultView", () => {
  it("renders optional Nexus report-quality result sections", () => {
    const html = renderToStaticMarkup(
      <MonteCarloResultView result={reportResult} startAge={45} />,
    );

    expect(html).toContain("wilson");
    expect(html).toContain("Balance percentile bands");
    expect(html).toContain("Report quality diagnostics");
    expect(html).toContain("Depletion probability by year");
    expect(html).toContain("First-decade return vs outcome");
    expect(html).toContain("Guardrail activity");
    expect(html).toContain("Goal funding");
    expect(html).toContain("LTC shock impact");
    expect(html).toContain("goal-1");
    expect(html).toContain("0.1.0");
  });
});
