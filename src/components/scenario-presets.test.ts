// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, it, expect } from "vitest";
import { SCENARIO_PRESETS, findPreset } from "./scenario-presets";
import { validateScenario } from "./scenario-validation";
import {
  validateBudgetPacingProjection,
  validateCashReserveAnalysis,
  validateCashflowPlanningBridge,
  validateEducationFunding,
  validateGlidePath,
  validateIncomeLayering,
  validateRiskProfileScore,
  validateTaxWithdrawal,
} from "./tool-validation";
import { parseScenario, serializeScenario } from "./scenario-io";

describe("scenario presets", () => {
  it("ships at least the three documented case studies", () => {
    const ids = SCENARIO_PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["accumulator", "near-retiree", "crisis-stress"]),
    );
  });

  it("has unique ids", () => {
    const ids = SCENARIO_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findPreset resolves a known id and returns undefined otherwise", () => {
    expect(findPreset("accumulator")?.label).toMatch(/Accumulator/);
    expect(findPreset("nope")).toBeUndefined();
  });

  // Every preset must be immediately runnable: the same request-shape
  // validators the forms use should report zero issues.
  for (const preset of SCENARIO_PRESETS) {
    describe(`preset "${preset.id}"`, () => {
      it("passes scenario (Monte Carlo) validation", () => {
        expect(validateScenario(preset.snapshot.inputs)).toEqual([]);
      });

      it("passes glide-path validation", () => {
        expect(validateGlidePath(preset.snapshot.glidePathInputs)).toEqual([]);
      });

      it("passes tax-withdrawal validation against its own portfolio", () => {
        expect(
          validateTaxWithdrawal(
            preset.snapshot.taxInputs,
            preset.snapshot.inputs.accounts,
          ),
        ).toEqual([]);
      });

      it("passes cash-flow bridge validation", () => {
        expect(
          validateCashflowPlanningBridge(
            preset.snapshot.cashflowPlanningBridgeInputs,
          ),
        ).toEqual([]);
        expect(
          validateCashReserveAnalysis(
            preset.snapshot.cashReserveAnalysisInputs,
          ),
        ).toEqual([]);
        expect(
          validateBudgetPacingProjection(
            preset.snapshot.budgetPacingProjectionInputs,
          ),
        ).toEqual([]);
      });

      it("passes education-funding validation", () => {
        expect(
          validateEducationFunding(preset.snapshot.educationFundingInputs),
        ).toEqual([]);
      });

      it("passes risk-profile validation", () => {
        expect(
          validateRiskProfileScore(preset.snapshot.riskProfileScoreInputs),
        ).toEqual([]);
      });

      it("passes income-layering validation", () => {
        expect(
          validateIncomeLayering(
            preset.snapshot.incomeLayeringInputs,
            preset.snapshot.inputs.accounts,
          ),
        ).toEqual([]);
      });

      it("is PII-free and round-trips through serialize/parse", () => {
        // serializeScenario throws if any identity-shaped key is present.
        expect(() => serializeScenario(preset.snapshot)).not.toThrow();
        const result = parseScenario(serializeScenario(preset.snapshot));
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual(preset.snapshot);
      });
    });
  }
});
