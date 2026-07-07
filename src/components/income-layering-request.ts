// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import type {
  Account,
  AccountBalanceMap,
  IncomeLayeringRequest,
  IncomeStreamInput,
  SocialSecurityIncomeInput,
} from "../contract/planning";
import type { IncomeLayeringInputs } from "../store/scenario";

export function accountBalancesFromAccounts(
  accounts: Account[],
): AccountBalanceMap {
  return accounts.reduce<AccountBalanceMap>((balances, account) => {
    balances[account.type] = (balances[account.type] ?? 0) + account.balance;
    return balances;
  }, {});
}

function socialSecurityInput(
  piaMonthly: number,
  claimAge: number,
  fraAge: number,
  colaRate: number,
): SocialSecurityIncomeInput | undefined {
  if (piaMonthly <= 0) return undefined;
  return { piaMonthly, claimAge, fraAge, colaRate };
}

function streamInput(
  stream: IncomeLayeringInputs["incomeStreams"][number],
): IncomeStreamInput | null {
  if (stream.annualAmount <= 0) return null;
  return {
    kind: stream.kind,
    annualAmount: stream.annualAmount,
    startAge: stream.startAge,
    ...(stream.endAge > 0 ? { endAge: stream.endAge } : {}),
    colaRate: stream.colaRate,
  };
}

export function buildIncomeLayeringRequest(
  inputs: IncomeLayeringInputs,
  accounts: Account[],
): Omit<IncomeLayeringRequest, "contractVersion"> {
  const socialSecurity = socialSecurityInput(
    inputs.primaryPiaMonthly,
    inputs.primaryClaimAge,
    inputs.primaryFraAge,
    inputs.primaryColaRate,
  );
  const spouseSocialSecurity = socialSecurityInput(
    inputs.spousePiaMonthly,
    inputs.spouseClaimAge,
    inputs.spouseFraAge,
    inputs.spouseColaRate,
  );
  const incomeStreams = inputs.incomeStreams
    .map(streamInput)
    .filter((stream): stream is IncomeStreamInput => stream !== null);
  const state = inputs.stateCode.trim().toUpperCase();
  return {
    currentAge: inputs.currentAge,
    retirementAge: inputs.retirementAge,
    terminalAge: inputs.terminalAge,
    spendingTarget: inputs.spendingTarget,
    earnedIncome: inputs.earnedIncome,
    wageGrowthRate: inputs.wageGrowthRate,
    spendingInflationRate: inputs.spendingInflationRate,
    filingStatus: inputs.filingStatus,
    taxYear: inputs.taxYear,
    baseYear: inputs.baseYear,
    accountBalances: accountBalancesFromAccounts(accounts),
    expectedReturn: inputs.expectedReturn,
    ...(inputs.bracketFillTargetRate > 0
      ? { bracketFillTargetRate: inputs.bracketFillTargetRate }
      : {}),
    ...(inputs.birthYear > 0 ? { birthYear: inputs.birthYear } : {}),
    ...(state.length > 0 ? { state } : {}),
    ...(socialSecurity ? { socialSecurity } : {}),
    ...(spouseSocialSecurity ? { spouseSocialSecurity } : {}),
    ...(incomeStreams.length > 0 ? { incomeStreams } : {}),
    ...(inputs.survivorYear > 0
      ? {
          survivorYear: inputs.survivorYear,
          survivorFilingStatus: inputs.survivorFilingStatus,
        }
      : {}),
  };
}
