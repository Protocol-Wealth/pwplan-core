/**
 * tool-validation — pure, UI-side request-shape validation for the glide-path
 * and tax-withdrawal tools. Like scenario-validation, this answers "is this a
 * well-formed request?" before dispatch. It encodes NO quant/financial logic —
 * only structural sanity (ranges, ordering, presence). All planning math stays
 * in nexus-core.
 */

import type { Account } from "../contract/planning";
import type { GlidePathInputs, TaxWithdrawalInputs } from "../store/scenario";

function isWeight(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1;
}

/** Reasons a glide-path request cannot be dispatched, in display order. */
export function validateGlidePath(g: GlidePathInputs): string[] {
  const issues: string[] = [];

  if (g.currentAge < 0) issues.push("Current age must be positive.");
  if (g.retirementAge < g.currentAge) {
    issues.push("Retirement age must not be below current age.");
  }
  if (g.horizonAge <= g.retirementAge) {
    issues.push("Horizon age must be beyond retirement age.");
  }
  if (!isWeight(g.startEquityWeight)) {
    issues.push("Start equity weight must be between 0 and 1.");
  }
  if (!isWeight(g.endEquityWeight)) {
    issues.push("End equity weight must be between 0 and 1.");
  }

  return issues;
}

/**
 * Reasons a tax-withdrawal request cannot be dispatched, in display order.
 * Accounts are shared with the portfolio (the contract's `Account[]`), so this
 * validates that the portfolio is present rather than re-collecting it.
 */
export function validateTaxWithdrawal(
  t: TaxWithdrawalInputs,
  accounts: Account[],
): string[] {
  const issues: string[] = [];

  if (accounts.length === 0) {
    issues.push("Add accounts in the Monte Carlo tab to model withdrawals.");
  }
  if (!Number.isInteger(t.year) || t.year < 1900) {
    issues.push("Enter a valid tax year.");
  }
  if (t.age < 0) issues.push("Age must be positive.");
  if (t.grossNeed <= 0) issues.push("Gross need must be greater than zero.");
  if (t.otherTaxableIncome < 0) {
    issues.push("Other taxable income cannot be negative.");
  }

  return issues;
}
