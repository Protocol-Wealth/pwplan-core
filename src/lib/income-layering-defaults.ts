// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import type { IncomeLayeringInputs } from "../store/scenario";

export const DEFAULT_INCOME_LAYERING_INPUTS: IncomeLayeringInputs = {
  currentAge: 62,
  retirementAge: 65,
  terminalAge: 95,
  spendingTarget: 130_000,
  earnedIncome: 180_000,
  wageGrowthRate: 0.03,
  spendingInflationRate: 0.025,
  filingStatus: "married_joint",
  taxYear: 2026,
  baseYear: 2026,
  expectedReturn: 0.05,
  bracketFillTargetRate: 0.24,
  birthYear: 1964,
  stateCode: "PA",
  primaryPiaMonthly: 2_700,
  primaryClaimAge: 67,
  primaryFraAge: 67,
  primaryColaRate: 0.02,
  spousePiaMonthly: 1_900,
  spouseClaimAge: 67,
  spouseFraAge: 67,
  spouseColaRate: 0.02,
  incomeStreams: [
    {
      kind: "pension",
      annualAmount: 24_000,
      startAge: 65,
      endAge: 0,
      colaRate: 0,
    },
  ],
  survivorYear: 0,
  survivorFilingStatus: "single",
};
