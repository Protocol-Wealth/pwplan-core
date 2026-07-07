// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import type { HistoricalBlendRequest } from "../contract/planning";
import type { HistoricalBlendInputs } from "../store/scenario";
import { parseIdList } from "./tool-validation";

export function historicalBlendAssetIds(
  inputs: HistoricalBlendInputs,
): string[] {
  const ids = parseIdList(inputs.assetClassIdsText);
  return ids.length > 0
    ? ids
    : Object.keys(inputs.weights)
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
}

export function buildHistoricalBlendRequest(
  inputs: HistoricalBlendInputs,
): Omit<HistoricalBlendRequest, "contractVersion"> {
  const ids = historicalBlendAssetIds(inputs);
  const weights = ids.reduce<Record<string, number>>((selected, id) => {
    selected[id] = inputs.weights[id] ?? 0;
    return selected;
  }, {});
  const asOf = inputs.asOf.trim();
  return {
    ...(ids.length > 0 ? { assetClassIds: ids } : {}),
    weights,
    lookbackDays: inputs.lookbackDays,
    ...(asOf.length > 0 ? { asOf } : {}),
    rebalanceFrequency: inputs.rebalanceFrequency,
    initialValue: inputs.initialValue,
  };
}
