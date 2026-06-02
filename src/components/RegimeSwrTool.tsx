// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateRegimeSwr } from "./tool-validation";
import { ResultShell } from "./result-shell";
import { Field, NumberInput, IssueList, RunButton } from "./form-controls";
import { usd, pct } from "./format";
import type { RegimeConditionedSwrResult } from "../contract/planning";

export function RegimeSwrForm() {
  const {
    regimeSwrInputs: r,
    setRegimeSwrInputs,
    setRegimeSwrResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateRegimeSwr(r);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setRegimeSwrResult(
        await planning.regimeConditionedSwr({
          baseSwr: r.baseSwr,
          portfolioBalance: r.portfolioBalance,
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
        Regime-conditioned withdrawal rate
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Base withdrawal rate">
          <NumberInput
            step={0.005}
            value={r.baseSwr}
            onChange={(v) => setRegimeSwrInputs({ baseSwr: v })}
          />
        </Field>
        <Field label="Portfolio balance">
          <NumberInput
            value={r.portfolioBalance}
            onChange={(v) => setRegimeSwrInputs({ portfolioBalance: v })}
          />
        </Field>
      </div>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Adjusts a base safe withdrawal rate for the <em>live</em> macro regime
        (classified server-side). Illustrative overlay — not advice.
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Adjust for regime"
      />
    </section>
  );
}

export function RegimeSwrResults() {
  const { regimeSwrResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No regime-adjusted rate yet. Set the inputs and run."
    >
      {result && <RegimeSwrPanel result={result} />}
    </ResultShell>
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

function RegimeSwrPanel({ result }: { result: RegimeConditionedSwrResult }) {
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Regime-adjusted withdrawal rate
        </p>
        <p className="font-mono text-2xl tabular-nums text-stone-800">
          {pct(result.adjustedSwr)}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          live regime <span className="text-stone-700">{result.regime}</span> ·{" "}
          {pct(result.baseSwr)} base × {result.regimeMultiplier}
        </p>
      </div>

      <div>
        <Row label="Base rate" value={pct(result.baseSwr)} />
        <Row label="Regime multiplier" value={`${result.regimeMultiplier}×`} />
        <Row label="Adjusted rate" value={pct(result.adjustedSwr)} />
        {result.firstYearWithdrawal !== undefined && (
          <Row
            label="First-year withdrawal"
            value={usd(result.firstYearWithdrawal)}
          />
        )}
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </section>
  );
}
