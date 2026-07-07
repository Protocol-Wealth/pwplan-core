// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  accountBalancesFromAccounts,
  buildIncomeLayeringRequest,
} from "./income-layering-request";
import { DEFAULT_INCOME_LAYERING_INPUTS } from "../lib/income-layering-defaults";
import type { Account } from "../contract/planning";

const accounts: Account[] = [
  { type: "taxable", balance: 100_000, allocation: { us_equity: 1 } },
  { type: "traditional", balance: 500_000, allocation: { us_bonds: 1 } },
  { type: "traditional", balance: 250_000, allocation: { us_equity: 1 } },
  { type: "roth", balance: 75_000, allocation: { us_equity: 1 } },
];

describe("accountBalancesFromAccounts", () => {
  it("aggregates balances by account type", () => {
    expect(accountBalancesFromAccounts(accounts)).toEqual({
      taxable: 100_000,
      traditional: 750_000,
      roth: 75_000,
    });
  });
});

describe("buildIncomeLayeringRequest", () => {
  it("maps UI state to the income_layering contract", () => {
    expect(
      buildIncomeLayeringRequest(DEFAULT_INCOME_LAYERING_INPUTS, accounts),
    ).toMatchObject({
      currentAge: 62,
      retirementAge: 65,
      terminalAge: 95,
      spendingTarget: 130_000,
      filingStatus: "married_joint",
      taxYear: 2026,
      state: "PA",
      birthYear: 1964,
      accountBalances: {
        taxable: 100_000,
        traditional: 750_000,
        roth: 75_000,
      },
      socialSecurity: {
        piaMonthly: 2_700,
        claimAge: 67,
        fraAge: 67,
        colaRate: 0.02,
      },
      spouseSocialSecurity: {
        piaMonthly: 1_900,
        claimAge: 67,
        fraAge: 67,
        colaRate: 0.02,
      },
      incomeStreams: [
        {
          kind: "pension",
          annualAmount: 24_000,
          startAge: 65,
          colaRate: 0,
        },
      ],
    });
  });

  it("omits disabled optional fields instead of sending zero placeholders", () => {
    const request = buildIncomeLayeringRequest(
      {
        ...DEFAULT_INCOME_LAYERING_INPUTS,
        bracketFillTargetRate: 0,
        birthYear: 0,
        stateCode: "",
        primaryPiaMonthly: 0,
        spousePiaMonthly: 0,
        incomeStreams: [],
        survivorYear: 0,
      },
      accounts,
    );

    expect(request).not.toHaveProperty("bracketFillTargetRate");
    expect(request).not.toHaveProperty("birthYear");
    expect(request).not.toHaveProperty("state");
    expect(request).not.toHaveProperty("socialSecurity");
    expect(request).not.toHaveProperty("spouseSocialSecurity");
    expect(request).not.toHaveProperty("incomeStreams");
    expect(request).not.toHaveProperty("survivorYear");
    expect(request).not.toHaveProperty("survivorFilingStatus");
  });
});
