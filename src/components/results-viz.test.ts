// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, it, expect } from "vitest";
import {
  seriesGeometry,
  percentileBars,
  regimeRuns,
  ageWeightSeries,
} from "./results-viz";
import type { Regime } from "../contract/planning";

describe("seriesGeometry", () => {
  it("returns an empty geometry for no data", () => {
    const g = seriesGeometry([], 100, 50);
    expect(g.points).toEqual([]);
    expect(g.polyline).toBe("");
    expect(g.areaPath).toBe("");
  });

  it("centers a single point horizontally", () => {
    const g = seriesGeometry([42], 100, 50);
    expect(g.points).toHaveLength(1);
    expect(g.points[0].x).toBe(50);
  });

  it("spans the full width and uses a 0-based domain for non-negative data", () => {
    const g = seriesGeometry([0, 50, 100], 100, 50);
    expect(g.domainMin).toBe(0);
    expect(g.domainMax).toBe(100);
    // First point at x=0, last at x=width.
    expect(g.points[0].x).toBe(0);
    expect(g.points[2].x).toBe(100);
    // Largest value sits at the top (y=0), zero at the bottom (y=height).
    expect(g.points[0].y).toBe(50);
    expect(g.points[2].y).toBe(0);
    // Midpoint is halfway.
    expect(g.points[1].y).toBe(25);
  });

  it("extends the domain below zero only when data is negative", () => {
    const g = seriesGeometry([-50, 50], 100, 100);
    expect(g.domainMin).toBe(-50);
    expect(g.domainMax).toBe(50);
    // -50 maps to the bottom, 50 to the top.
    expect(g.points[0].y).toBe(100);
    expect(g.points[1].y).toBe(0);
  });

  it("builds a closed area path anchored to the baseline", () => {
    const g = seriesGeometry([10, 20], 100, 50);
    // Baseline is the box bottom (y = height); the area opens and closes there.
    expect(g.areaPath.startsWith("M 0,50 ")).toBe(true);
    expect(g.areaPath.endsWith("Z")).toBe(true);
    // 0-based domain [0,20]: value 10 -> vertical midpoint (y=25), 20 -> top (y=0).
    expect(g.polyline).toBe("0,25 100,0");
  });

  it("does not divide by zero for a flat series", () => {
    const g = seriesGeometry([100, 100, 100], 100, 50);
    expect(g.points.every((p) => Number.isFinite(p.y))).toBe(true);
  });
});

describe("percentileBars", () => {
  it("orders by percentile and normalizes heights to the max", () => {
    const bars = percentileBars({ p50: 500, p10: 100, p90: 1000 });
    expect(bars.map((b) => b.percentile)).toEqual([10, 50, 90]);
    expect(bars.map((b) => b.heightFrac)).toEqual([0.1, 0.5, 1]);
  });

  it("ignores keys that are not p<number>", () => {
    const bars = percentileBars({ p25: 1, mean: 999, foo: 5 });
    expect(bars.map((b) => b.key)).toEqual(["p25"]);
  });

  it("yields zero-height bars when every value is zero", () => {
    const bars = percentileBars({ p10: 0, p90: 0 });
    expect(bars.map((b) => b.heightFrac)).toEqual([0, 0]);
  });

  it("parses decimal percentile keys like p99.5", () => {
    // Tail percentiles (p99.5, p0.5) are intentionally supported by the regex.
    const bars = percentileBars({ "p99.5": 1000, p50: 500 });
    expect(bars.map((b) => b.percentile)).toEqual([50, 99.5]);
  });

  it("returns nothing for an empty map", () => {
    expect(percentileBars({})).toEqual([]);
  });
});

describe("regimeRuns", () => {
  const E: Regime = "expansion";
  const C: Regime = "crisis";

  it("collapses consecutive same-regime years into runs", () => {
    const runs = regimeRuns([E, E, C, C, C, E]);
    expect(runs).toEqual([
      { regime: "expansion", years: 2, startYear: 0 },
      { regime: "crisis", years: 3, startYear: 2 },
      { regime: "expansion", years: 1, startYear: 5 },
    ]);
  });

  it("collapses a uniform single-regime path to one run", () => {
    expect(regimeRuns([E, E, E])).toEqual([
      { regime: "expansion", years: 3, startYear: 0 },
    ]);
  });

  it("returns nothing for an empty path", () => {
    expect(regimeRuns([])).toEqual([]);
  });

  it("preserves total length across runs", () => {
    const path: Regime[] = [E, C, C, E, E, E];
    const total = regimeRuns(path).reduce((s, r) => s + r.years, 0);
    expect(total).toBe(path.length);
  });
});

describe("seriesGeometry forcedMax", () => {
  it("pins the top of the domain to forcedMax", () => {
    // Weights 0..0.5 against a fixed 0..1 domain: 0.5 sits at the vertical
    // midpoint (y=50 in a height-100 box), not at the top.
    const g = seriesGeometry([0, 0.5], 100, 100, 1);
    expect(g.domainMax).toBe(1);
    expect(g.points[0].y).toBe(100);
    expect(g.points[1].y).toBe(50);
  });

  it("reports forcedMax even for an empty series", () => {
    expect(seriesGeometry([], 100, 100, 1).domainMax).toBe(1);
  });
});

describe("ageWeightSeries", () => {
  it("sorts numerically by age and aligns weights", () => {
    const s = ageWeightSeries({ "65": 0.6, "9": 0.9, "10": 0.8 });
    expect(s.ages).toEqual([9, 10, 65]);
    expect(s.weights).toEqual([0.9, 0.8, 0.6]);
  });

  it("ignores non-numeric keys", () => {
    const s = ageWeightSeries({ "65": 0.6, asOf: 0.1 });
    expect(s.ages).toEqual([65]);
    expect(s.weights).toEqual([0.6]);
  });

  it("returns empty arrays for an empty map", () => {
    expect(ageWeightSeries({})).toEqual({ ages: [], weights: [] });
  });
});
