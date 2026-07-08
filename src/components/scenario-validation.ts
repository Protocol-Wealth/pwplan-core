// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * scenario-validation — pure, UI-side validation for scenario inputs.
 *
 * This is FORM-INPUT validation only: it answers "is this a well-formed
 * MonteCarloRequest?" before the gateway dispatches it. It is NOT quant logic —
 * all planning math (Monte Carlo, tax, correlation, glide-path) stays in
 * nexus-core. The single domain rule encoded here, "an account's allocation
 * weights sum to 1", is a request-shape constraint, not a financial model.
 */

import type {
  Account,
  AssetClass,
  MonteCarloGoalInput,
  MonteCarloGuardrailsInput,
} from "../contract/planning";

/** Allocation weights are decimals; tolerate float drift from summed inputs. */
export const ALLOCATION_TOLERANCE = 1e-6;

/** Sum of an account's allocation weights across asset classes. */
export function allocationSum(account: Account): number {
  return Object.values(account.allocation).reduce((a, w) => a + (w || 0), 0);
}

/** True when the account's weights sum to 1 (within float tolerance). */
export function isAllocationBalanced(account: Account): boolean {
  return Math.abs(allocationSum(account) - 1) <= ALLOCATION_TOLERANCE;
}

/** Asset-class ids that appear more than once (ids key allocations + λ). */
export function duplicateAssetClassIds(assetClasses: AssetClass[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const ac of assetClasses) {
    const id = ac.id.trim();
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  }
  return [...dups];
}

export interface ScenarioToValidate {
  accounts: Account[];
  assetClasses: AssetClass[];
  goals?: MonteCarloGoalInput[];
  guardrails?: MonteCarloGuardrailsInput | null;
  annualSpend?: number;
  spendColaRate?: number;
  /** Plan lifecycle ages. Optional here so allocation-only callers/tests need
   *  not supply them; when present, age ordering is checked. */
  currentAge?: number;
  retirementAge?: number;
  horizonAge?: number;
}

/**
 * Reasons the scenario cannot be dispatched, in display order. Empty array
 * means the scenario is runnable.
 */
export function validateScenario(s: ScenarioToValidate): string[] {
  const issues: string[] = [];

  // Age ordering (currentAge ≤ retirementAge < horizonAge), matching the
  // glide-path tool's rules and messages. Skipped when ages are absent. This is
  // request-shape ordering, not a financial model — the engine owns the math.
  const { currentAge, retirementAge, horizonAge } = s;
  if (
    typeof retirementAge === "number" &&
    typeof currentAge === "number" &&
    retirementAge < currentAge
  ) {
    issues.push("Retirement age must not be below current age.");
  }
  if (
    typeof horizonAge === "number" &&
    typeof retirementAge === "number" &&
    horizonAge <= retirementAge
  ) {
    issues.push("Horizon age must be beyond retirement age.");
  }

  if (s.assetClasses.length === 0) {
    issues.push("Add at least one asset class.");
  }
  if (s.assetClasses.some((ac) => ac.id.trim() === "")) {
    issues.push("Every asset class needs an id.");
  }
  const dups = duplicateAssetClassIds(s.assetClasses);
  if (dups.length > 0) {
    issues.push(`Duplicate asset-class id: ${dups.join(", ")}.`);
  }

  if (s.accounts.length === 0) {
    issues.push("Add at least one account.");
  }

  const knownIds = new Set(
    s.assetClasses.map((ac) => ac.id.trim()).filter((id) => id !== ""),
  );
  s.accounts.forEach((account, i) => {
    if (!isAllocationBalanced(account)) {
      issues.push(
        `Account ${i + 1} (${account.type}) allocation is ` +
          `${(allocationSum(account) * 100).toFixed(1)}%, must total 100%.`,
      );
    }
    for (const [id, weight] of Object.entries(account.allocation)) {
      if (weight !== 0 && !knownIds.has(id)) {
        issues.push(
          `Account ${i + 1} allocates to unknown asset class "${id}".`,
        );
      }
    }
  });

  const goals = s.goals ?? [];
  if (goals.length > 100) {
    issues.push("Monte Carlo supports at most 100 path-funded goals.");
  }
  const seenGoalIds = new Set<string>();
  const horizonYears =
    typeof s.currentAge === "number" && typeof s.horizonAge === "number"
      ? s.horizonAge - s.currentAge
      : null;
  goals.forEach((goal, i) => {
    if (
      !/^[A-Za-z0-9._:-]{1,80}$/.test(goal.id) ||
      !/[0-9._:-]/.test(goal.id)
    ) {
      issues.push(`Goal ${i + 1} needs an opaque id token.`);
    }
    if (seenGoalIds.has(goal.id)) {
      issues.push(`Duplicate goal id: ${goal.id}.`);
    }
    seenGoalIds.add(goal.id);
    if (!Number.isFinite(goal.targetAmount) || goal.targetAmount < 0) {
      issues.push(`Goal ${i + 1} target amount must be non-negative.`);
    }
    if (!Number.isInteger(goal.yearsToGoal) || goal.yearsToGoal < 0) {
      issues.push(
        `Goal ${i + 1} years-to-goal must be a non-negative integer.`,
      );
    }
    const fundingYears = goal.fundingYears ?? 1;
    if (
      !Number.isInteger(fundingYears) ||
      fundingYears < 1 ||
      fundingYears > 40
    ) {
      issues.push(`Goal ${i + 1} funding years must be an integer in [1, 40].`);
    }
    if (
      horizonYears !== null &&
      (goal.yearsToGoal >= horizonYears ||
        goal.yearsToGoal + fundingYears > horizonYears)
    ) {
      issues.push(`Goal ${i + 1} must fit inside the Monte Carlo horizon.`);
    }
    if (
      goal.inflationRate !== undefined &&
      (!Number.isFinite(goal.inflationRate) || goal.inflationRate <= -1)
    ) {
      issues.push(`Goal ${i + 1} inflation rate must be greater than -100%.`);
    }
    if (
      goal.priority !== undefined &&
      (!Number.isInteger(goal.priority) ||
        goal.priority < 1 ||
        goal.priority > 100)
    ) {
      issues.push(`Goal ${i + 1} priority must be an integer in [1, 100].`);
    }
  });

  const guardrails = s.guardrails;
  if (guardrails) {
    if (guardrails.rule !== undefined && guardrails.rule !== "guyton_klinger") {
      issues.push("Guardrails rule must be Guyton-Klinger.");
    }
    if (
      guardrails.band !== undefined &&
      !(guardrails.band > 0 && guardrails.band < 1)
    ) {
      issues.push("Guardrail band must be between 0% and 100%.");
    }
    if (
      guardrails.raise !== undefined &&
      !(guardrails.raise >= 0 && guardrails.raise < 1)
    ) {
      issues.push("Guardrail raise must be between 0% and 100%.");
    }
    if (
      guardrails.cut !== undefined &&
      !(guardrails.cut >= 0 && guardrails.cut < 1)
    ) {
      issues.push("Guardrail cut must be between 0% and 100%.");
    }
    if (
      guardrails.inflation !== undefined &&
      (!Number.isFinite(guardrails.inflation) || guardrails.inflation < 0)
    ) {
      issues.push("Guardrail inflation must be non-negative.");
    }
    if (
      guardrails.preservationFinalYears !== undefined &&
      (!Number.isInteger(guardrails.preservationFinalYears) ||
        guardrails.preservationFinalYears < 0)
    ) {
      issues.push(
        "Guardrail preservation years must be a non-negative integer.",
      );
    }
  }

  return issues;
}
