// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * tool-validation — pure, UI-side request-shape validation for the glide-path
 * and tax-withdrawal tools. Like scenario-validation, this answers "is this a
 * well-formed request?" before dispatch. It encodes NO quant/financial logic —
 * only structural sanity (ranges, ordering, presence). All planning math stays
 * in nexus-core.
 */

import { isAllocationBalanced } from "./scenario-validation";
import type { Account, AssetClass } from "../contract/planning";
import type {
  BracketHeadroomInputs,
  BuildPlanningReportInputs,
  BudgetPacingProjectionInputs,
  CashReserveAnalysisInputs,
  CashflowPlanningBridgeInputs,
  CorrelationInputs,
  FireInputs,
  GlidePathInputs,
  OptimizeAllocationInputs,
  RebalanceInputs,
  RegimeGenInputs,
  RegimeSwrInputs,
  RiskMetricsInputs,
  RmdInputs,
  RothInputs,
  RothIrmaaInputs,
  SocialSecurityInputs,
  SorInputs,
  TaxWithdrawalInputs,
} from "../store/scenario";

const SPENDING_VOLATILITY = new Set(["low", "medium", "high"]);
const RAW_CASHFLOW_KEYS = new Set([
  "merchantoriginal",
  "accountoriginal",
  "originalstatement",
  "notes",
  "rawjson",
  "ownername",
  "transaction",
  "transactions",
  "csv",
]);

function hasRawCashflowField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasRawCashflowField);
  if (value === null || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[\s_-]/g, "");
    if (RAW_CASHFLOW_KEYS.has(normalized)) return true;
    if (hasRawCashflowField(child)) return true;
  }
  return false;
}

function isWeight(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1;
}

function isNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

