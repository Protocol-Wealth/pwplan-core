// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * tool-validation — pure, UI-side request-shape validation for the glide-path
 * and tax-withdrawal tools. Like scenario-validation, this answers "is this a
 * well-formed request?" before dispatch. It encodes NO quant/financial logic —
 * only structural sanity (ranges, ordering, presence). All planning math stays
 * in nexus-core.
 */

import type { Account, AssetClass } from "../contract/planning";
import type {
  BracketHeadroomInputs,
  CorrelationInputs,
  GlidePathInputs,
  RegimeGenInputs,
  RegimeSwrInputs,
  RmdInputs,
  RothInputs,
  SocialSecurityInputs,
  SorInputs,
  TaxWithdrawalInputs,
} from "../store/scenario";

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

/** Reasons a Roth-conversion request cannot be dispatched, in display order. */
export function validateRoth(r: RothInputs): string[] {
  const issues: string[] = [];

  if (r.currentTaxableIncome < 0) {
    issues.push("Current taxable income cannot be negative.");
  }
  if (r.conversionAmount <= 0) {
    issues.push("Conversion amount must be greater than zero.");
  }
  if (r.growthRate <= -1) issues.push("Growth rate must be greater than -1.");
  if (!Number.isInteger(r.years) || r.years < 0) {
    issues.push("Years must be a whole number, zero or more.");
  }
  if (r.retirementMarginalRate < 0 || r.retirementMarginalRate >= 1) {
    issues.push("Retirement marginal rate must be between 0 and 1.");
  }

  return issues;
}

/**
 * Parse a comma/space-separated list of decimal returns into numbers. Returns
 * null if any token is not a finite number (so callers can flag the input).
 * Pure — no quant logic, only shape parsing.
 */
export function parseReturns(text: string): number[] | null {
  const tokens = text.split(/[,\s]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  const out: number[] = [];
  for (const tok of tokens) {
    const n = Number(tok);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

/** Reasons a sequence-of-returns-stress request cannot be dispatched. */
export function validateSequenceStress(s: SorInputs): string[] {
  const issues: string[] = [];

  if (s.initialBalance <= 0) {
    issues.push("Initial balance must be greater than zero.");
  }
  if (s.annualSpend < 0) issues.push("Annual spend cannot be negative.");
  const returns = parseReturns(s.returnsText);
  if (returns === null) {
    issues.push("Annual returns must be a list of numbers (e.g. 0.07, -0.1).");
  } else if (returns.some((r) => r <= -1)) {
    issues.push("Each annual return must be greater than -1.");
  }

  return issues;
}

/** Reasons an RMD request cannot be dispatched, in display order. */
export function validateRmd(r: RmdInputs): string[] {
  const issues: string[] = [];
  if (!Number.isInteger(r.age) || r.age < 0) {
    issues.push("Age must be a whole number, zero or more.");
  }
  if (r.balance < 0) issues.push("Balance cannot be negative.");
  return issues;
}

/** Reasons a bracket-headroom request cannot be dispatched, in display order. */
export function validateBracketHeadroom(b: BracketHeadroomInputs): string[] {
  const issues: string[] = [];
  if (b.taxableIncome < 0) issues.push("Taxable income cannot be negative.");
  if (b.targetRate < 0 || b.targetRate >= 1) {
    issues.push("Target rate must be between 0 and 1.");
  }
  return issues;
}

/** Reasons a Social-Security request cannot be dispatched, in display order. */
export function validateSocialSecurity(s: SocialSecurityInputs): string[] {
  const issues: string[] = [];
  if (s.piaMonthly <= 0) issues.push("Monthly PIA must be greater than zero.");
  if (!Number.isInteger(s.fraAge) || s.fraAge <= 62 || s.fraAge > 70) {
    issues.push("Full retirement age must be a whole number in (62, 70].");
  }
  return issues;
}

/** Reasons a regime-conditioned-SWR request cannot be dispatched. */
export function validateRegimeSwr(r: RegimeSwrInputs): string[] {
  const issues: string[] = [];
  if (r.baseSwr <= 0 || r.baseSwr >= 1) {
    issues.push("Base withdrawal rate must be between 0 and 1.");
  }
  if (r.portfolioBalance < 0) {
    issues.push("Portfolio balance cannot be negative.");
  }
  return issues;
}

/** Split a comma/space-separated id list into trimmed, non-empty tokens. Pure. */
export function parseIdList(text: string): string[] {
  return text
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Reasons a correlation-matrix request cannot be dispatched, in display order. */
export function validateCorrelation(c: CorrelationInputs): string[] {
  const issues: string[] = [];
  if (parseIdList(c.assetClassIdsText).length < 2) {
    issues.push("Enter at least two asset-class ids.");
  }
  if (
    !Number.isInteger(c.lookbackDays) ||
    c.lookbackDays < 30 ||
    c.lookbackDays > 3650
  ) {
    issues.push("Lookback days must be a whole number in [30, 3650].");
  }
  return issues;
}

/**
 * Reasons a regime-return-generator request cannot be dispatched. Uses the
 * shared portfolio's asset classes (each needs a λ for the EMF regime model).
 */
export function validateRegimeGen(
  g: RegimeGenInputs,
  assetClasses: AssetClass[],
): string[] {
  const issues: string[] = [];
  if (assetClasses.length === 0) {
    issues.push("Add asset classes in the Monte Carlo tab (each needs a λ).");
  } else if (
    assetClasses.some(
      (ac) => ac.lambda === undefined || !Number.isFinite(ac.lambda),
    )
  ) {
    issues.push("Every asset class needs a λ (EMF decay) for regime paths.");
  }
  if (
    !Number.isInteger(g.horizonYears) ||
    g.horizonYears < 1 ||
    g.horizonYears > 200
  ) {
    issues.push("Horizon years must be a whole number in [1, 200].");
  }
  if (!Number.isInteger(g.paths) || g.paths < 1 || g.paths > 50_000) {
    issues.push("Paths must be a whole number in [1, 50000].");
  }
  return issues;
}
