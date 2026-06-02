// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateRegimeGen } from "./tool-validation";
import { ResultShell } from "./result-shell";
import { MatrixTable } from "./MatrixTable";
import { Field, NumberInput, IssueList, RunButton } from "./form-controls";
import type { RegimeReturnResult } from "../contract/planning";

export function RegimeReturnForm() {
  const {
    regimeGenInputs: g,
    inputs,
    setRegimeGenInputs,
    setRegimeGenResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateRegimeGen(g, inputs.assetClasses);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setRegimeGenResult(
        await planning.regimeReturnGenerator({
          assetClasses: inputs.assetClasses,
          horizonYears: g.horizonYears,
          paths: g.paths,
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
        Regime return generator
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Horizon (years)">
          <NumberInput
            value={g.horizonYears}
            onChange={(v) => setRegimeGenInputs({ horizonYears: v })}
          />
        </Field>
        <Field label="Paths">
          <NumberInput
            value={g.paths}
            onChange={(v) => setRegimeGenInputs({ paths: v })}
          />
        </Field>
      </div>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Uses the shared portfolio&rsquo;s asset classes (
        {inputs.assetClasses.length} defined in the Monte Carlo tab, each needs
        a λ). Returns the live regime, its transition matrix, and a{" "}
        <code>pathCacheKey</code> you can replay in a Monte Carlo run.
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Generate regime paths"
      />
    </section>
  );
}

export function RegimeReturnResults() {
  const { regimeGenResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No regime paths yet. Set the horizon + paths and generate."
    >
      {result && <RegimeReturnPanel result={result} />}
    </ResultShell>
  );
}

function RegimeReturnPanel({ result }: { result: RegimeReturnResult }) {
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Current regime
        </p>
        <p className="font-mono text-2xl text-stone-800">
          {result.currentRegime}
        </p>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Transition matrix (row → column)
        </p>
        <MatrixTable
          ids={Object.keys(result.transitionMatrix)}
          matrix={result.transitionMatrix}
          corner="from\to"
          caption="Regime transition matrix"
          dimDiagonal={false}
        />
      </div>

      <div className="space-y-1">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Path cache key
        </p>
        <p className="break-all font-mono text-[0.7rem] text-stone-700">
          {result.pathCacheKey}
        </p>
        <p className="font-mono text-[0.6rem] text-stone-500">
          Replayable as <code>pathCacheKey</code> in a Monte Carlo run to reuse
          these EMF paths.
        </p>
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </section>
  );
}
