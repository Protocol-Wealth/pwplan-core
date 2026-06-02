// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateRebalance } from "./tool-validation";
import { ResultShell } from "./result-shell";
import { Field, NumberInput, IssueList, RunButton } from "./form-controls";
import { usd, pct } from "./format";
import type { RebalanceResult, RebalanceRow } from "../contract/planning";

export function RebalanceForm() {
  const {
    inputs,
    rebalanceInputs: rb,
    setRebalanceInputs,
    setRebalanceResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateRebalance(rb, inputs.assetClasses, inputs.accounts);
  const runnable = issues.length === 0;

  const targetSum = inputs.assetClasses.reduce(
    (acc, ac) => acc + (rb.targetWeights[ac.id] ?? 0),
    0,
  );

  async function run() {
    if (!runnable) return;
    // Only send target weights for the currently-declared asset-class ids
    // (every declared id gets a weight; missing ⇒ 0).
    const targetWeights = Object.fromEntries(
      inputs.assetClasses.map((ac) => [ac.id, rb.targetWeights[ac.id] ?? 0]),
    );
    setRunning(true);
    setError(null);
    try {
      setRebalanceResult(
        await planning.rebalance({
          assetClasses: inputs.assetClasses,
          accounts: inputs.accounts,
          targetWeights,
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
        Rebalance to target
      </h2>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Current holdings come from the shared Monte Carlo portfolio (
        {inputs.accounts.length} accounts × allocations). Set a target weight
        for each asset class; the engine returns the drift and the
        self-financing trades to reach it.
      </p>

      <div className="space-y-3">
        {inputs.assetClasses.map((ac) => (
          <Field key={ac.id} label={`${ac.label} (${ac.id}) target`}>
            <NumberInput
              value={rb.targetWeights[ac.id] ?? 0}
              step={0.05}
              onChange={(v) =>
                setRebalanceInputs({
                  targetWeights: { ...rb.targetWeights, [ac.id]: v },
                })
              }
            />
          </Field>
        ))}
      </div>

      <p className="font-mono text-[0.6rem] text-stone-500">
        Targets sum to{" "}
        <span
          className={
            Math.abs(targetSum - 1) > 1e-6 ? "text-amber-700" : "text-stone-700"
          }
        >
          {targetSum.toFixed(2)}
        </span>{" "}
        (must be 1.00).
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Compute trades"
      />
    </section>
  );
}

export function RebalanceResults() {
  const { rebalanceResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No rebalance yet. Set target weights and compute."
    >
      {result && <RebalancePanel result={result} />}
    </ResultShell>
  );
}

function TradeRow({ row }: { row: RebalanceRow }) {
  const buying = row.tradeAmount > 0;
  const flat = row.tradeAmount === 0;
  return (
    <tr className="border-b border-stone-200 font-mono text-[0.7rem] tabular-nums">
      <td className="py-1.5 pr-2 text-stone-700">{row.id}</td>
      <td className="py-1.5 pr-2 text-right text-stone-600">
        {pct(row.currentWeight)}
      </td>
      <td className="py-1.5 pr-2 text-right text-stone-600">
        {pct(row.targetWeight)}
      </td>
      <td
        className={`py-1.5 pl-2 text-right ${
          flat ? "text-stone-500" : buying ? "text-emerald-700" : "text-red-700"
        }`}
      >
        {flat
          ? "—"
          : `${buying ? "buy" : "sell"} ${usd(Math.abs(row.tradeAmount))}`}
      </td>
    </tr>
  );
}

function RebalancePanel({ result }: { result: RebalanceResult }) {
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          One-way turnover
        </p>
        <p className="font-mono text-2xl tabular-nums text-stone-800">
          {usd(result.turnover)}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          on a {usd(result.totalValue)} portfolio
        </p>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-stone-300 font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
            <th className="py-1 pr-2 text-left">Asset</th>
            <th className="py-1 pr-2 text-right">Current</th>
            <th className="py-1 pr-2 text-right">Target</th>
            <th className="py-1 pl-2 text-right">Trade</th>
          </tr>
        </thead>
        <tbody>
          {result.perAsset.map((row) => (
            <TradeRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not a trade instruction
      </p>
    </section>
  );
}
