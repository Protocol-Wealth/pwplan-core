// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import {
  percentileBars,
  regimeRuns,
  type PercentileBar,
  type RegimeRun,
} from "./results-viz";
import { ChartHeading, LineChart } from "./charts";
import { ResultShell } from "./result-shell";
import { usd, usdCompact, pct } from "./format";
import type { MonteCarloResult, Regime } from "../contract/planning";

/** Muted palette + display label per EMF regime. */
const REGIME_META: Record<Regime, { label: string; color: string }> = {
  expansion: { label: "Expansion", color: "#4d7c0f" },
  inflationary: { label: "Inflationary", color: "#b45309" },
  deflationary: { label: "Deflationary", color: "#0369a1" },
  stagflation: { label: "Stagflation", color: "#9f1239" },
  crisis: { label: "Crisis", color: "#7f1d1d" },
};

function maybePct(value: number | null | undefined): string {
  return value === null || value === undefined ? "n/a" : pct(value);
}

function maybeUsd(value: number | null | undefined): string {
  return value === null || value === undefined ? "n/a" : usd(value);
}

function maybeNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "n/a" : `${value}`;
}

function shortHash(value: string | undefined): string {
  return value ? value.slice(0, 12) : "n/a";
}

export function ResultsPanel() {
  const { result, error, running, inputs } = useScenario();

  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No result yet. Configure a scenario and run the simulation."
    >
      {result && (
        <MonteCarloResultView result={result} startAge={inputs.currentAge} />
      )}
    </ResultShell>
  );
}

export function MonteCarloResultView({
  result,
  startAge,
}: {
  result: MonteCarloResult;
  startAge: number;
}) {
  const bars = percentileBars(result.terminalValues);
  const runs = result.regimePathSummary
    ? regimeRuns(result.regimePathSummary)
    : [];

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-900 p-4">
        <div className="font-mono text-[0.65rem] uppercase tracking-wider text-stone-500">
          Probability of success
        </div>
        <div className="mt-1 font-mono text-4xl tabular-nums text-stone-900">
          {pct(result.successProbability)}
        </div>
        {result.successProbabilityConfidenceInterval && (
          <p className="mt-2 font-mono text-[0.65rem] tabular-nums text-stone-500">
            {result.successProbabilityConfidenceInterval.method}{" "}
            {pct(
              result.successProbabilityConfidenceInterval.confidenceLevel ??
                0.95,
            )}{" "}
            CI {maybePct(result.successProbabilityConfidenceInterval.lower)}–
            {maybePct(result.successProbabilityConfidenceInterval.upper)}
            {result.successProbabilityConfidenceInterval.halfWidth !== null
              ? ` · half-width ${pct(result.successProbabilityConfidenceInterval.halfWidth)}`
              : ""}
          </p>
        )}
      </div>

      <MedianBalanceChart
        series={result.medianBalanceByYear}
        startAge={startAge}
      />

      {result.balancePercentilesByYear && (
        <BalanceBandsPanel
          bands={result.balancePercentilesByYear}
          startAge={startAge}
        />
      )}

      <ReportQualityPanel result={result} />

      {result.depletionCurve && (
        <DepletionCurveChart curve={result.depletionCurve} />
      )}

      <TerminalDistribution bars={bars} worst={result.worstPathTerminal} />

      {result.firstDecadeReturnVsOutcome && (
        <FirstDecadePanel data={result.firstDecadeReturnVsOutcome} />
      )}

      {result.guardrailStats && (
        <GuardrailPanel result={result} startAge={startAge} />
      )}

      {result.goalFunding && <GoalFundingPanel result={result} />}

      {result.ltcShockImpact && <LtcShockPanel result={result} />}

      {runs.length > 0 && (
        <RegimePath runs={runs} totalYears={result.regimePathSummary!.length} />
      )}

      <p className="font-mono text-[0.65rem] text-stone-500">
        seed {result.seedUsed} · contract {result.contractVersion}
      </p>
    </section>
  );
}

