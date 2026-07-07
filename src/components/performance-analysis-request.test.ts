// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { DEFAULT_PERFORMANCE_ANALYSIS_INPUTS } from "../lib/performance-analysis-defaults";
import { buildPerformanceAnalysisRequest } from "./performance-analysis-request";

describe("buildPerformanceAnalysisRequest", () => {
  it("maps UI state to the performance_analysis contract", () => {
    expect(
      buildPerformanceAnalysisRequest(DEFAULT_PERFORMANCE_ANALYSIS_INPUTS),
    ).toEqual({
      twrPeriods: [
        { startValue: 100_000, endValue: 110_000, netExternalFlow: 0 },
        { startValue: 110_000, endValue: 125_000, netExternalFlow: 5_000 },
      ],
      flowTiming: "start",
      periodsPerYear: 1,
      mwrFlows: [{ tYears: 0, amount: -100_000 }],
      terminalValue: 125_000,
      terminalTimeYears: 2,
      grossReturns: [0.08, 0.06],
      feeRates: [0.01, 0.01],
      portfolioReturns: [0.08, 0.06],
      benchmarkReturns: [0.07, 0.055],
    });
  });

  it("omits optional sections when their inputs are blank or empty", () => {
    expect(
      buildPerformanceAnalysisRequest({
        ...DEFAULT_PERFORMANCE_ANALYSIS_INPUTS,
        twrPeriods: [],
        mwrFlows: [],
        grossReturnsText: "",
        feeRatesText: "",
      }),
    ).toEqual({
      periodsPerYear: 1,
      portfolioReturns: [0.08, 0.06],
      benchmarkReturns: [0.07, 0.055],
    });
  });
});
