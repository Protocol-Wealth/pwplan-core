// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validatePerformanceAnalysis } from "./tool-validation";
import { buildPerformanceAnalysisRequest } from "./performance-analysis-request";
import { ResultShell } from "./result-shell";
import {
  Card,
  Empty,
  Field,
  IssueList,
  NumberInput,
  RunButton,
  SectionHeader,
  Select,
  TextInput,
} from "./form-controls";
import { pct, usdCompact } from "./format";
import type {
  BenchmarkRelativeResult,
  FeeDragResult,
  MoneyWeightedReturnResult,
  PerformanceAnalysisResult,
  TimeWeightedReturnResult,
  TwrFlowTiming,
} from "../contract/planning";
import type {
  PerformanceMwrFlowDraft,
  PerformanceTwrPeriodDraft,
} from "../store/scenario";

const FLOW_TIMING_OPTIONS: { value: TwrFlowTiming; label: string }[] = [
  { value: "start", label: "Start" },
  { value: "end", label: "End" },
];

function replaceAt<T>(items: T[], index: number, next: T): T[] {
  return items.map((item, i) => (i === index ? next : item));
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

export function PerformanceAnalysisForm() {
  const {
    performanceAnalysisInputs: p,
    setPerformanceAnalysisInputs,
    setPerformanceAnalysisResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validatePerformanceAnalysis(p);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setPerformanceAnalysisResult(
        await planning.performanceAnalysis(buildPerformanceAnalysisRequest(p)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function updateTwrPeriod(
    index: number,
    patch: Partial<PerformanceTwrPeriodDraft>,
  ) {
    setPerformanceAnalysisInputs({
      twrPeriods: replaceAt(p.twrPeriods, index, {
        ...p.twrPeriods[index],
        ...patch,
      }),
    });
  }

  function updateMwrFlow(
    index: number,
    patch: Partial<PerformanceMwrFlowDraft>,
  ) {
    setPerformanceAnalysisInputs({
      mwrFlows: replaceAt(p.mwrFlows, index, {
        ...p.mwrFlows[index],
        ...patch,
      }),
    });
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Performance
      </h2>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Public-safe performance math over numeric value, flow, fee, and return
        series only. Contributions for money-weighted return use negative
        amounts from the investor perspective.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Periods per year">
          <NumberInput
            value={p.periodsPerYear}
            onChange={(v) =>
              setPerformanceAnalysisInputs({ periodsPerYear: v })
            }
          />
        </Field>
        <Field label="TWR flow timing">
          <Select
            value={p.flowTiming}
            onChange={(v) =>
              setPerformanceAnalysisInputs({ flowTiming: v as TwrFlowTiming })
            }
            options={FLOW_TIMING_OPTIONS}
          />
        </Field>
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="Time-weighted return"
          addLabel="period"
          onAdd={() =>
            setPerformanceAnalysisInputs({
              twrPeriods: [
                ...p.twrPeriods,
                { startValue: 100_000, endValue: 105_000, netExternalFlow: 0 },
              ],
            })
          }
        />
        {p.twrPeriods.length === 0 ? (
          <Empty>No TWR periods. Add a period or use another section.</Empty>
        ) : (
          p.twrPeriods.map((period, index) => (
            <Card
              key={index}
              onRemove={() =>
                setPerformanceAnalysisInputs({
                  twrPeriods: removeAt(p.twrPeriods, index),
                })
              }
            >
              <div className="grid grid-cols-3 gap-3 pr-6">
                <Field label="Start value">
                  <NumberInput
                    value={period.startValue}
                    step={1000}
                    onChange={(v) => updateTwrPeriod(index, { startValue: v })}
                  />
                </Field>
                <Field label="End value">
                  <NumberInput
                    value={period.endValue}
                    step={1000}
                    onChange={(v) => updateTwrPeriod(index, { endValue: v })}
                  />
                </Field>
                <Field label="External flow (TWR: contributions +, withdrawals -)">
                  <NumberInput
                    value={period.netExternalFlow}
                    step={1000}
                    onChange={(v) =>
                      updateTwrPeriod(index, { netExternalFlow: v })
                    }
                  />
                </Field>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="Money-weighted return"
          addLabel="flow"
          onAdd={() =>
            setPerformanceAnalysisInputs({
              mwrFlows: [...p.mwrFlows, { tYears: 1, amount: -10_000 }],
            })
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Terminal value">
            <NumberInput
              value={p.terminalValue}
              step={1000}
              onChange={(v) =>
                setPerformanceAnalysisInputs({ terminalValue: v })
              }
            />
          </Field>
          <Field label="Terminal time years">
            <NumberInput
              value={p.terminalTimeYears}
              step={0.25}
              onChange={(v) =>
                setPerformanceAnalysisInputs({ terminalTimeYears: v })
              }
            />
          </Field>
        </div>
        {p.mwrFlows.length === 0 ? (
          <Empty>No MWR flows. Add a flow or use another section.</Empty>
        ) : (
          p.mwrFlows.map((flow, index) => (
            <Card
              key={index}
              onRemove={() =>
                setPerformanceAnalysisInputs({
                  mwrFlows: removeAt(p.mwrFlows, index),
                })
              }
            >
              <div className="grid grid-cols-2 gap-3 pr-6">
                <Field label="Time years">
                  <NumberInput
                    value={flow.tYears}
                    step={0.25}
                    onChange={(v) => updateMwrFlow(index, { tYears: v })}
                  />
                </Field>
                <Field label="Amount">
                  <NumberInput
                    value={flow.amount}
                    step={1000}
                    onChange={(v) => updateMwrFlow(index, { amount: v })}
                  />
                </Field>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Gross returns">
          <TextInput
            value={p.grossReturnsText}
            placeholder="0.08, 0.06"
            onChange={(v) =>
              setPerformanceAnalysisInputs({ grossReturnsText: v })
            }
          />
        </Field>
        <Field label="Fee rates">
          <TextInput
            value={p.feeRatesText}
            placeholder="0.01, 0.01"
            onChange={(v) => setPerformanceAnalysisInputs({ feeRatesText: v })}
          />
        </Field>
        <Field label="Portfolio returns">
          <TextInput
            value={p.portfolioReturnsText}
            placeholder="0.08, 0.06"
            onChange={(v) =>
              setPerformanceAnalysisInputs({ portfolioReturnsText: v })
            }
          />
        </Field>
        <Field label="Benchmark returns">
          <TextInput
            value={p.benchmarkReturnsText}
            placeholder="0.07, 0.055"
            onChange={(v) =>
              setPerformanceAnalysisInputs({ benchmarkReturnsText: v })
            }
          />
        </Field>
      </div>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Analyze performance"
      />
    </section>
  );
}

export function PerformanceAnalysisResults() {
  const { performanceAnalysisResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No performance analysis yet. Set numeric series and run."
    >
      {result && <PerformanceAnalysisPanel result={result} />}
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

function MiniSeries({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 0.01);
  return (
    <div className="space-y-1">
      {values.slice(0, 8).map((value, index) => (
        <div
          key={index}
          className="grid grid-cols-[2rem_1fr_4rem] items-center gap-2 font-mono text-[0.6rem] tabular-nums"
        >
          <span className="text-stone-500">{index + 1}</span>
          <div className="h-2 bg-stone-100">
            <div
              className={value >= 0 ? "h-2 bg-stone-800" : "h-2 bg-amber-700"}
              style={{ width: `${(Math.abs(value) / maxAbs) * 100}%` }}
            />
          </div>
          <span className="text-right text-stone-700">{pct(value)}</span>
        </div>
      ))}
    </div>
  );
}

function TimeWeightedPanel({ result }: { result: TimeWeightedReturnResult }) {
  return (
    <section className="space-y-3 border border-stone-200 p-3">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
        Time-weighted return
      </h3>
      <Row label="Cumulative return" value={pct(result.cumulativeReturn)} />
      <Row label="Annualized return" value={pct(result.annualizedReturn)} />
      <Row label="Periods" value={String(result.periods)} />
      <Row label="Flow timing" value={result.flowTiming} />
      <table className="w-full font-mono text-[0.65rem] tabular-nums">
        <tbody>
          {result.periodReturns.map((row) => (
            <tr key={row.period} className="border-b border-stone-100">
              <td className="py-1 text-stone-500">Period {row.period + 1}</td>
              <td className="py-1 text-right text-stone-800">
                {pct(row.return)}
              </td>
              <td className="py-1 text-right text-stone-500">
                {usdCompact(row.startValue)} to {usdCompact(row.endValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MoneyWeightedPanel({ result }: { result: MoneyWeightedReturnResult }) {
  return (
    <section className="space-y-3 border border-stone-200 p-3">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
        Money-weighted return
      </h3>
      <Row label="Rate" value={pct(result.rate)} />
      <Row label="Terminal time" value={`${result.terminalTimeYears} years`} />
      <Row label="Method" value={result.method} />
      <Row label="Iterations" value={String(result.iterations)} />
    </section>
  );
}

function FeeDragPanel({ result }: { result: FeeDragResult }) {
  return (
    <section className="space-y-3 border border-stone-200 p-3">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
        Fee drag
      </h3>
      <Row label="Cumulative gross" value={pct(result.cumulativeGrossReturn)} />
      <Row label="Cumulative net" value={pct(result.cumulativeNetReturn)} />
      <Row label="Cumulative drag" value={pct(result.cumulativeFeeDrag)} />
      <Row label="Annualized drag" value={pct(result.annualizedFeeDrag)} />
      <MiniSeries values={result.netReturns} />
    </section>
  );
}

function BenchmarkPanel({ result }: { result: BenchmarkRelativeResult }) {
  return (
    <section className="space-y-3 border border-stone-200 p-3">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
        Benchmark-relative
      </h3>
      <Row
        label="Portfolio cumulative"
        value={pct(result.cumulativePortfolioReturn)}
      />
      <Row
        label="Benchmark cumulative"
        value={pct(result.cumulativeBenchmarkReturn)}
      />
      <Row
        label="Cumulative excess"
        value={pct(result.cumulativeExcessReturn)}
      />
      <Row
        label="Annualized excess"
        value={pct(result.annualizedExcessReturn)}
      />
      <MiniSeries values={result.relativeReturns} />
    </section>
  );
}

function PerformanceAnalysisPanel({
  result,
}: {
  result: PerformanceAnalysisResult;
}) {
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      {result.timeWeighted && (
        <TimeWeightedPanel result={result.timeWeighted} />
      )}
      {result.moneyWeighted && (
        <MoneyWeightedPanel result={result.moneyWeighted} />
      )}
      {result.feeDrag && <FeeDragPanel result={result.feeDrag} />}
      {result.benchmarkRelative && (
        <BenchmarkPanel result={result.benchmarkRelative} />
      )}

      <div className="space-y-1 font-mono text-[0.65rem] text-stone-500">
        <p>
          periods/year {result.assumptions.periodsPerYear} · cash-flow
          convention {result.assumptions.cashFlowSignConvention}
        </p>
        <p>{result.disclaimer}</p>
      </div>
    </section>
  );
}
