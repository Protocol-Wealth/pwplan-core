/**
 * scenario-validation — pure, UI-side validation for scenario inputs.
 *
 * This is FORM-INPUT validation only: it answers "is this a well-formed
 * MonteCarloRequest?" before the gateway dispatches it. It is NOT quant logic —
 * all planning math (Monte Carlo, tax, correlation, glide-path) stays in
 * nexus-core. The single domain rule encoded here, "an account's allocation
 * weights sum to 1", is a request-shape constraint, not a financial model.
 */

import type { Account, AssetClass } from "../contract/planning";

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
}

/**
 * Reasons the scenario cannot be dispatched, in display order. Empty array
 * means the scenario is runnable.
 */
export function validateScenario(s: ScenarioToValidate): string[] {
  const issues: string[] = [];

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

  return issues;
}
