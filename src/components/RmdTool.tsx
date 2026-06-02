// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateRmd } from "./tool-validation";
import { ResultShell } from "./result-shell";
import { Field, NumberInput, IssueList, RunButton } from "./form-controls";
import { usd, pct } from "./format";
import type { RmdResult } from "../contract/planning";

export function RmdForm() {
  const {
    rmdInputs: r,
    setRmdInputs,
    setRmdResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateRmd(r);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setRmdResult(await planning.rmd({ age: r.age, balance: r.balance }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Required minimum distribution
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Age (at year end)">
          <NumberInput
            value={r.age}
            onChange={(v) => setRmdInputs({ age: v })}
          />
        </Field>
        <Field label="Prior year-end balance">
          <NumberInput
            value={r.balance}
            onChange={(v) => setRmdInputs({ balance: v })}
          />
        </Field>
      </div>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Traditional (pre-tax) account RMD via the IRS Uniform Lifetime Table.
        RMDs begin at age 73 (SECURE 2.0).
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Compute RMD"
      />
    </section>
  );
}

export function RmdResults() {
  const { rmdResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No RMD computed yet. Set age + balance and compute."
    >
      {result && <RmdPanel result={result} />}
    </ResultShell>
  );
}

function RmdPanel({ result }: { result: RmdResult }) {
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      {result.applies ? (
        <div className="border border-stone-300 bg-stone-50 p-4">
          <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
            This year&rsquo;s RMD
          </p>
          <p className="font-mono text-2xl tabular-nums text-stone-800">
            {usd(result.rmdAmount)}
          </p>
          <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
            balance ÷ {result.distributionPeriod} (distribution period) ·{" "}
            {pct(result.effectiveRate)} of the balance
          </p>
        </div>
      ) : (
        <div className="border border-stone-300 bg-stone-50 p-4">
          <p className="font-mono text-sm text-stone-700">
            No RMD required yet.
          </p>
          <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
            RMDs begin at age {result.rmdStartAge}.
          </p>
        </div>
      )}

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not tax advice
      </p>
    </section>
  );
}
