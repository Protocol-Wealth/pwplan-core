// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * ScenarioIO — save / load / preset controls for the current plan inputs.
 *
 * Save downloads the current inputs as a PII-free JSON file (via a Blob object
 * URL — no browser storage, per CLAUDE.md). Load reads a file back through the
 * versioned, fail-closed parser and replaces the store's inputs. Presets load a
 * built-in case-study scenario. All three funnel through the store's
 * loadSnapshot so results/errors are cleared consistently.
 */

import { useRef, useState, type ChangeEvent } from "react";
import { useScenario } from "../store/scenario";
import {
  parseScenarioJSON,
  toScenarioJSON,
  type ScenarioSnapshot,
} from "./scenario-io";
import { SCENARIO_PRESETS, findPreset } from "./scenario-presets";

function snapshotFilename(tool: ScenarioSnapshot["tool"]): string {
  // Timestamped so saving several case-study variations does not overwrite.
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `pwplan-scenario-${tool}-${stamp}.json`;
}

export function ScenarioIO() {
  const {
    tool,
    inputs,
    glidePathInputs,
    taxInputs,
    rothInputs,
    rothIrmaaInputs,
    sorInputs,
    rmdInputs,
    bracketInputs,
    socialSecurityInputs,
    regimeSwrInputs,
    correlationInputs,
    regimeGenInputs,
    fireInputs,
    riskMetricsInputs,
    rebalanceInputs,
    optimizeAllocationInputs,
    buildReportInputs,
    cashflowPlanningBridgeInputs,
    cashReserveAnalysisInputs,
    budgetPacingProjectionInputs,
    loadSnapshot,
    setError,
  } = useScenario();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function currentSnapshot(): ScenarioSnapshot {
    return {
      tool,
      inputs,
      glidePathInputs,
      taxInputs,
      rothInputs,
      rothIrmaaInputs,
      sorInputs,
      rmdInputs,
      bracketInputs,
      socialSecurityInputs,
      regimeSwrInputs,
      correlationInputs,
      regimeGenInputs,
      fireInputs,
      riskMetricsInputs,
      rebalanceInputs,
      optimizeAllocationInputs,
      buildReportInputs,
      cashflowPlanningBridgeInputs,
      cashReserveAnalysisInputs,
      budgetPacingProjectionInputs,
    };
  }

  function save() {
    setNotice(null);
    try {
      const json = toScenarioJSON(currentSnapshot());
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = snapshotFilename(tool);
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Scenario downloaded.");
    } catch (e) {
      // serializeScenario throws only if a PII-shaped key is present.
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    setNotice(null);
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file fires change again.
    e.target.value = "";
    if (!file) return;

    const text = await file.text();
    const result = parseScenarioJSON(text);
    if (!result.ok) {
      setError(`Could not load scenario: ${result.error}`);
      return;
    }
    loadSnapshot(result.value);
    setError(null);
    setNotice(`Loaded scenario "${file.name}".`);
  }

  function loadPreset(id: string) {
    setNotice(null);
    const preset = findPreset(id);
    if (!preset) return;
    loadSnapshot(preset.snapshot);
    setError(null);
    setNotice(`Loaded preset "${preset.label}".`);
  }

  return (
    <section
      aria-label="Save, load, and preset scenarios"
      className="mb-8 space-y-3 border border-stone-200 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          className="border border-stone-900 bg-white px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-stone-800 transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900"
        >
          Save scenario
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="border border-stone-900 bg-white px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-stone-800 transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900"
        >
          Load scenario
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          className="sr-only"
          aria-label="Choose a scenario JSON file to load"
        />

        <label className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
            Preset
          </span>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) loadPreset(e.target.value);
              e.target.value = "";
            }}
            className="border border-stone-300 bg-white px-2 py-1 font-mono text-[0.65rem] text-stone-800 focus:border-stone-900 focus:outline-none"
          >
            <option value="" disabled>
              Load a case study…
            </option>
            {SCENARIO_PRESETS.map((p) => (
              <option key={p.id} value={p.id} title={p.description}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice && (
        <p role="status" className="font-mono text-[0.6rem] text-stone-500">
          {notice}
        </p>
      )}

      <p className="font-mono text-[0.55rem] leading-relaxed text-stone-500">
        Scenarios save de-identified planning inputs only (ages, balances,
        allocations) — never names, dates of birth, or any identifying detail.
      </p>
    </section>
  );
}
