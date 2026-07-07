// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { describe, expect, it } from "vitest";
import {
  buildHistoricalBlendRequest,
  historicalBlendAssetIds,
} from "./historical-blend-request";
import { DEFAULT_HISTORICAL_BLEND_INPUTS } from "../lib/historical-blend-defaults";

describe("historicalBlendAssetIds", () => {
  it("uses explicit ids when present", () => {
    expect(
      historicalBlendAssetIds({
        ...DEFAULT_HISTORICAL_BLEND_INPUTS,
        assetClassIdsText: "us_equity, us_bonds",
      }),
    ).toEqual(["us_equity", "us_bonds"]);
  });

  it("falls back to weight keys when id text is blank", () => {
    expect(
      historicalBlendAssetIds({
        ...DEFAULT_HISTORICAL_BLEND_INPUTS,
        assetClassIdsText: "",
      }),
    ).toEqual(["us_equity", "us_bonds"]);
  });

  it("trims and filters blank weight keys when id text is blank", () => {
    expect(
      historicalBlendAssetIds({
        ...DEFAULT_HISTORICAL_BLEND_INPUTS,
        assetClassIdsText: "",
        weights: { " us_equity ": 0.6, " ": 0.1, us_bonds: 0.4 },
      }),
    ).toEqual(["us_equity", "us_bonds"]);
  });
});

describe("buildHistoricalBlendRequest", () => {
  it("maps UI state to the historical_blend contract", () => {
    expect(
      buildHistoricalBlendRequest({
        ...DEFAULT_HISTORICAL_BLEND_INPUTS,
        asOf: "2026-07-07",
      }),
    ).toEqual({
      assetClassIds: ["us_equity", "us_bonds"],
      weights: { us_equity: 0.6, us_bonds: 0.4 },
      lookbackDays: 3650,
      asOf: "2026-07-07",
      rebalanceFrequency: "annual",
      initialValue: 1,
    });
  });

  it("omits blank optional as-of date", () => {
    expect(
      buildHistoricalBlendRequest(DEFAULT_HISTORICAL_BLEND_INPUTS),
    ).not.toHaveProperty("asOf");
  });
});
