// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateFire } from "./tool-validation";
import { ResultShell } from "./result-shell";
import { Field, NumberInput, IssueList, RunButton } from "./form-controls";
import { usd } from "./format";
import type { FireResult } from "../contract/planning";

export function FireForm() {
  const {
    fireInputs: f,
    setFireInputs,
    setFireResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateFire(f);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setFireResult(
        await planning.fire({
          currentAge: f.currentAge,
          retirementAge: f.retirementAge,
          currentBalance: f.currentBalance,
          annualContribution: f.annualContribution,
          growthRate: f.growthRate,
          annualSpend: f.annualSpend,
          swr: f.swr,
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
        FIRE / Coast-FIRE
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Current age">
          <NumberInput
            value={f.currentAge}
            onChange={(v) => setFireInputs({ currentAge: v })}
          />
        </Field>
        <Field label="Retirement age">
          <NumberInput
            value={f.retirementAge}
            onChange={(v) => setFireInputs({ retirementAge: v })}
          />
        </Field>
        <Field label="Current balance">
          <NumberInput
            value={f.currentBalance}
            step={1000}
            onChange={(v) => setFireInputs({ currentBalance: v })}
          />
        </Field>
        <Field label="Annual contribution">
          <NumberInput
            value={f.annualContribution}
            step={1000}
            onChange={(v) => setFireInputs({ annualContribution: v })}
          />
        </Field>
        <Field label="Growth rate">
          <NumberInput
            value={f.growthRate}
            step={0.01}
            onChange={(v) => setFireInputs({ growthRate: v })}
          />
        </Field>
        <Field label="Annual spend (target)">
          <NumberInput
            value={f.annualSpend}
            step={1000}
            onChange={(v) => setFireInputs({ annualSpend: v })}
          />
        </Field>
        <Field label="Safe withdrawal rate">
          <NumberInput
            value={f.swr}
            step={0.005}
            onChange={(v) => setFireInputs({ swr: v })}
          />
        </Field>
      </div>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        FIRE number = annual spend ÷ safe withdrawal rate. The coast number is
        what you&rsquo;d need invested today to reach it by retirement with no
        further contributions. A single nominal growth rate; educational.
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Compute FIRE"
      />
    </section>
  );
}

export function FireResults() {
  const { fireResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No FIRE figures yet. Set the inputs and compute."
    >
      {result && <FirePanel result={result} />}
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

function FirePanel({ result }: { result: FireResult }) {
  const surplus = result.surplusOrGapAtRetirement;
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          FIRE number
        </p>
        <p className="font-mono text-2xl tabular-nums text-stone-800">
          {usd(result.fireNumber)}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          {result.coastReached
            ? "Coasting — the existing balance reaches FIRE with no further contributions."
            : `Coast number (needed today): ${usd(result.coastNumber)}.`}
        </p>
      </div>

      <div>
        <Row label="Coast number (today)" value={usd(result.coastNumber)} />
        <Row label="Coast reached" value={result.coastReached ? "yes" : "no"} />
        <Row
          label="Projected balance at retirement"
          value={usd(result.projectedBalanceAtRetirement)}
        />
        <Row
          label={surplus >= 0 ? "Surplus at retirement" : "Gap at retirement"}
          value={usd(Math.abs(surplus))}
        />
        <Row
          label="Years to FIRE"
          value={result.yearsToFire === null ? "—" : String(result.yearsToFire)}
        />
        <Row
          label="FIRE age"
          value={result.fireAge === null ? "—" : String(result.fireAge)}
        />
      </div>

      {result.yearsToFire === null && (
        <p className="font-mono text-[0.65rem] text-amber-700">
          The plan does not reach the FIRE number within the search horizon —
          raise contributions or growth, or lower the target spend.
        </p>
      )}

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </section>
  );
}
