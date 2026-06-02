// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { parseReturns, validateRiskMetrics } from "./tool-validation";
import { ResultShell } from "./result-shell";
import {
  Field,
  NumberInput,
  TextInput,
  IssueList,
  RunButton,
} from "./form-controls";
import { pct } from "./format";
import type { RiskMetricsResult } from "../contract/planning";

export function RiskMetricsForm() {
  const {
    riskMetricsInputs: r,
    setRiskMetricsInputs,
    setRiskMetricsResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateRiskMetrics(r);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    const returns = parseReturns(r.returnsText);
    if (returns === null) return; // guarded by validation
    setRunning(true);
    setError(null);
    try {
      setRiskMetricsResult(
        await planning.riskMetrics({
          returns,
          riskFreeRate: r.riskFreeRate,
          periodsPerYear: r.periodsPerYear,
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
        Risk metrics
      </h2>

      <Field label="Returns (per period, decimals)">
        <TextInput
          value={r.returnsText}
          onChange={(v) => setRiskMetricsInputs({ returnsText: v })}
          placeholder="0.12, -0.08, 0.21, …"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Risk-free rate (annual)">
          <NumberInput
            value={r.riskFreeRate}
            step={0.005}
            onChange={(v) => setRiskMetricsInputs({ riskFreeRate: v })}
          />
        </Field>
        <Field label="Periods per year">
          <NumberInput
            value={r.periodsPerYear}
            onChange={(v) => setRiskMetricsInputs({ periodsPerYear: v })}
          />
        </Field>
      </div>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Ex-post statistics for the supplied return series. Periods per year sets
        annualization (1 annual, 12 monthly, 252 daily). Descriptive — not a
        forecast.
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Compute metrics"
      />
    </section>
  );
}

export function RiskMetricsResults() {
  const { riskMetricsResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No metrics yet. Enter a return series and compute."
    >
      {result && <RiskMetricsPanel result={result} />}
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

function RiskMetricsPanel({ result }: { result: RiskMetricsResult }) {
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Annualized return
        </p>
        <p className="font-mono text-2xl tabular-nums text-stone-800">
          {pct(result.annualizedReturn)}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          over {result.periods} periods · vol {pct(result.annualizedVolatility)}
        </p>
      </div>

      <div>
        <Row label="Sharpe" value={result.sharpe.toFixed(2)} />
        <Row label="Sortino" value={result.sortino.toFixed(2)} />
        <Row label="Max drawdown" value={pct(result.maxDrawdown)} />
        <Row label="Value at Risk (95%)" value={pct(result.valueAtRisk95)} />
        <Row
          label="Conditional VaR (95%)"
          value={pct(result.conditionalVaR95)}
        />
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </section>
  );
}
