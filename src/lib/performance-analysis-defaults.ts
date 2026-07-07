// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import type { PerformanceAnalysisInputs } from "../store/scenario";

export const DEFAULT_PERFORMANCE_ANALYSIS_INPUTS: PerformanceAnalysisInputs = {
  twrPeriods: [
    { startValue: 100_000, endValue: 110_000, netExternalFlow: 0 },
    { startValue: 110_000, endValue: 125_000, netExternalFlow: 5_000 },
  ],
  flowTiming: "start",
  periodsPerYear: 1,
  mwrFlows: [{ tYears: 0, amount: -100_000 }],
  terminalValue: 125_000,
  terminalTimeYears: 2,
  grossReturnsText: "0.08, 0.06",
  feeRatesText: "0.01, 0.01",
  portfolioReturnsText: "0.08, 0.06",
  benchmarkReturnsText: "0.07, 0.055",
};
