// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateOptimizeAllocation, parseIdList } from "./tool-validation";
import { ResultShell } from "./result-shell";
import {
  Field,
  NumberInput,
  Select,
  TextInput,
  IssueList,
  RunButton,
} from "./form-controls";
import { pct } from "./format";
import type {
  AllocationObjective,
  AllocationAssetClass,
  OptimizeAllocationResult,
  RiskProfile,
} from "../contract/planning";

const RISK_PROFILES: { value: RiskProfile; label: string }[] = [
  { value: "conservative", label: "Conservative" },
  { value: "moderate_conservative", label: "Moderate conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "moderate_aggressive", label: "Moderate aggressive" },
  { value: "aggressive", label: "Aggressive" },
];

const OBJECTIVES: { value: AllocationObjective | ""; label: string }[] = [
  { value: "", label: "Auto (profile / regime)" },
  { value: "max_sharpe", label: "Max Sharpe" },
  { value: "min_volatility", label: "Min volatility" },
  { value: "max_quadratic_utility", label: "Max quadratic utility" },
  { value: "efficient_return", label: "Efficient return" },
  { value: "efficient_risk", label: "Efficient risk" },
];

const RETURN_MODELS: {
  value: "house_view" | "historical";
  label: string;
}[] = [
  { value: "house_view", label: "House view" },
  { value: "historical", label: "Historical" },
];

export function OptimizeAllocationForm() {
  const {
    optimizeAllocationInputs: o,
    setOptimizeAllocationInputs,
    setOptimizeAllocationResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateOptimizeAllocation(o);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      const ids = parseIdList(o.assetClassIdsText);
      setOptimizeAllocationResult(
        await planning.optimizeAllocation({
          // Empty ⇒ the engine's full default universe (omit the field).
          ...(ids.length > 0 ? { assetClassIds: ids } : {}),
          riskProfile: o.riskProfile,
          ...(o.objective ? { objective: o.objective } : {}),
          weightBounds: [o.weightMin, o.weightMax],
          returnModel: o.returnModel,
          regimeAware: o.regimeAware,
          riskFreeRate: o.riskFreeRate,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Optimize allocation
      </h2>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Mean-variance optimal weights over the engine&apos;s real-data universe.
        Pick a risk profile and (optionally) override the objective; the
        differentiator is <em>regime-aware</em> — when enabled the live EMF
        regime selects the objective. Educational, not advice.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Risk profile">
          <Select
            value={o.riskProfile}
            onChange={(v) =>
              setOptimizeAllocationInputs({ riskProfile: v as RiskProfile })
            }
            options={RISK_PROFILES}
          />
        </Field>
        <Field label="Objective">
          <Select
            value={o.objective}
            onChange={(v) =>
              setOptimizeAllocationInputs({
                objective: v as AllocationObjective | "",
              })
            }
            options={OBJECTIVES}
          />
        </Field>
        <Field label="Return model">
          <Select
            value={o.returnModel}
            onChange={(v) =>
              setOptimizeAllocationInputs({
                returnModel: v as "house_view" | "historical",
              })
            }
            options={RETURN_MODELS}
          />
        </Field>
        <Field label="Risk-free rate">
          <NumberInput
            step={0.005}
            value={o.riskFreeRate}
            onChange={(v) => setOptimizeAllocationInputs({ riskFreeRate: v })}
          />
        </Field>
        <Field label="Min weight bound">
          <NumberInput
            step={0.05}
            value={o.weightMin}
            onChange={(v) => setOptimizeAllocationInputs({ weightMin: v })}
          />
        </Field>
        <Field label="Max weight bound">
          <NumberInput
            step={0.05}
            value={o.weightMax}
            onChange={(v) => setOptimizeAllocationInputs({ weightMax: v })}
          />
        </Field>
      </div>

      <Field label="Asset-class ids (blank = full universe)">
        <TextInput
          value={o.assetClassIdsText}
          placeholder="us_equity, us_bonds, intl_equity"
          onChange={(v) =>
            setOptimizeAllocationInputs({ assetClassIdsText: v })
          }
        />
      </Field>

      <label className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-wider text-stone-600">
        <input
          type="checkbox"
          checked={o.regimeAware}
          onChange={(e) =>
            setOptimizeAllocationInputs({ regimeAware: e.target.checked })
          }
          className="accent-stone-900"
        />
        Regime-aware (live regime selects the objective)
      </label>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Optimize"
      />
    </section>
  );
}

export function OptimizeAllocationResults() {
  const { optimizeAllocationResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No allocation yet. Pick a risk profile and optimize."
    >
      {result && <AllocationPanel result={result} />}
    </ResultShell>
  );
}

function WeightRow({
  ac,
  maxWeight,
}: {
  ac: AllocationAssetClass;
  maxWeight: number;
}) {
  const frac = maxWeight > 0 ? Math.max(0, ac.weight / maxWeight) : 0;
  return (
    <tr className="border-b border-stone-200 font-mono text-[0.7rem] tabular-nums">
      <td className="py-1.5 pr-2 text-stone-700">{ac.id}</td>
      <td className="py-1.5 pr-2">
        <div className="h-2 w-full bg-stone-100">
          <div
            className="h-2 bg-stone-800"
            style={{ width: `${(frac * 100).toFixed(1)}%` }}
          />
        </div>
      </td>
      <td className="py-1.5 pl-2 text-right text-stone-800">
        {pct(ac.weight)}
      </td>
    </tr>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-stone-200 py-1.5 font-mono text-sm tabular-nums">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-800">{value}</span>
    </div>
  );
}

function AllocationPanel({ result }: { result: OptimizeAllocationResult }) {
  const maxWeight = result.assetClasses.reduce(
    (m, ac) => Math.max(m, ac.weight),
    0,
  );
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Objective · {result.objectiveSource}
        </p>
        <p className="font-mono text-2xl text-stone-800">{result.objective}</p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          Live regime: {result.regime}
          {result.regimeNote ? ` · ${result.regimeNote}` : ""}
        </p>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-stone-300 font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
            <th className="py-1 pr-2 text-left">Asset</th>
            <th className="py-1 pr-2 text-left">Weight</th>
            <th className="py-1 pl-2 text-right" />
          </tr>
        </thead>
        <tbody>
          {result.assetClasses.map((ac) => (
            <WeightRow key={ac.id} ac={ac} maxWeight={maxWeight} />
          ))}
        </tbody>
      </table>

      <div>
        <Row
          label="Expected return"
          value={
            result.expectedReturn === null ? "—" : pct(result.expectedReturn)
          }
        />
        <Row
          label="Expected volatility"
          value={
            result.expectedVolatility === null
              ? "—"
              : pct(result.expectedVolatility)
          }
        />
        <Row
          label="Sharpe ratio"
          value={
            result.sharpeRatio === null ? "—" : result.sharpeRatio.toFixed(2)
          }
        />
        <Row label="Risk-free rate" value={pct(result.riskFreeRate)} />
        <Row
          label="Weight bounds"
          value={`${pct(result.weightBounds[0])} – ${pct(result.weightBounds[1])}`}
        />
        <Row label="Return model" value={result.returnModel} />
        <Row label="As of" value={result.asOf} />
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </section>
  );
}
