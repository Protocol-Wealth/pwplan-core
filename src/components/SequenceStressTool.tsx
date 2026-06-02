// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { parseReturns, validateSequenceStress } from "./tool-validation";
import { ResultShell } from "./result-shell";
import {
  Field,
  NumberInput,
  TextInput,
  IssueList,
  RunButton,
} from "./form-controls";
import { usd, pct } from "./format";
import type {
  SequenceOutcome,
  SequenceOfReturnsStressResult,
} from "../contract/planning";

export function SequenceStressForm() {
  const {
    sorInputs: s,
    setSorInputs,
    setSorResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateSequenceStress(s);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    const returns = parseReturns(s.returnsText);
    if (returns === null) return;
    setRunning(true);
    setError(null);
    try {
      const result = await planning.sequenceOfReturnsStress({
        initialBalance: s.initialBalance,
        // Constant net withdrawal each year (kept simple for the demo UI).
        netSpendByYear: returns.map(() => s.annualSpend),
        annualReturns: returns,
      });
      setSorResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Sequence-of-returns stress
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Initial balance">
          <NumberInput
            value={s.initialBalance}
            onChange={(v) => setSorInputs({ initialBalance: v })}
          />
        </Field>
        <Field label="Annual spend (per year)">
          <NumberInput
            value={s.annualSpend}
            onChange={(v) => setSorInputs({ annualSpend: v })}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Annual returns (decimals, comma-separated)">
            <TextInput
              value={s.returnsText}
              placeholder="0.07, 0.05, -0.10, 0.12"
              onChange={(v) => setSorInputs({ returnsText: v })}
            />
          </Field>
        </div>
      </div>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        The same returns are replayed worst-first, best-first, and as-entered.
        The mean is identical across orderings, so the spread is pure
        sequence-of-returns risk.
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Run stress"
      />
    </section>
  );
}

export function SequenceStressResults() {
  const { sorResult: result, error, running } = useScenario();

  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No stress run yet. Set the inputs and run."
    >
      {result && <SorPanel result={result} />}
    </ResultShell>
  );
}

function outcomeNote(o: SequenceOutcome): string {
  return o.depletedYear === null
    ? "funded the horizon"
    : `depleted in year ${o.depletedYear + 1}`;
}

function OutcomeRow({
  label,
  outcome,
  emphasis,
}: {
  label: string;
  outcome: SequenceOutcome;
  emphasis?: "good" | "bad";
}) {
  const tone =
    emphasis === "good"
      ? "text-emerald-700"
      : emphasis === "bad"
        ? "text-red-700"
        : "text-stone-800";
  return (
    <div className="flex items-baseline justify-between border-b border-stone-200 py-1.5">
      <span className="font-mono text-sm text-stone-500">{label}</span>
      <span className="text-right">
        <span className={`font-mono text-sm tabular-nums ${tone}`}>
          {usd(outcome.terminalBalance)}
        </span>
        <span className="ml-2 font-mono text-[0.6rem] text-stone-400">
          {outcomeNote(outcome)}
        </span>
      </span>
    </div>
  );
}

function SorPanel({ result }: { result: SequenceOfReturnsStressResult }) {
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Sequence-of-returns risk (best-first − worst-first)
        </p>
        <p className="font-mono text-2xl tabular-nums text-stone-800">
          {usd(result.sequenceRiskGap)}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          Same mean return ({pct(result.meanAnnualReturn)}/yr over{" "}
          {result.years} years) — only the order differs.
        </p>
      </div>

      <div>
        <OutcomeRow
          label="Best-first"
          outcome={result.bestFirst}
          emphasis="good"
        />
        <OutcomeRow label="As entered" outcome={result.asGiven} />
        <OutcomeRow
          label="Worst-first"
          outcome={result.worstFirst}
          emphasis="bad"
        />
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </section>
  );
}
