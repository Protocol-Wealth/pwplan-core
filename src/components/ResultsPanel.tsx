import { useScenario } from "../store/scenario";
import {
  seriesGeometry,
  percentileBars,
  regimeRuns,
  type PercentileBar,
  type RegimeRun,
} from "./results-viz";
import type { MonteCarloResult, Regime } from "../contract/planning";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const usdCompact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Muted palette + display label per EMF regime. */
const REGIME_META: Record<Regime, { label: string; color: string }> = {
  expansion: { label: "Expansion", color: "#4d7c0f" },
  inflationary: { label: "Inflationary", color: "#b45309" },
  deflationary: { label: "Deflationary", color: "#0369a1" },
  stagflation: { label: "Stagflation", color: "#9f1239" },
  crisis: { label: "Crisis", color: "#7f1d1d" },
};

export function ResultsPanel() {
  const { result, error, running, inputs } = useScenario();

  if (error) {
    return (
      <section className="border border-red-300 bg-red-50 p-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-red-600">
          Engine error
        </h2>
        <p className="mt-2 font-mono text-sm text-red-800">{error}</p>
      </section>
    );
  }

  if (running) {
    return (
      <section className="border border-stone-200 p-4">
        <p className="font-mono text-sm text-stone-500">Awaiting nexus-core…</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="border border-dashed border-stone-300 p-4">
        <p className="font-mono text-sm text-stone-400">
          No result yet. Configure a scenario and run the simulation.
        </p>
      </section>
    );
  }

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
      </div>

      <MedianBalanceChart
        series={result.medianBalanceByYear}
        startAge={inputs.currentAge}
      />

      <TerminalDistribution bars={bars} worst={result.worstPathTerminal} />

      {runs.length > 0 && (
        <RegimePath runs={runs} totalYears={result.regimePathSummary!.length} />
      )}

      <p className="font-mono text-[0.65rem] text-stone-400">
        seed {result.seedUsed} · contract {result.contractVersion}
      </p>
    </section>
  );
}

function ChartHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
      {children}
    </h3>
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

  const W = 300;
  const H = 120;
  const geo = seriesGeometry(series, W, H);
  const peak = geo.domainMax;
  const endAge = startAge + series.length - 1;

  return (
    <div className="space-y-2">
      <ChartHeading>Median balance by year</ChartHeading>
      <div className="border border-stone-200 p-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Median portfolio balance from age ${startAge} to ${endAge}, peaking at ${usd(peak)}.`}
        >
          <path d={geo.areaPath} fill="#1c1917" fillOpacity={0.06} />
          <polyline
            points={geo.polyline}
            fill="none"
            stroke="#1c1917"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="mt-2 flex justify-between font-mono text-[0.6rem] tabular-nums text-stone-400">
          <span>age {startAge}</span>
          <span>peak {usdCompact(peak)}</span>
          <span>age {endAge}</span>
        </div>
      </div>
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
              <span className="mt-1 font-mono text-[0.55rem] uppercase text-stone-400">
                {b.key}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[0.6rem] tabular-nums text-stone-400">
          worst path {usd(worst)}
        </p>
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
