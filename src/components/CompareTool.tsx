// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useState } from "react";
import { planning } from "../lib/planning-gateway";
import {
  useScenario,
  type CompareRunResult,
  type ScenarioSnapshot,
} from "../store/scenario";
import { seriesGeometry } from "./results-viz";
import { validateScenario } from "./scenario-validation";
import {
  buildCompareRows,
  checkCompareInputs,
  checkCompareResults,
  scenarioCmaReference,
  type CompareRow,
} from "./scenario-compare";
import {
  Empty,
  Field,
  IssueList,
  NumberInput,
  RunButton,
  TextInput,
} from "./form-controls";
import { usd, usdCompact, pct } from "./format";

const SERIES_COLORS = ["#1c1917", "#0369a1", "#b45309"] as const;

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatCmaRef(ref: string): string {
  if (ref === "engine-default-cma") return "Engine default CMA";
  return ref.replace("cma-as-of:", "Live CMA as of ");
}

function signedPctPoints(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)} pts`;
}

function signedUsd(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${usd(value)}`;
}

export function CompareTool() {
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
    riskProfileScoreInputs,
    rebalanceInputs,
    optimizeAllocationInputs,
    buildReportInputs,
    educationFundingInputs,
    cashflowPlanningBridgeInputs,
    cashReserveAnalysisInputs,
    budgetPacingProjectionInputs,
    assumptions,
    compareScenarios,
    compareSeed,
    compareResults,
    running,
    error,
    setCompareScenarios,
    setCompareSeed,
    setCompareResults,
    setRunning,
    setError,
    setAssumptions,
    loadSnapshot,
  } = useScenario();
  const [label, setLabel] = useState("Base scenario");

  function currentSnapshot(): ScenarioSnapshot {
    return {
      tool: tool === "compare" ? "monte_carlo" : tool,
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
      riskProfileScoreInputs,
      rebalanceInputs,
      optimizeAllocationInputs,
      buildReportInputs,
      educationFundingInputs,
      cashflowPlanningBridgeInputs,
      cashReserveAnalysisInputs,
      budgetPacingProjectionInputs,
    };
  }

  function addCurrentScenario() {
    if (compareScenarios.length >= 3) {
      setError("Scenario Compare supports up to 3 scenarios.");
      return;
    }
    const trimmed = label.trim();
    const fallback = `Scenario ${compareScenarios.length + 1}`;
    const next = {
      id: makeId(),
      label: trimmed || fallback,
      snapshot: currentSnapshot(),
      assumptions,
    };
    setCompareScenarios([...compareScenarios, next]);
    setCompareResults(null);
    setError(null);
    setLabel(`Scenario ${compareScenarios.length + 2}`);
  }

  function removeScenario(id: string) {
    setCompareScenarios(
      compareScenarios.filter((scenario) => scenario.id !== id),
    );
    setCompareResults(null);
  }

  function loadQueuedScenario(scenario: (typeof compareScenarios)[number]) {
    loadSnapshot(scenario.snapshot);
    setAssumptions(scenario.assumptions);
  }

  const preflight = checkCompareInputs(compareScenarios, compareSeed);
  const validationIssues = compareScenarios.flatMap((scenario) =>
    validateScenario(scenario.snapshot.inputs).map(
      (issue) => `${scenario.label}: ${issue}`,
    ),
  );
  const issues = [
    ...(preflight.ok ? [] : [preflight.message ?? "Compare is not ready."]),
    ...validationIssues,
  ];

  async function runCompare() {
    if (issues.length > 0) return;
    setRunning(true);
    setError(null);
    setCompareResults(null);
    try {
      const runs = await Promise.all(
        compareScenarios.map(async (scenario) => ({
          id: scenario.id,
          label: scenario.label,
          result: await planning.monteCarlo({
            currentAge: scenario.snapshot.inputs.currentAge,
            retirementAge: scenario.snapshot.inputs.retirementAge,
            horizonAge: scenario.snapshot.inputs.horizonAge,
            accounts: scenario.snapshot.inputs.accounts,
            assetClasses: scenario.snapshot.inputs.assetClasses,
            correlations: scenario.assumptions?.correlations,
            annualSpend: scenario.snapshot.inputs.annualSpend,
            spendColaRate: scenario.snapshot.inputs.spendColaRate,
            guaranteedIncome: scenario.snapshot.inputs.guaranteedIncome,
            filingStatus: scenario.snapshot.inputs.filingStatus,
            returnModel: scenario.snapshot.inputs.returnModel,
            paths: scenario.snapshot.inputs.paths,
            seed: compareSeed,
          }),
        })),
      );
      const resultCheck = checkCompareResults(runs, compareSeed);
      if (!resultCheck.ok) {
        throw new Error(resultCheck.message ?? "Compare result mismatch.");
      }
      setCompareResults(runs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6 md:col-span-2">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Scenario label">
          <TextInput
            value={label}
            onChange={setLabel}
            placeholder="Base scenario"
          />
        </Field>
        <button
          type="button"
          onClick={addCurrentScenario}
          disabled={compareScenarios.length >= 3}
          className="border border-stone-900 bg-white px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-stone-800 transition hover:bg-stone-100 disabled:opacity-40"
        >
          Add current
        </button>
        <div className="w-40">
          <Field label="Replay seed">
            <NumberInput
              value={compareSeed}
              onChange={(value) => {
                setCompareSeed(value);
                setCompareResults(null);
              }}
              step={1}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
          Scenario queue
        </h2>
        {compareScenarios.length === 0 ? (
          <Empty>
            Add the current Monte Carlo scenario, edit inputs or load a preset,
            then add another scenario for side-by-side replay.
          </Empty>
        ) : (
          <div className="space-y-2">
            {compareScenarios.map((scenario, index) => (
              <div
                key={scenario.id}
                className="grid gap-2 border border-stone-200 p-3 md:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <p className="font-mono text-sm text-stone-900">
                    {index + 1}. {scenario.label}
                  </p>
                  <p className="mt-1 font-mono text-[0.6rem] text-stone-500">
                    {scenario.snapshot.inputs.currentAge}→
                    {scenario.snapshot.inputs.horizonAge} ·{" "}
                    {scenario.snapshot.inputs.returnModel} ·{" "}
                    {scenario.snapshot.inputs.paths.toLocaleString()} paths ·{" "}
                    {formatCmaRef(scenarioCmaReference(scenario))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadQueuedScenario(scenario)}
                  className="border border-stone-300 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-stone-700 hover:bg-stone-100"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => removeScenario(scenario.id)}
                  className="border border-stone-300 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-stone-700 hover:bg-stone-100"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={issues.length > 0}
        onClick={runCompare}
        label="Run compare"
      />

      {error && (
        <p role="alert" className="font-mono text-[0.65rem] text-red-700">
          {error}
        </p>
      )}

      {compareResults && <CompareResults runs={compareResults} />}

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Scenario Compare replays the same Monte Carlo tool for 2-3 saved,
        de-identified snapshots with one deterministic seed. Current contract
        0.1.0 does not expose a stable cmaVersion on Monte Carlo results, so the
        UI gates live-assumption source consistency before dispatch and will
        also refuse mismatched cmaVersion values once the additive result field
        is available.
      </p>
    </section>
  );
}

function CompareResults({ runs }: { runs: CompareRunResult[] }) {
  const rows = buildCompareRows(runs);
  const cmaVersion = rows.find((row) => row.cmaVersion)?.cmaVersion;

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
          Compare result
        </h2>
        <p className="mt-1 font-mono text-[0.6rem] text-stone-500">
          seed {rows[0]?.seedUsed ?? "n/a"} · CMA{" "}
          {cmaVersion ?? "version not supplied by contract"}
        </p>
      </div>

      <MedianOverlay runs={runs} />
      <CompareTable rows={rows} />
    </section>
  );
}

function MedianOverlay({ runs }: { runs: CompareRunResult[] }) {
  const W = 300;
  const H = 130;
  const max = Math.max(
    1,
    ...runs.flatMap((run) => run.result.medianBalanceByYear),
  );
  const series = runs.map((run) => ({
    ...run,
    geo: seriesGeometry(run.result.medianBalanceByYear, W, H, max),
  }));

  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
        Median balance overlay
      </h3>
      <div className="border border-stone-200 p-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Median balance comparison for ${runs
            .map((run) => run.label)
            .join(", ")}.`}
        >
          {series.map((run, index) => (
            <polyline
              key={run.id}
              points={run.geo.polyline}
              fill="none"
              stroke={SERIES_COLORS[index]}
              strokeWidth={1.8}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {runs.map((run, index) => {
            const end =
              run.result.medianBalanceByYear[
                run.result.medianBalanceByYear.length - 1
              ] ?? 0;
            return (
              <span
                key={run.id}
                className="flex items-center gap-1 font-mono text-[0.6rem] text-stone-500"
              >
                <span
                  className="inline-block h-2 w-2"
                  style={{ backgroundColor: SERIES_COLORS[index] }}
                />
                {run.label} · terminal {usdCompact(end)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompareTable({ rows }: { rows: CompareRow[] }) {
  return (
    <div className="overflow-x-auto border border-stone-200">
      <table className="min-w-full border-collapse font-mono text-[0.65rem]">
        <thead className="bg-stone-100 text-stone-500">
          <tr>
            <th className="border-b border-stone-200 px-3 py-2 text-left font-normal uppercase tracking-wider">
              Scenario
            </th>
            <th className="border-b border-stone-200 px-3 py-2 text-right font-normal uppercase tracking-wider">
              Success
            </th>
            <th className="border-b border-stone-200 px-3 py-2 text-right font-normal uppercase tracking-wider">
              Δ success
            </th>
            <th className="border-b border-stone-200 px-3 py-2 text-right font-normal uppercase tracking-wider">
              P50 terminal
            </th>
            <th className="border-b border-stone-200 px-3 py-2 text-right font-normal uppercase tracking-wider">
              Δ P50
            </th>
            <th className="border-b border-stone-200 px-3 py-2 text-right font-normal uppercase tracking-wider">
              Worst path
            </th>
            <th className="border-b border-stone-200 px-3 py-2 text-right font-normal uppercase tracking-wider">
              Δ worst
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="odd:bg-white even:bg-stone-50">
              <td className="border-b border-stone-100 px-3 py-2 text-stone-900">
                {row.label}
              </td>
              <td className="border-b border-stone-100 px-3 py-2 text-right tabular-nums">
                {pct(row.successProbability)}
              </td>
              <td className="border-b border-stone-100 px-3 py-2 text-right tabular-nums">
                {signedPctPoints(row.successDelta)}
              </td>
              <td className="border-b border-stone-100 px-3 py-2 text-right tabular-nums">
                {usd(row.medianTerminal)}
              </td>
              <td className="border-b border-stone-100 px-3 py-2 text-right tabular-nums">
                {signedUsd(row.medianTerminalDelta)}
              </td>
              <td className="border-b border-stone-100 px-3 py-2 text-right tabular-nums">
                {usd(row.worstPathTerminal)}
              </td>
              <td className="border-b border-stone-100 px-3 py-2 text-right tabular-nums">
                {signedUsd(row.worstPathDelta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
