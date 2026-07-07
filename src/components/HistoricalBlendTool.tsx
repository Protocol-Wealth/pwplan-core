// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateHistoricalBlend } from "./tool-validation";
import {
  buildHistoricalBlendRequest,
  historicalBlendAssetIds,
} from "./historical-blend-request";
import { ResultShell } from "./result-shell";
import {
  Field,
  IssueList,
  NumberInput,
  RunButton,
  Select,
  TextInput,
} from "./form-controls";
import { LineChart } from "./charts";
import { pct, usdCompact } from "./format";
import type {
  HistoricalBlendRebalanceFrequency,
  HistoricalBlendResult,
} from "../contract/planning";

const REBALANCE_OPTIONS: {
  value: HistoricalBlendRebalanceFrequency;
  label: string;
}[] = [
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly" },
  { value: "none", label: "None" },
];

export function HistoricalBlendForm() {
  const {
    historicalBlendInputs: h,
    setHistoricalBlendInputs,
    setHistoricalBlendResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const ids = historicalBlendAssetIds(h);
  const issues = validateHistoricalBlend(h);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setHistoricalBlendResult(
        await planning.historicalBlend(buildHistoricalBlendRequest(h)),
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
        Historical blend
      </h2>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Historical index-blend exhibit over engine-sourced monthly return
        series. Inputs are asset-class ids, weights, lookback, rebalance
        frequency, and display initial value only.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Asset-class ids">
            <TextInput
              value={h.assetClassIdsText}
              placeholder="us_equity, us_bonds"
              onChange={(v) =>
                setHistoricalBlendInputs({ assetClassIdsText: v })
              }
            />
          </Field>
        </div>
        <Field label="Lookback days">
          <NumberInput
            value={h.lookbackDays}
            onChange={(v) => setHistoricalBlendInputs({ lookbackDays: v })}
          />
        </Field>
        <Field label="Initial value">
          <NumberInput
            value={h.initialValue}
            onChange={(v) => setHistoricalBlendInputs({ initialValue: v })}
            step={0.01}
          />
        </Field>
        <Field label="As-of date">
          <TextInput
            value={h.asOf}
            placeholder="YYYY-MM-DD or blank"
            onChange={(v) => setHistoricalBlendInputs({ asOf: v })}
          />
        </Field>
        <Field label="Rebalance">
          <Select
            value={h.rebalanceFrequency}
            onChange={(v) =>
              setHistoricalBlendInputs({
                rebalanceFrequency: v as HistoricalBlendRebalanceFrequency,
              })
            }
            options={REBALANCE_OPTIONS}
          />
        </Field>
      </div>

      <div className="space-y-2">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
          Weights
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {ids.map((id) => (
            <Field key={id} label={id}>
              <NumberInput
                value={h.weights[id] ?? 0}
                onChange={(v) =>
                  setHistoricalBlendInputs({ weights: { [id]: v } })
                }
                step={0.01}
              />
            </Field>
          ))}
        </div>
        <p className="font-mono text-[0.6rem] text-stone-500">
          Weight sum:{" "}
          {ids
            .reduce((total, id) => total + (h.weights[id] ?? 0), 0)
            .toFixed(3)}
        </p>
      </div>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Build historical blend"
      />
    </section>
  );
}

export function HistoricalBlendResults() {
  const { historicalBlendResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No historical blend yet. Set weights and build the exhibit."
    >
      {result && <HistoricalBlendPanel result={result} />}
    </ResultShell>
  );
}

function HistoricalBlendPanel({ result }: { result: HistoricalBlendResult }) {
  const calendar = result.calendarYearReturns.slice(-12);
  const maxAbsCalendar = Math.max(
    ...calendar.map((row) => Math.abs(row.return)),
    0.01,
  );
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="grid grid-cols-2 gap-px bg-stone-200">
        <Metric
          label="Annualized mean"
          value={pct(result.statistics.annualizedMean)}
        />
        <Metric
          label="Annualized volatility"
          value={pct(result.statistics.annualizedVolatility)}
        />
        <Metric label="Months" value={String(result.months)} />
        <Metric label="As of" value={result.asOf} />
      </div>

      <div className="space-y-1">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Growth of initial value
        </span>
        <LineChart
          values={result.growthOfDollar.map((point) => point.value)}
          ariaLabel="Historical blend growth of initial value"
          footer={{
            left: result.startMonth,
            center: result.rebalanceFrequency,
            right: result.endMonth,
          }}
        />
      </div>

      <div className="space-y-1">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Calendar-year returns
        </span>
        {calendar.map((row) => (
          <div
            key={row.year}
            className="grid grid-cols-[3rem_1fr_4rem] items-center gap-2 font-mono text-[0.6rem] tabular-nums"
          >
            <span className="text-stone-500">{row.year}</span>
            <div className="h-3 bg-stone-100">
              <div
                className={
                  row.return >= 0 ? "h-3 bg-stone-800" : "h-3 bg-amber-700"
                }
                style={{
                  width: `${(Math.abs(row.return) / maxAbsCalendar) * 100}%`,
                }}
              />
            </div>
            <span className="text-right text-stone-700">{pct(row.return)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
          Trailing returns
        </h3>
        <table className="w-full border border-stone-200 font-mono text-[0.7rem] tabular-nums">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="px-2 py-1 text-left font-normal uppercase tracking-wider">
                Window
              </th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-wider">
                Return
              </th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-wider">
                Basis
              </th>
            </tr>
          </thead>
          <tbody>
            {result.annualizedReturns.map((row) => (
              <tr
                key={row.window}
                className="border-b border-stone-100 last:border-b-0"
              >
                <td className="px-2 py-1 text-stone-700">{row.window}</td>
                <td className="px-2 py-1 text-right text-stone-800">
                  {pct(row.return)}
                </td>
                <td className="px-2 py-1 text-right text-stone-500">
                  {row.annualized ? "annualized" : "not annualized"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 font-mono text-[0.65rem] text-stone-500">
        <p>
          Final value:{" "}
          {usdCompact(
            result.growthOfDollar[result.growthOfDollar.length - 1]?.value ?? 0,
          )}
          {" · "}Direct index investment possible:{" "}
          {result.assumptions.directIndexInvestmentPossible ? "yes" : "no"}
        </p>
        <p>{result.disclaimer}</p>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-3">
      <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div className="font-mono text-lg tabular-nums text-stone-900">
        {value}
      </div>
    </div>
  );
}
