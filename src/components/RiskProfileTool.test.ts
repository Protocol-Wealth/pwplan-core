// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import { optimizerPatchFromRiskProfile } from "./risk-profile-handoff";

describe("optimizerPatchFromRiskProfile", () => {
  it("clears stale explicit optimizer objectives so the scored profile drives optimization", () => {
    expect(optimizerPatchFromRiskProfile("moderate_aggressive")).toEqual({
      riskProfile: "moderate_aggressive",
      objective: "",
    });
  });
});
