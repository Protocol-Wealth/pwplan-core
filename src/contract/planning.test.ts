// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PLANNING_CONTRACT_VERSION, PLANNING_TOOLS } from "./planning";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractSrc = readFileSync(join(__dirname, "planning.ts"), "utf8");

describe("planning contract", () => {
  it("exposes a semver contract version", () => {
    expect(PLANNING_CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("tool ids are stable snake_case strings", () => {
    for (const id of Object.values(PLANNING_TOOLS)) {
      expect(id).toMatch(/^[a-z][a-z0-9_]+$/);
    }
  });

  it("tool registry has no duplicate ids", () => {
    const ids = Object.values(PLANNING_TOOLS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exposes the current 21 public-safe wire tools", () => {
    expect(Object.values(PLANNING_TOOLS)).toHaveLength(21);
    expect(PLANNING_TOOLS.cashflowPlanningBridge).toBe(
      "cashflow_planning_bridge",
    );
    expect(PLANNING_TOOLS.cashReserveAnalysis).toBe("cash_reserve_analysis");
    expect(PLANNING_TOOLS.budgetPacingProjection).toBe(
      "budget_pacing_projection",
    );
  });
});

describe("PII-free invariant", () => {
  // Property declarations are indented and begin the line; comment lines begin
  // with `*` or `/` after whitespace, so they are not matched.
  const FORBIDDEN = [
    "name",
    "firstName",
    "lastName",
    "dob",
    "dateOfBirth",
    "ssn",
    "email",
    "phone",
    "address",
    "streetAddress",
  ];

  for (const word of FORBIDDEN) {
    it(`contract declares no '${word}' field`, () => {
      const re = new RegExp(`^[ \\t]+${word}\\??:`, "mi");
      expect(re.test(contractSrc)).toBe(false);
    });
  }

  const RAW_FINANCE_FIELDS = [
    "merchantOriginal",
    "accountOriginal",
    "originalStatement",
    "notes",
    "rawJson",
    "ownerName",
    "transaction",
    "transactions",
    "csv",
  ];

  for (const word of RAW_FINANCE_FIELDS) {
    it(`contract declares no raw-ingestion '${word}' field`, () => {
      const re = new RegExp(`^[ \\t]+${word}\\??:`, "mi");
      expect(re.test(contractSrc)).toBe(false);
    });
  }
});