function BalanceBandsPanel({
  bands,
  startAge,
}: {
  bands: NonNullable<MonteCarloResult["balancePercentilesByYear"]>;
  startAge: number;
}) {
  const rows = Object.entries(bands)
    .map(([key, values]) => {
      const match = /^p(\d+(?:\.\d+)?)$/i.exec(key);
      return match ? { key, percentile: Number(match[1]), values } : null;
    })
    .filter(
      (row): row is { key: string; percentile: number; values: number[] } =>
        row !== null && row.values.length > 0,
    )
    .sort((a, b) => a.percentile - b.percentile);
  if (rows.length === 0) return null;
  const horizonYears = Math.max(...rows.map((row) => row.values.length));
  const endAge = startAge + horizonYears - 1;
  return (
    <div className="space-y-2">
      <ChartHeading>Balance percentile bands</ChartHeading>
      <div className="overflow-x-auto border border-stone-200 p-3">
        <table className="w-full border-collapse font-mono text-[0.65rem] tabular-nums">
          <thead className="text-stone-500">
            <tr className="border-b border-stone-200 text-left">
              <th className="py-1 pr-3 font-normal">Band</th>
              <th className="py-1 pr-3 font-normal">Start</th>
              <th className="py-1 pr-3 font-normal">End age {endAge}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-stone-100">
                <td className="py-1 pr-3 uppercase">{row.key}</td>
                <td className="py-1 pr-3">{usd(row.values[0])}</td>
                <td className="py-1 pr-3">
                  {usd(row.values[row.values.length - 1])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportQualityPanel({ result }: { result: MonteCarloResult }) {
  if (
    !result.depletionStats &&
    !result.conditionalShortfall &&
    !result.runManifest
  ) {
    return null;
  }

  const stats = result.depletionStats;
  const shortfall = result.conditionalShortfall;
  const manifest = result.runManifest;
  const failedAgeP50 = stats?.depletionAgePercentiles?.p50;
  const failedYearP50 = stats?.depletionYearPercentiles.p50;

  return (
    <div className="space-y-3">
      <ChartHeading>Report quality diagnostics</ChartHeading>
      <div className="grid gap-3 md:grid-cols-3">
        {stats && (
          <div className="border border-stone-200 p-3">
            <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
              Depletion
            </div>
            <div className="mt-1 font-mono text-xl tabular-nums text-stone-900">
              {pct(stats.failedPathProbability)}
            </div>
            <p className="mt-1 font-mono text-[0.6rem] leading-relaxed text-stone-500">
              {stats.failedPathCount} failed paths · median{" "}
              {failedAgeP50 !== undefined
                ? `age ${maybeNumber(failedAgeP50)}`
                : `year ${maybeNumber(failedYearP50)}`}
            </p>
          </div>
        )}
        {shortfall && (
          <div className="border border-stone-200 p-3">
            <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
              Failed-path shortfall
            </div>
            <div className="mt-1 font-mono text-xl tabular-nums text-stone-900">
              {maybeUsd(shortfall.p50)}
            </div>
            <p className="mt-1 font-mono text-[0.6rem] leading-relaxed text-stone-500">
              p90 {maybeUsd(shortfall.p90)} · mean {usd(shortfall.mean)}
            </p>
          </div>
        )}
        {manifest && (
          <div className="border border-stone-200 p-3">
            <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
              Replay manifest
            </div>
            <div className="mt-1 font-mono text-xl tabular-nums text-stone-900">
              {manifest.engineVersion}
            </div>
            <p className="mt-1 font-mono text-[0.6rem] leading-relaxed text-stone-500">
              seed {manifest.seed} · paths {manifest.paths} · hash{" "}
              {shortHash(manifest.assumptionsHash)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MedianBalanceChart({
  series,
  startAge,
}: {
  series: MonteCarloResult["medianBalanceByYear"];
  startAge: number;
}) {
  if (series.length === 0) return null;

  const peak = Math.max(...series);
  const endAge = startAge + series.length - 1;

  return (
    <div className="space-y-2">
      <ChartHeading>Median balance by year</ChartHeading>
      <LineChart
        values={series}
        ariaLabel={`Median portfolio balance from age ${startAge} to ${endAge}, peaking at ${usd(peak)}.`}
        footer={{
          left: `age ${startAge}`,
          center: `peak ${usdCompact(peak)}`,
          right: `age ${endAge}`,
        }}
      />
    </div>
  );
}

function DepletionCurveChart({
  curve,
}: {
  curve: NonNullable<MonteCarloResult["depletionCurve"]>;
}) {
  if (curve.length === 0) return null;
  const values = curve.map((row) => row.depletionProbability);
  const first = curve[0];
  const last = curve[curve.length - 1];
  return (
    <div className="space-y-2">
      <ChartHeading>Depletion probability by year</ChartHeading>
      <LineChart
        values={values}
        forcedMax={1}
        ariaLabel={`Sticky depletion probability from projection year ${first.projectionYear} to ${last.projectionYear}.`}
        footer={{
          left:
            first.age !== undefined
              ? `age ${first.age}`
              : `year ${first.projectionYear}`,
          center: `terminal ${pct(last.depletionProbability)}`,
          right:
            last.age !== undefined
              ? `age ${last.age}`
              : `year ${last.projectionYear}`,
        }}
      />
    </div>
  );
}

function TerminalDistribution({
  bars,
  worst,
}: {
  bars: PercentileBar[];
  worst: number;
}) {
  if (bars.length === 0) return null;

  return (
    <div className="space-y-2">
      <ChartHeading>Terminal value distribution</ChartHeading>
      <div className="border border-stone-200 p-3">
        <div className="flex h-32 items-end gap-1">
          {bars.map((b) => (
            <div
              key={b.key}
              className="flex flex-1 flex-col items-center justify-end"
              title={`${b.key}: ${usd(b.value)}`}
            >
              <div
                className="w-full bg-stone-800"
                style={{ height: `${Math.max(b.heightFrac * 100, 1)}%` }}
                role="img"
                aria-label={`${b.key} terminal value ${usd(b.value)}`}
              />
              <span className="mt-1 font-mono text-[0.55rem] uppercase text-stone-500">
                {b.key}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[0.6rem] tabular-nums text-stone-500">
          worst path {usd(worst)}
        </p>
      </div>
    </div>
  );
}

function FirstDecadePanel({
  data,
}: {
  data: NonNullable<MonteCarloResult["firstDecadeReturnVsOutcome"]>;
}) {
  if (data.deciles.length === 0) return null;
  return (
    <div className="space-y-2">
      <ChartHeading>First-decade return vs outcome</ChartHeading>
      <div className="overflow-x-auto border border-stone-200 p-3">
        <p className="mb-2 font-mono text-[0.6rem] leading-relaxed text-stone-500">
          {data.years}-year median return: successful paths{" "}
          {maybePct(data.successfulMedianAnnualReturn)}, failed paths{" "}
          {maybePct(data.failedMedianAnnualReturn)}.
        </p>
        <table className="w-full border-collapse font-mono text-[0.65rem] tabular-nums">
          <thead className="text-stone-500">
            <tr className="border-b border-stone-200 text-left">
              <th className="py-1 pr-3 font-normal">Decile</th>
              <th className="py-1 pr-3 font-normal">Median return</th>
              <th className="py-1 pr-3 font-normal">Success</th>
              <th className="py-1 pr-3 font-normal">Paths</th>
            </tr>
          </thead>
          <tbody>
            {data.deciles.map((row) => (
              <tr key={row.decile} className="border-b border-stone-100">
                <td className="py-1 pr-3">D{row.decile}</td>
                <td className="py-1 pr-3">{pct(row.medianAnnualReturn)}</td>
                <td className="py-1 pr-3">{pct(row.successProbability)}</td>
                <td className="py-1 pr-3">{row.pathCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GuardrailPanel({
  result,
  startAge,
}: {
  result: MonteCarloResult;
  startAge: number;
}) {
  if (!result.guardrailStats || !result.guardrailActivity) return null;
  const stats = result.guardrailStats;
  return (
    <div className="space-y-2">
      <ChartHeading>Guardrail activity</ChartHeading>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border border-stone-200 p-3">
          <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
            Paths with cuts
          </div>
          <div className="mt-1 font-mono text-xl tabular-nums text-stone-900">
            {pct(result.guardrailActivity.pathsWithCut)}
          </div>
          <p className="mt-1 font-mono text-[0.6rem] text-stone-500">
            multiple cuts {pct(stats.pathsWithMultipleCuts)}
          </p>
        </div>
        <div className="border border-stone-200 p-3">
          <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
            Median cut count
          </div>
          <div className="mt-1 font-mono text-xl tabular-nums text-stone-900">
            {maybeNumber(stats.cutCountPercentiles.p50)}
          </div>
          <p className="mt-1 font-mono text-[0.6rem] text-stone-500">
            median raise count {maybeNumber(stats.raiseCountPercentiles.p50)}
          </p>
        </div>
        <div className="border border-stone-200 p-3">
          <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
            First cut
          </div>
          <div className="mt-1 font-mono text-xl tabular-nums text-stone-900">
            {stats.firstCutAgePercentiles
              ? `age ${maybeNumber(stats.firstCutAgePercentiles.p50)}`
              : `year ${maybeNumber(stats.firstCutProjectionYearPercentiles.p50)}`}
          </div>
          <p className="mt-1 font-mono text-[0.6rem] text-stone-500">
            start age {startAge} · rule {result.withdrawalRule}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoalFundingPanel({ result }: { result: MonteCarloResult }) {
  const goals = result.goalFunding?.goals ?? [];
  if (goals.length === 0) return null;
  return (
    <div className="space-y-2">
      <ChartHeading>Goal funding</ChartHeading>
      <div className="overflow-x-auto border border-stone-200 p-3">
        <table className="w-full border-collapse font-mono text-[0.65rem] tabular-nums">
          <thead className="text-stone-500">
            <tr className="border-b border-stone-200 text-left">
              <th className="py-1 pr-3 font-normal">Goal</th>
              <th className="py-1 pr-3 font-normal">Requested</th>
              <th className="py-1 pr-3 font-normal">Fully funded</th>
              <th className="py-1 pr-3 font-normal">Avg. funded</th>
            </tr>
          </thead>
          <tbody>
            {goals.map((goal) => (
              <tr key={goal.id} className="border-b border-stone-100">
                <td className="py-1 pr-3">{goal.id}</td>
                <td className="py-1 pr-3">{usd(goal.requestedAmount)}</td>
                <td className="py-1 pr-3">
                  {pct(goal.fullyFundedProbability)}
                </td>
                <td className="py-1 pr-3">{pct(goal.averageFundedRatio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LtcShockPanel({ result }: { result: MonteCarloResult }) {
  if (!result.ltcShockImpact) return null;
  return (
    <div className="space-y-2">
      <ChartHeading>LTC shock impact</ChartHeading>
      <div className="border border-stone-200 p-3 font-mono text-[0.65rem] leading-relaxed text-stone-600">
        <div>
          Baseline success{" "}
          {pct(result.ltcShockImpact.baselineSuccessProbability)} → with shock{" "}
          {pct(result.ltcShockImpact.withShockSuccessProbability)} (
          {pct(result.ltcShockImpact.successProbabilityDelta)} delta).
        </div>
        <div>
          Self-insured probability{" "}
          {pct(result.ltcShockImpact.selfInsuredProbability)}
          {result.ltcShock
            ? ` · nominal LTC cost ${usd(result.ltcShock.nominalTotalCost)}`
            : ""}
        </div>
      </div>
    </div>
  );
}

function RegimePath({
  runs,
  totalYears,
}: {
  runs: RegimeRun[];
  totalYears: number;
}) {
  const present = [...new Set(runs.map((r) => r.regime))];

  return (
    <div className="space-y-2">
      <ChartHeading>Regime path</ChartHeading>
      <div className="border border-stone-200 p-3">
        <div
          className="flex h-4 w-full overflow-hidden"
          role="img"
          aria-label={`Regime path over ${totalYears} years: ${runs
            .map((r) => `${REGIME_META[r.regime].label} ${r.years}y`)
            .join(", ")}.`}
        >
          {runs.map((r, i) => (
            <div
              key={i}
              title={`${REGIME_META[r.regime].label}: ${r.years} yr from year ${r.startYear}`}
              style={{
                width: `${(r.years / totalYears) * 100}%`,
                backgroundColor: REGIME_META[r.regime].color,
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {present.map((regime) => (
            <span
              key={regime}
              className="flex items-center gap-1 font-mono text-[0.6rem] text-stone-500"
            >
              <span
                className="inline-block h-2 w-2"
                style={{ backgroundColor: REGIME_META[regime].color }}
              />
              {REGIME_META[regime].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
