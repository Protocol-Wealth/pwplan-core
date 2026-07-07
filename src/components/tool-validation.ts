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
import {
  answerIdsForQuestion,
  RISK_PROFILE_QUESTION_IDS,
} from "../lib/risk-profile-questionnaire";
import type { Account, AssetClass } from "../contract/planning";
import type {
  BracketHeadroomInputs,
  BuildPlanningReportInputs,
  BudgetPacingProjectionInputs,
  CashReserveAnalysisInputs,
  CashflowPlanningBridgeInputs,
  CorrelationInputs,
  EducationFundingInputs,
  FireInputs,
  GlidePathInputs,
  HistoricalBlendInputs,
  IncomeLayeringInputs,
  OptimizeAllocationInputs,
  PerformanceAnalysisInputs,
  RebalanceInputs,
  RegimeGenInputs,
  RegimeSwrInputs,
  RiskProfileScoreInputs,
  RiskMetricsInputs,
  RmdInputs,
  RothInputs,
  RothIrmaaInputs,
  SocialSecurityInputs,
  SorInputs,
  TaxWithdrawalInputs,
} from "../store/scenario";

const SPENDING_VOLATILITY = new Set(["low", "medium", "high"]);
const INCOME_STREAM_KINDS = new Set(["pension", "annuity"]);
const HISTORICAL_BLEND_REBALANCE_FREQUENCIES = new Set([
  "monthly",
  "annual",
  "none",
]);
const ROADMAP_INPUT_KINDS = new Set([
  "snapshot",
  "trajectory",
  "goals",
  "income",
  "guardrails",
  "historical_blend",
  "priority_actions",
]);
const ROADMAP_REQUIRED_BY_SCOPE = {
  focused: ["snapshot", "trajectory", "goals"],
  full: [
    "snapshot",
    "trajectory",
    "goals",
    "income",
    "guardrails",
    "historical_blend",
  ],
} as const;
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

function isSubjectRefToken(v: string): boolean {
  return /^[A-Za-z0-9._:-]{1,80}$/.test(v);
}

