/**
 * results-viz — pure geometry helpers for the results charts.
 *
 * This is PRESENTATION math only: it turns an engine result into SVG/CSS
 * coordinates and proportions. It contains zero quant/financial logic — the
 * numbers it shapes were computed by nexus-core. Kept dependency-free (no chart
 * library) to honor the "stay lean" constraint, and pure so it is unit-testable
 * independently of React.
 */

import type { Regime } from "../contract/planning";

/** Round to `dp` decimals so SVG strings stay tidy and tests stay deterministic. */
function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export interface SeriesPoint {
  x: number;
  y: number;
}

export interface SeriesGeometry {
  points: SeriesPoint[];
  /** "x,y x,y …" for an SVG <polyline>. */
  polyline: string;
  /** Closed area under the line, for an SVG <path> fill. */
  areaPath: string;
  /** Y domain actually used (0-based for non-negative series). */
  domainMin: number;
  domainMax: number;
}

/**
 * Map a value series to SVG coordinates in a `width`×`height` box. The Y domain
 * is 0-based for non-negative data (the honest baseline for a balance that can
 * deplete to zero); it extends below zero only if the data does. Origin is
 * top-left (SVG convention), so larger values sit higher (smaller y).
 *
 * `forcedMax` pins the top of the Y domain (e.g. 1 for a 0–1 weight series) so
 * the chart shows the value against a fixed scale rather than its own peak. The
 * caller is responsible for passing data that does not exceed it; a value above
 * `forcedMax` simply maps above the box (negative y).
 */
export function seriesGeometry(
  values: number[],
  width: number,
  height: number,
  forcedMax?: number,
): SeriesGeometry {
  if (values.length === 0) {
    return {
      points: [],
      polyline: "",
      areaPath: "",
      domainMin: 0,
      domainMax: forcedMax ?? 0,
    };
  }
  const domainMax = forcedMax ?? Math.max(...values);
  const domainMin = Math.min(0, ...values);
  const span = domainMax - domainMin || 1;
  const n = values.length;

  const points: SeriesPoint[] = values.map((v, i) => ({
    x: round(n === 1 ? width / 2 : (i / (n - 1)) * width),
    y: round(height - ((v - domainMin) / span) * height),
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const baseline = round(height);
  const areaPath =
    `M ${first.x},${baseline} ` +
    points.map((p) => `L ${p.x},${p.y}`).join(" ") +
    ` L ${last.x},${baseline} Z`;

  return { points, polyline, areaPath, domainMin, domainMax };
}

export interface PercentileBar {
  /** Original key, e.g. "p50". */
  key: string;
  /** Numeric percentile parsed from the key, e.g. 50. */
  percentile: number;
  value: number;
  /** Bar height as a fraction of the largest value, in [0, 1]. */
  heightFrac: number;
}

/**
 * Turn a `{ "p10": …, "p50": … }` terminal-value map into ascending-percentile
 * bars with heights normalized to the largest value. Keys that are not of the
 * form `p<number>` are ignored. An empty or all-zero map yields zero-height bars.
 */
export function percentileBars(
  terminalValues: Record<string, number>,
): PercentileBar[] {
  const entries = Object.entries(terminalValues)
    .map(([key, value]) => {
      const m = /^p(\d+(?:\.\d+)?)$/i.exec(key);
      return m ? { key, percentile: Number(m[1]), value } : null;
    })
    .filter(
      (e): e is { key: string; percentile: number; value: number } =>
        e !== null,
    )
    .sort((a, b) => a.percentile - b.percentile);

  const max = entries.reduce((m, e) => Math.max(m, e.value), 0);

  return entries.map((e) => ({
    ...e,
    heightFrac: max > 0 ? round(Math.max(0, e.value / max), 4) : 0,
  }));
}

export interface RegimeRun {
  regime: Regime;
  /** Number of consecutive years in this run. */
  years: number;
  /** Zero-based index of the year this run starts on. */
  startYear: number;
}

/** Collapse a per-year regime path into consecutive same-regime runs. */
export function regimeRuns(path: Regime[]): RegimeRun[] {
  const runs: RegimeRun[] = [];
  for (let i = 0; i < path.length; i++) {
    const last = runs[runs.length - 1];
    if (last && last.regime === path[i]) {
      last.years += 1;
    } else {
      runs.push({ regime: path[i], years: 1, startYear: i });
    }
  }
  return runs;
}

export interface AgeWeightSeries {
  /** Ages in ascending numeric order. */
  ages: number[];
  /** Weights aligned to `ages` (same index). */
  weights: number[];
}

/**
 * Turn a `{ "65": 0.6, "66": 0.58, … }` age→weight map (e.g. a glide path's
 * equityWeightByAge) into ascending-by-age parallel arrays. Keys that are not
 * finite numbers are ignored. Sorts numerically, so "9" precedes "10".
 */
export function ageWeightSeries(
  byAge: Record<string, number>,
): AgeWeightSeries {
  const entries = Object.entries(byAge)
    .map(([age, weight]) => [Number(age), weight] as const)
    .filter(([age]) => Number.isFinite(age))
    .sort((a, b) => a[0] - b[0]);
  return {
    ages: entries.map((e) => e[0]),
    weights: entries.map((e) => e[1]),
  };
}
