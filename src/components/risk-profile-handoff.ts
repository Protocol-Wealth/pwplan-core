// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import type { RiskProfile } from "../contract/planning";
import type { OptimizeAllocationInputs } from "../store/scenario";

export function optimizerPatchFromRiskProfile(
  profile: RiskProfile,
): Pick<OptimizeAllocationInputs, "riskProfile" | "objective"> {
  return { riskProfile: profile, objective: "" };
}