function requireNoRawCashflowFields(value: unknown, issues: string[]): void {
  if (hasRawCashflowField(value)) {
    issues.push(
      "Cash-flow bridge inputs must not include raw transaction fields.",
    );
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
    (!Number.isFinite(r.secondaryTargetMonths) || r.secondaryTargetMonths <= 0)
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

  if (
    !Number.isInteger(b.daysInMonth) ||
    b.daysInMonth < 28 ||
    b.daysInMonth > 31
  ) {
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

function validatePerformanceReturnSeries(
  label: string,
  text: string,
  issues: string[],
): number[] | null {
  const parsed = parseReturns(text);
  if (parsed === null) {
    issues.push(`${label} must be a list of numbers.`);
    return null;
  }
  if (parsed.some((value) => value <= -1)) {
    issues.push(`${label} values must be greater than -1.`);
  }
  return parsed;
}

function performanceSignChanges(
  flows: { tYears: number; amount: number }[],
  terminalValue: number,
  terminalTimeYears: number,
): number {
  const signs = [
    ...flows.map((flow) => ({ tYears: flow.tYears, amount: flow.amount })),
    { tYears: terminalTimeYears, amount: terminalValue },
  ]
    .sort((a, b) => a.tYears - b.tYears)
    .map((event) => (event.amount > 0 ? 1 : event.amount < 0 ? -1 : 0))
    .filter((sign) => sign !== 0);
  return signs.reduce((changes, sign, index) => {
    if (index === 0) return changes;
    return changes + (signs[index - 1] !== sign ? 1 : 0);
  }, 0);
}

/** Reasons a performance-analysis request cannot be dispatched. */
export function validatePerformanceAnalysis(
  p: PerformanceAnalysisInputs,
): string[] {
  const issues: string[] = [];
  if (!Number.isInteger(p.periodsPerYear) || p.periodsPerYear < 1) {
    issues.push("Periods per year must be a whole number, one or more.");
  }

  const hasTwr = p.twrPeriods.length > 0;
  const hasMwr = p.mwrFlows.length > 0;
  const hasFee =
    p.grossReturnsText.trim().length > 0 || p.feeRatesText.trim().length > 0;
  const hasBenchmark =
    p.portfolioReturnsText.trim().length > 0 ||
    p.benchmarkReturnsText.trim().length > 0;
  if (!hasTwr && !hasMwr && !hasFee && !hasBenchmark) {
    issues.push("Enable at least one performance analysis section.");
  }

  for (const [index, period] of p.twrPeriods.entries()) {
    const label = `TWR period ${index + 1}`;
    if (
      !Number.isFinite(period.startValue) ||
      !Number.isFinite(period.endValue) ||
      !Number.isFinite(period.netExternalFlow)
    ) {
      issues.push(`${label} values must be finite numbers.`);
      continue;
    }
    if (period.startValue < 0 || period.endValue < 0) {
      issues.push(`${label} start and end values cannot be negative.`);
    }
    if (
      p.flowTiming === "start" &&
      period.startValue + period.netExternalFlow <= 0
    ) {
      issues.push(`${label} start value plus flow must be greater than zero.`);
    }
    if (p.flowTiming === "end" && period.startValue <= 0) {
      issues.push(`${label} start value must be greater than zero.`);
    }
    if (
      p.flowTiming === "end" &&
      period.endValue - period.netExternalFlow < 0
    ) {
      issues.push(`${label} end value minus flow cannot be negative.`);
    }
  }

  for (const [index, flow] of p.mwrFlows.entries()) {
    const label = `MWR flow ${index + 1}`;
    if (!Number.isFinite(flow.tYears) || !Number.isFinite(flow.amount)) {
      issues.push(`${label} values must be finite numbers.`);
      continue;
    }
    if (flow.tYears < 0) {
      issues.push(`${label} time cannot be negative.`);
    }
  }
  if (hasMwr) {
    if (!Number.isFinite(p.terminalValue) || p.terminalValue < 0) {
      issues.push("Terminal value must be a finite number, zero or more.");
    }
    if (!Number.isFinite(p.terminalTimeYears) || p.terminalTimeYears <= 0) {
      issues.push("Terminal time must be a finite number greater than zero.");
    }
    if (
      Number.isFinite(p.terminalTimeYears) &&
      p.mwrFlows.some((flow) => flow.tYears > p.terminalTimeYears)
    ) {
      issues.push("Terminal time must be at or after every MWR flow time.");
    }
    if (!p.mwrFlows.some((flow) => flow.amount < 0)) {
      issues.push("MWR needs at least one negative contribution flow.");
    }
    if (p.terminalValue <= 0 && !p.mwrFlows.some((flow) => flow.amount > 0)) {
      issues.push("MWR needs a positive terminal value or withdrawal flow.");
    }
    if (
      Number.isFinite(p.terminalValue) &&
      Number.isFinite(p.terminalTimeYears) &&
      p.mwrFlows.every(
        (flow) => Number.isFinite(flow.tYears) && Number.isFinite(flow.amount),
      ) &&
      performanceSignChanges(p.mwrFlows, p.terminalValue, p.terminalTimeYears) >
        1
    ) {
      issues.push("MWR cash-flow signs allow multiple possible IRR roots.");
    }
  }

  if (hasFee) {
    if (
      p.grossReturnsText.trim().length === 0 ||
      p.feeRatesText.trim().length === 0
    ) {
      issues.push("Gross returns and fee rates must be supplied together.");
    } else {
      const gross = validatePerformanceReturnSeries(
        "Gross returns",
        p.grossReturnsText,
        issues,
      );
      const fees = parseReturns(p.feeRatesText);
      if (fees === null) {
        issues.push("Fee rates must be a list of numbers.");
      } else if (fees.some((fee) => fee < 0 || fee >= 1)) {
        issues.push(
          "Fee rates must be greater than or equal to 0 and below 1.",
        );
      }
      if (gross && fees && gross.length !== fees.length) {
        issues.push("Gross returns and fee rates must have the same length.");
      }
    }
  }

  if (hasBenchmark) {
    if (
      p.portfolioReturnsText.trim().length === 0 ||
      p.benchmarkReturnsText.trim().length === 0
    ) {
      issues.push("Portfolio and benchmark returns must be supplied together.");
    } else {
      const portfolio = validatePerformanceReturnSeries(
        "Portfolio returns",
        p.portfolioReturnsText,
        issues,
      );
      const benchmark = validatePerformanceReturnSeries(
        "Benchmark returns",
        p.benchmarkReturnsText,
        issues,
      );
      if (portfolio && benchmark && portfolio.length !== benchmark.length) {
        issues.push(
          "Portfolio and benchmark returns must have the same length.",
        );
      }
    }
  }

  return issues;
}

function validateIncomeLayeringSocialSecurity(
  label: string,
  piaMonthly: number,
  claimAge: number,
  fraAge: number,
  colaRate: number,
  issues: string[],
): void {
  if (piaMonthly < 0) {
    issues.push(`${label} Social Security PIA cannot be negative.`);
    return;
  }
  if (piaMonthly === 0) return;
  if (!Number.isInteger(claimAge) || claimAge < 62 || claimAge > 70) {
    issues.push(`${label} claim age must be a whole number from 62 to 70.`);
  }
  if (!Number.isInteger(fraAge) || fraAge <= 62 || fraAge > 70) {
    issues.push(`${label} FRA must be a whole number in (62, 70].`);
  }
  if (colaRate <= -1) {
    issues.push(`${label} Social Security COLA must be greater than -1.`);
  }
}

/** Reasons an income-layering request cannot be dispatched. */
export function validateIncomeLayering(
  i: IncomeLayeringInputs,
  accounts: Account[],
): string[] {
  const issues: string[] = [];
  if (accounts.length === 0) {
    issues.push(
      "Add accounts in the Monte Carlo tab to model withdrawal gaps.",
    );
  } else if (accounts.some((account) => account.balance < 0)) {
    issues.push("Shared account balances cannot be negative.");
  }
  if (!Number.isInteger(i.currentAge) || i.currentAge < 0) {
    issues.push("Current age must be a whole number, zero or more.");
  }
  if (
    !Number.isInteger(i.retirementAge) ||
    i.retirementAge < i.currentAge ||
    i.retirementAge > i.terminalAge
  ) {
    issues.push("Retirement age must fall between current and terminal age.");
  }
  if (!Number.isInteger(i.terminalAge) || i.terminalAge <= i.currentAge) {
    issues.push("Terminal age must be beyond current age.");
  }
  if (i.spendingTarget <= 0) {
    issues.push("Spending target must be greater than zero.");
  }
  if (i.earnedIncome < 0) {
    issues.push("Earned income cannot be negative.");
  }
  if (i.wageGrowthRate <= -1) {
    issues.push("Wage growth must be greater than -1.");
  }
  if (i.spendingInflationRate <= -1) {
    issues.push("Spending inflation must be greater than -1.");
  }
  if (i.expectedReturn <= -1) {
    issues.push("Expected return must be greater than -1.");
  }
  if (i.bracketFillTargetRate < 0 || i.bracketFillTargetRate >= 1) {
    issues.push("Bracket-fill target rate must be 0 or between 0 and 1.");
  }
  if (!Number.isInteger(i.taxYear) || i.taxYear < 2000 || i.taxYear > 2100) {
    issues.push("Tax year must be a plausible year.");
  }
  if (!Number.isInteger(i.baseYear) || i.baseYear < 2000 || i.baseYear > 2100) {
    issues.push("Base year must be a plausible year.");
  }
  if (
    i.birthYear !== 0 &&
    (!Number.isInteger(i.birthYear) ||
      i.birthYear < 1900 ||
      i.birthYear > i.taxYear)
  ) {
    issues.push("Birth year must be 0 or a plausible year at/before tax year.");
  }
  if (
    i.birthYear !== 0 &&
    Math.abs(i.birthYear - (i.baseYear - i.currentAge)) > 1
  ) {
    issues.push(
      "Birth year should match base year minus current age, within one year.",
    );
  }
  const state = i.stateCode.trim();
  if (state.length > 0 && !/^[A-Za-z]{2}$/.test(state)) {
    issues.push("State code must be blank or two letters.");
  }
  if (i.spousePiaMonthly > 0 && i.primaryPiaMonthly <= 0) {
    issues.push("Spouse Social Security requires primary Social Security.");
  }
  if (i.survivorYear > 0 && i.spousePiaMonthly <= 0) {
    issues.push("Survivor year requires spouse Social Security.");
  }
  validateIncomeLayeringSocialSecurity(
    "Primary",
    i.primaryPiaMonthly,
    i.primaryClaimAge,
    i.primaryFraAge,
    i.primaryColaRate,
    issues,
  );
  validateIncomeLayeringSocialSecurity(
    "Spouse",
    i.spousePiaMonthly,
    i.spouseClaimAge,
    i.spouseFraAge,
    i.spouseColaRate,
    issues,
  );
  if (i.incomeStreams.length > 8) {
    issues.push("Income layering supports at most 8 pension/annuity rows.");
  }
  i.incomeStreams.forEach((stream, index) => {
    const label = `Income stream ${index + 1}`;
    if (!INCOME_STREAM_KINDS.has(stream.kind)) {
      issues.push(`${label} must be pension or annuity.`);
    }
    if (stream.annualAmount <= 0) {
      issues.push(`${label} annual amount must be greater than zero.`);
    }
    if (
      !Number.isInteger(stream.startAge) ||
      stream.startAge < i.currentAge ||
      stream.startAge > i.terminalAge
    ) {
      issues.push(`${label} start age must fall within the projection.`);
    }
    if (
      stream.endAge !== 0 &&
      (!Number.isInteger(stream.endAge) ||
        stream.endAge < stream.startAge ||
        stream.endAge > i.terminalAge)
    ) {
      issues.push(`${label} end age must be 0 or within the projection.`);
    }
    if (stream.colaRate <= -1) {
      issues.push(`${label} COLA must be greater than -1.`);
    }
  });
  if (
    i.survivorYear !== 0 &&
    (!Number.isInteger(i.survivorYear) ||
      i.survivorYear < i.baseYear ||
      i.survivorYear > i.baseYear + (i.terminalAge - i.currentAge))
  ) {
    issues.push("Survivor year must be 0 or within the projection years.");
  }
  return issues;
}

/** Reasons a historical-blend request cannot be dispatched. */
export function validateHistoricalBlend(h: HistoricalBlendInputs): string[] {
  const issues: string[] = [];
  const ids = parseIdList(h.assetClassIdsText);
  const weightIds = Object.keys(h.weights).filter((id) => id.trim().length > 0);
  const activeIds = ids.length > 0 ? ids : weightIds;
  if (activeIds.length < 2) {
    issues.push("Enter at least two asset-class ids.");
  }
  if (new Set(activeIds).size !== activeIds.length) {
    issues.push("Asset-class ids must be distinct.");
  }
  if (
    !Number.isInteger(h.lookbackDays) ||
    h.lookbackDays < 30 ||
    h.lookbackDays > 3_650
  ) {
    issues.push("Lookback days must be a whole number in [30, 3650].");
  }
  if (h.asOf.trim().length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(h.asOf.trim())) {
    issues.push("As-of date must be blank or YYYY-MM-DD.");
  }
  if (!HISTORICAL_BLEND_REBALANCE_FREQUENCIES.has(h.rebalanceFrequency)) {
    issues.push("Rebalance frequency must be monthly, annual, or none.");
  }
  if (!Number.isFinite(h.initialValue) || h.initialValue <= 0) {
    issues.push("Initial value must be greater than zero.");
  }
  let weightSum = 0;
  for (const id of activeIds) {
    const weight = h.weights[id] ?? 0;
    if (!Number.isFinite(weight) || weight < 0) {
      issues.push("Weights cannot be negative.");
      break;
    }
    weightSum += weight;
  }
  if (Math.abs(weightSum - 1) > 1e-6) {
    issues.push("Weights must sum to 1 across the selected asset classes.");
  }
  return issues;
}

/** Validate fixed-answer risk questionnaire inputs. No free text accepted. */
export function validateRiskProfileScore(r: RiskProfileScoreInputs): string[] {
  const issues: string[] = [];
  const seen = new Set(Object.keys(r.answers));
  const unknown = [...seen].filter(
    (questionId) => !RISK_PROFILE_QUESTION_IDS.includes(questionId),
  );
  if (unknown.length > 0) {
    issues.push(`Unknown risk-profile question id(s): ${unknown.join(", ")}.`);
  }
  const missing = RISK_PROFILE_QUESTION_IDS.filter(
    (questionId) => !seen.has(questionId),
  );
  if (missing.length > 0) {
    issues.push(
      `Answer every risk-profile question: ${missing.join(", ")} missing.`,
    );
  }
  for (const questionId of RISK_PROFILE_QUESTION_IDS) {
    const answerId = r.answers[questionId];
    if (answerId === undefined) continue;
    const allowed = answerIdsForQuestion(questionId);
    if (!allowed.includes(answerId)) {
      issues.push(
        `Risk-profile answer for ${questionId} must be one of: ${allowed.join(", ")}.`,
      );
    }
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
  if (r.preset !== "custom" && r.preset !== "wealth_roadmap") {
    issues.push("Choose a supported report type.");
  }
  if (r.scope !== "focused" && r.scope !== "full") {
    issues.push("Choose a supported Wealth Roadmap scope.");
  }
  if (r.preset === "wealth_roadmap") {
    if (r.assumptionVersion.trim().length === 0) {
      issues.push("Wealth Roadmap needs an assumption version.");
    }
    if (r.cmaVersion.trim().length === 0) {
      issues.push("Wealth Roadmap needs a CMA version.");
    }
    if (!Number.isInteger(r.taxYear) || r.taxYear < 2000 || r.taxYear > 2100) {
      issues.push("Wealth Roadmap tax year must be a plausible year.");
    }
    if (!Number.isSafeInteger(r.seed) || r.seed < 0) {
      issues.push("Wealth Roadmap seed must be a non-negative integer.");
    }
    const seen = new Set<string>();
    for (const section of r.sections) {
      const kind = section.kind.trim();
      if (kind.length === 0) continue;
      if (!ROADMAP_INPUT_KINDS.has(kind)) {
        issues.push(
          "Wealth Roadmap sections must use snapshot, trajectory, goals, income, guardrails, historical_blend, or priority_actions.",
        );
      } else if (seen.has(kind)) {
        issues.push(`Wealth Roadmap accepts at most one ${kind} section.`);
      }
      seen.add(kind);
      if (kind === "priority_actions" && r.scope !== "full") {
        issues.push("Priority actions are only accepted for full scope.");
      }
    }
    const required =
      r.scope === "focused" || r.scope === "full"
        ? ROADMAP_REQUIRED_BY_SCOPE[r.scope]
        : [];
    const missing = required.filter((kind) => !seen.has(kind));
    if (missing.length > 0) {
      issues.push(
        `Wealth Roadmap ${r.scope} scope missing required sections: ${missing.join(", ")}.`,
      );
    }
  }
  if (r.sections.length === 0) {
    issues.push("Add at least one section.");
    return issues;
  }
  if (r.sections.some((s) => s.kind.trim().length === 0)) {
    issues.push("Every section needs a kind.");
  }
  return issues;
}

/** Validate education-funding tool inputs. Structural only; engine does math. */
export function validateEducationFunding(e: EducationFundingInputs): string[] {
  const issues: string[] = [];
  if (!Number.isInteger(e.taxYear) || e.taxYear < 2000 || e.taxYear > 2100) {
    issues.push("Tax year must be a plausible year.");
  }
  if (e.selectedVehicle.trim().length === 0) {
    issues.push("Select an education vehicle.");
  }
  if (e.tuitionInflation <= -1) {
    issues.push("Tuition inflation must be greater than -1.");
  }
  if (e.afterTaxReturn <= -1) {
    issues.push("After-tax return must be greater than -1.");
  }
  if (e.students.length === 0) {
    issues.push("Add at least one student row.");
  }
  if (e.students.length > 12) {
    issues.push("Education funding supports at most 12 student rows.");
  }
  const subjectRefs = new Set<string>();
  for (const [i, s] of e.students.entries()) {
    const row = i + 1;
    if (!isSubjectRefToken(s.subjectRef)) {
      issues.push(
        `Student ${row} subject ref must be an opaque token of letters, digits, '.', '_', ':', or '-'.`,
      );
    } else if (subjectRefs.has(s.subjectRef)) {
      issues.push(`Student ${row} subject ref must be unique.`);
    } else {
      subjectRefs.add(s.subjectRef);
    }
    if (!isNonNegative(s.annualCost)) {
      issues.push(`Student ${row} annual cost cannot be negative.`);
    }
    if (!Number.isInteger(s.yearsUntilStart) || s.yearsUntilStart < 0) {
      issues.push(`Student ${row} years until start must be a whole number.`);
    }
    if (
      !Number.isInteger(s.fundingYears) ||
      s.fundingYears < 1 ||
      s.fundingYears > 8
    ) {
      issues.push(
        `Student ${row} funding years must be a whole number in [1, 8].`,
      );
    }
    if (s.currentSavings !== undefined && !isNonNegative(s.currentSavings)) {
      issues.push(`Student ${row} current savings cannot be negative.`);
    }
    if (
      s.monthlyContribution !== undefined &&
      !isNonNegative(s.monthlyContribution)
    ) {
      issues.push(`Student ${row} monthly contribution cannot be negative.`);
    }
  }
  return issues;
}
