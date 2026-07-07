// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import type { PerformanceAnalysisRequest } from "../contract/planning";
import type { PerformanceAnalysisInputs } from "../store/scenario";
import { parseReturns } from "./tool-validation";

function parseSeries(text: string): number[] | null {
  const parsed = parseReturns(text);
  return parsed && parsed.length > 0 ? parsed : null;
}

export function buildPerformanceAnalysisRequest(
  inputs: PerformanceAnalysisInputs,
): Omit<PerformanceAnalysisRequest, "contractVersion"> {
  const request: Omit<PerformanceAnalysisRequest, "contractVersion"> = {
    periodsPerYear: inputs.periodsPerYear,
  };
  if (inputs.twrPeriods.length > 0) {
    request.twrPeriods = inputs.twrPeriods;
    request.flowTiming = inputs.flowTiming;
  }
  if (inputs.mwrFlows.length > 0) {
    request.mwrFlows = inputs.mwrFlows;
    request.terminalValue = inputs.terminalValue;
    request.terminalTimeYears = inputs.terminalTimeYears;
  }
  const grossReturns = parseSeries(inputs.grossReturnsText);
  const feeRates = parseSeries(inputs.feeRatesText);
  if (grossReturns && feeRates) {
    request.grossReturns = grossReturns;
    request.feeRates = feeRates;
  }
  const portfolioReturns = parseSeries(inputs.portfolioReturnsText);
  const benchmarkReturns = parseSeries(inputs.benchmarkReturnsText);
  if (portfolioReturns && benchmarkReturns) {
    request.portfolioReturns = portfolioReturns;
    request.benchmarkReturns = benchmarkReturns;
  }
  return request;
}
