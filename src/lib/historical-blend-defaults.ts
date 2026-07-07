// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import type { HistoricalBlendInputs } from "../store/scenario";

export const DEFAULT_HISTORICAL_BLEND_INPUTS: HistoricalBlendInputs = {
  assetClassIdsText: "us_equity, us_bonds",
  weights: { us_equity: 0.6, us_bonds: 0.4 },
  lookbackDays: 3650,
  asOf: "",
  rebalanceFrequency: "annual",
  initialValue: 1,
};