function requireNoRawCashflowFields(value: unknown, issues: string[]): void {
  if (hasRawCashflowField(value)) {
    issues.push("Cash-flow bridge inputs must not include raw transaction fields.");
  }
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

/** Reasons a composite Roth/IRMAA request cannot be dispatched, in display order.
 *  Structural sanity only (the engine does the real validation + planning math). */
export function validateRothIrmaa(r: RothIrmaaInputs): string[] {
  const issues: string[] = [];

  if (!Number.isInteger(r.taxYear) || r.taxYear < 2000 || r.taxYear > 2100) {
    issues.push("Tax year must be a plausible year.");
  }
  if (!/^[A-Za-z]{2}$/.test(r.stateCode)) {
    issues.push("State code must be two letters (e.g. PA).");
  }
  if (
    !Number.isInteger(r.birthYearSelf) ||
    r.birthYearSelf < 1900 ||
    r.birthYearSelf > r.taxYear
  ) {
    issues.push(
      "Self birth year must be a plausible year at/ before the tax year.",
    );
  }
  if (r.filingStatus !== "single") {
    if (
      !Number.isInteger(r.birthYearSpouse) ||
      r.birthYearSpouse < 1900 ||
      r.birthYearSpouse > r.taxYear
    ) {
      issues.push(
        "Married filing statuses need a plausible spouse birth year.",
      );
    }
  }
  const householdSize = r.filingStatus === "single" ? 1 : 2;
  if (
    !Number.isInteger(r.medicareEnrolled) ||
    r.medicareEnrolled < 0 ||
    r.medicareEnrolled > householdSize
  ) {
    issues.push("Medicare enrollment count must fit the filing household.");
  }
  if (
    !Number.isInteger(r.conversionYears) ||
    r.conversionYears < 1 ||
    r.conversionYears > 5
  ) {
    issues.push("Conversion years must be a whole number from 1 to 5.");
  }
  if (r.tradIraAggregate <= 0) {
    issues.push("Traditional IRA aggregate must be greater than zero.");
  }
  if (r.nondeductibleBasis < 0 || r.nondeductibleBasis > r.tradIraAggregate) {
    issues.push("Nondeductible basis must be between 0 and the IRA aggregate.");
  }
  if (r.taxableLiquidity < 0)
    issues.push("Taxable liquidity cannot be negative.");
  if (r.qualifiedDividends > r.ordinaryDividends) {
    issues.push("Qualified dividends cannot exceed ordinary dividends.");
  }
  if (
    r.targetRule === "fill_to_rate" &&
    (r.targetRate <= 0 || r.targetRate >= 1)
  ) {
    issues.push("Fill-to-rate needs a target rate between 0 and 1.");
  }
  if (r.targetRule === "fixed_amount" && r.fixedAmount <= 0) {
    issues.push("Fixed amount must be greater than zero.");
  }
  if (r.irmaaInflation <= -1)
    issues.push("IRMAA inflation must be greater than -1.");
  if (r.irmaaBuffer < 0) issues.push("IRMAA buffer cannot be negative.");

  return issues;
}

/** Validate public-safe monthly-close aggregates for the planning bridge. */
export function validateCashflowPlanningBridge(
  c: CashflowPlanningBridgeInputs,
): string[] {
  const issues: string[] = [];
  requireNoRawCashflowFields(c, issues);

  if (!Number.isInteger(c.monthsAnalyzed) || c.monthsAnalyzed < 1) {
    issues.push("Months analyzed must be a positive whole number.");
  }
  if (!isNonNegative(c.averageMonthlySpending)) {
    issues.push("Average monthly spending cannot be negative.");
  }
  if (!isNonNegative(c.essentialMonthlySpending)) {
    issues.push("Essential monthly spending cannot be negative.");
  }
  if (!isNonNegative(c.lifestyleMonthlySpending)) {
    issues.push("Lifestyle monthly spending cannot be negative.");
  }
  if (!isNonNegative(c.averageMonthlyIncome)) {
    issues.push("Average monthly income cannot be negative.");
  }
  if (!isNonNegative(c.averageMonthlySavings)) {
    issues.push("Average monthly savings cannot be negative.");
  }
  if (!isNonNegative(c.currentCashReserve)) {
    issues.push("Current cash reserve cannot be negative.");
  }
  if (
    !Number.isFinite(c.targetCashReserveMonths) ||
    c.targetCashReserveMonths <= 0
  ) {
    issues.push("Target reserve months must be greater than zero.");
  }
  if (
    c.oneTimeExpenseAdjustment !== undefined &&
    !isNonNegative(c.oneTimeExpenseAdjustment)
  ) {
    issues.push("One-time expense adjustment cannot be negative.");
  }
  if (!SPENDING_VOLATILITY.has(c.spendingVolatility)) {
    issues.push("Spending volatility must be low, medium, or high.");
  }

  return issues;
}

/** Validate public-safe cash-reserve aggregate inputs. */
export function validateCashReserveAnalysis(
  r: CashReserveAnalysisInputs,
): string[] {
  const issues: string[] = [];
  requireNoRawCashflowFields(r, issues);

  if (!isNonNegative(r.monthlyEssentialSpending)) {
    issues.push("Monthly essential spending cannot be negative.");
  }
  if (!isNonNegative(r.monthlyTotalSpending)) {
    issues.push("Monthly total spending cannot be negative.");
  }
  if (r.monthlyTotalSpending < r.monthlyEssentialSpending) {
    issues.push("Monthly total spending must be at least essential spending.");
  }
  if (!isNonNegative(r.currentCashReserve)) {
    issues.push("Current cash reserve cannot be negative.");
  }
  if (!Number.isFinite(r.targetMonths) || r.targetMonths <= 0) {
    issues.push("Target months must be greater than zero.");
  }
  if (
    r.secondaryTargetMonths !== undefined &&
    r.secondaryTargetMonths !== 0 &&
    (!Number.isFinite(r.secondaryTargetMonths) ||
      r.secondaryTargetMonths <= 0)
  ) {
    issues.push("Secondary target months must be greater than zero when used.");
  }

  return issues;
}

/** Validate public-safe budget-pacing aggregate inputs. */
export function validateBudgetPacingProjection(
  b: BudgetPacingProjectionInputs,
): string[] {
  const issues: string[] = [];
  requireNoRawCashflowFields(b, issues);

  if (!Number.isInteger(b.daysInMonth) || b.daysInMonth < 28 || b.daysInMonth > 31) {
    issues.push("Days in month must be a whole number in [28, 31].");
  }
  if (
    !Number.isInteger(b.monthDay) ||
    b.monthDay < 1 ||
    b.monthDay > b.daysInMonth
  ) {
    issues.push("Month day must be a whole number within the month.");
  }
  if (!isNonNegative(b.monthToDateSpending)) {
    issues.push("Month-to-date spending cannot be negative.");
  }
  if (!Number.isFinite(b.monthlyBudget) || b.monthlyBudget <= 0) {
    issues.push("Monthly budget must be greater than zero.");
  }
  if (
    b.recurringRemaining !== undefined &&
    !isNonNegative(b.recurringRemaining)
  ) {
    issues.push("Recurring remaining cannot be negative.");
  }
  if (
    b.knownOneTimeRemaining !== undefined &&
    !isNonNegative(b.knownOneTimeRemaining)
  ) {
    issues.push("Known one-time remaining cannot be negative.");
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

/**
 * Reasons a portfolio X-ray cannot be dispatched. Analyzes the shared Monte
 * Carlo portfolio (asset classes + accounts), so it validates the same shape:
 * both present, allocations balanced, and only known asset-class ids referenced.
 */
export function validatePortfolioXray(
  assetClasses: AssetClass[],
  accounts: Account[],
): string[] {
  const issues: string[] = [];
  if (assetClasses.length === 0) {
    issues.push("Add asset classes in the Monte Carlo tab.");
  }
  if (accounts.length === 0) {
    issues.push("Add accounts in the Monte Carlo tab.");
    return issues;
  }
  const known = new Set(assetClasses.map((ac) => ac.id.trim()).filter(Boolean));
  for (const acct of accounts) {
    if (!isAllocationBalanced(acct)) {
      issues.push("Each account's allocation must sum to 1.");
      break;
    }
  }
  for (const acct of accounts) {
    if (Object.keys(acct.allocation).some((id) => !known.has(id))) {
      issues.push("An account references an unknown asset class.");
      break;
    }
  }
  return issues;
}

/** Reasons a FIRE / Coast-FIRE request cannot be dispatched, in display order. */
export function validateFire(f: FireInputs): string[] {
  const issues: string[] = [];
  if (!Number.isInteger(f.currentAge) || f.currentAge < 0) {
    issues.push("Current age must be a whole number, zero or more.");
  }
  if (!Number.isInteger(f.retirementAge) || f.retirementAge < f.currentAge) {
    issues.push(
      "Retirement age must be a whole number at or above current age.",
    );
  }
  if (f.currentBalance < 0) issues.push("Current balance cannot be negative.");
  if (f.annualContribution < 0) {
    issues.push("Annual contribution cannot be negative.");
  }
  if (f.growthRate <= -1) issues.push("Growth rate must be greater than -1.");
  if (f.annualSpend <= 0)
    issues.push("Annual spend must be greater than zero.");
  if (f.swr <= 0 || f.swr >= 1) {
    issues.push("Safe withdrawal rate must be between 0 and 1.");
  }
  return issues;
}

/** Reasons a risk-metrics request cannot be dispatched, in display order. */
export function validateRiskMetrics(r: RiskMetricsInputs): string[] {
  const issues: string[] = [];
  const returns = parseReturns(r.returnsText);
  if (returns === null) {
    issues.push("Returns must be a list of numbers (e.g. 0.07, -0.1).");
  } else if (returns.length < 2) {
    issues.push("Enter at least two returns.");
  } else if (returns.some((x) => x <= -1)) {
    issues.push("Each return must be greater than -1.");
  }
  if (!Number.isFinite(r.riskFreeRate)) {
    issues.push("Risk-free rate must be a number.");
  }
  if (!Number.isInteger(r.periodsPerYear) || r.periodsPerYear < 1) {
    issues.push("Periods per year must be a whole number, one or more.");
  }
  return issues;
}

/**
 * Reasons a rebalance request cannot be dispatched. Current holdings come from
 * the shared portfolio (accounts × allocations); `targetWeights` is the desired
 * allocation over the current asset-class ids and must sum to 1.
 */
export function validateRebalance(
  rb: RebalanceInputs,
  assetClasses: AssetClass[],
  accounts: Account[],
): string[] {
  const issues: string[] = [];
  if (assetClasses.length === 0) {
    issues.push("Add asset classes in the Monte Carlo tab.");
  }
  if (accounts.length === 0) {
    issues.push("Add accounts in the Monte Carlo tab.");
  }
  for (const acct of accounts) {
    if (!isAllocationBalanced(acct)) {
      issues.push("Each account's allocation must sum to 1.");
      break;
    }
  }
  if (assetClasses.length > 0) {
    let sum = 0;
    let negative = false;
    for (const ac of assetClasses) {
      const w = rb.targetWeights[ac.id] ?? 0;
      if (!Number.isFinite(w) || w < 0) negative = true;
      sum += w;
    }
    if (negative) issues.push("Target weights cannot be negative.");
    if (Math.abs(sum - 1) > 1e-6) {
      issues.push("Target weights must sum to 1.");
    }
  }
  return issues;
}

/**
 * Reasons an optimize-allocation request cannot be dispatched, in display order.
 * Structural sanity only — the engine sources the returns/covariance and solves.
 * An empty id list ⇒ the engine's full default universe (valid); a non-empty list
 * must hold at least two distinct ids.
 */
export function validateOptimizeAllocation(
  o: OptimizeAllocationInputs,
): string[] {
  const issues: string[] = [];
  const ids = parseIdList(o.assetClassIdsText);
  if (ids.length === 1) {
    issues.push("Optimize over the full universe, or name at least two ids.");
  } else if (ids.length >= 2 && new Set(ids).size !== ids.length) {
    issues.push("Asset-class ids must be distinct.");
  }
  if (!isWeight(o.weightMin) || !isWeight(o.weightMax)) {
    issues.push("Weight bounds must each be between 0 and 1.");
  } else if (o.weightMin > o.weightMax) {
    issues.push("Minimum weight bound cannot exceed the maximum.");
  }
  if (!Number.isFinite(o.riskFreeRate) || o.riskFreeRate <= -1) {
    issues.push("Risk-free rate must be a number greater than -1.");
  }
  return issues;
}

/**
 * Reasons a build-planning-report request cannot be dispatched, in display order.
 * Structural only: at least one section, each with a non-empty `kind`.
 */
export function validateBuildPlanningReport(
  r: BuildPlanningReportInputs,
): string[] {
  const issues: string[] = [];
  if (r.sections.length === 0) {
    issues.push("Add at least one section.");
    return issues;
  }
  if (r.sections.some((s) => s.kind.trim().length === 0)) {
    issues.push("Every section needs a kind.");
  }
  return issues;
}
