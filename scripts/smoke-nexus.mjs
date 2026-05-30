#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * smoke-nexus — opt-in live smoke test against the public nexus-core MCP engine.
 *
 * This is NOT part of the gate suite and is NEVER run in CI: the public engine
 * (nexusmcp.site) may be down or mid-build, and a flaky external dependency must
 * not gate this repo. The deterministic, offline contract coverage lives in
 * src/lib/planning-gateway.test.ts. Run this by hand when you want to confirm a
 * real round-trip:
 *
 *   node scripts/smoke-nexus.mjs
 *   PLANNING_GATEWAY_URL=https://staging.nexusmcp.site node scripts/smoke-nexus.mjs
 *
 * It posts the UI's default, PII-FREE scenario (ages + balances only — no name,
 * DOB, SSN, email, phone, or address) to monte_carlo_decumulation and checks the
 * response carries the load-bearing fields the UI renders. Dependency-free:
 * global fetch (Node 18+). Exit 0 = healthy round-trip, non-zero = problem.
 */

const CONTRACT_VERSION = "0.1.0";
const GATEWAY_URL = process.env.PLANNING_GATEWAY_URL ?? "https://nexusmcp.site";
const TOOL = "monte_carlo_decumulation";

// Mirrors store/scenario.ts DEFAULT_INPUTS — the out-of-box demo scenario.
// PII-free by construction: every field is a derived planning variable.
const payload = {
  contractVersion: CONTRACT_VERSION,
  currentAge: 45,
  horizonAge: 95,
  accounts: [
    {
      type: "traditional",
      balance: 1_200_000,
      allocation: { us_equity: 0.6, us_bonds: 0.4 },
    },
    {
      type: "roth",
      balance: 300_000,
      allocation: { us_equity: 0.8, us_bonds: 0.2 },
    },
  ],
  assetClasses: [
    {
      id: "us_equity",
      label: "US Equity",
      expectedReturn: 0.07,
      volatility: 0.16,
      lambda: 0.35,
    },
    {
      id: "us_bonds",
      label: "US Bonds",
      expectedReturn: 0.03,
      volatility: 0.05,
      lambda: 0.1,
    },
  ],
  annualSpend: 120_000,
  spendColaRate: 0.025,
  guaranteedIncome: [
    {
      label: "Social Security",
      annualAmount: 42_000,
      startAge: 67,
      colaRate: 0.02,
    },
  ],
  filingStatus: "married_joint",
  returnModel: "emf_regime",
  paths: 2_000,
  seed: 424242,
};

/** Fields the UI's ResultsPanel relies on; their absence breaks the demo. */
function checkShape(data) {
  const problems = [];
  if (data.contractVersion !== CONTRACT_VERSION) {
    problems.push(
      `contractVersion ${JSON.stringify(data.contractVersion)} != ${CONTRACT_VERSION}`,
    );
  }
  if (typeof data.successProbability !== "number") {
    problems.push("successProbability missing or non-numeric");
  }
  if (!data.terminalValues || typeof data.terminalValues !== "object") {
    problems.push("terminalValues missing");
  }
  if (!Array.isArray(data.medianBalanceByYear)) {
    problems.push("medianBalanceByYear missing or not an array");
  } else {
    const expected = payload.horizonAge - payload.currentAge;
    if (data.medianBalanceByYear.length !== expected) {
      problems.push(
        `medianBalanceByYear length ${data.medianBalanceByYear.length} != horizonAge-currentAge (${expected})`,
      );
    }
  }
  if (typeof data.seedUsed !== "number") {
    problems.push("seedUsed missing or non-numeric");
  }
  return problems;
}

async function main() {
  const url = `${GATEWAY_URL}/mcp/tools/${TOOL}`;
  process.stdout.write(`→ POST ${url}\n`);

  const started = performance.now();
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pw-contract-version": CONTRACT_VERSION,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    process.stderr.write(
      `✗ network error: ${e instanceof Error ? e.message : e}\n`,
    );
    process.exit(2);
  }
  const ms = Math.round(performance.now() - started);

  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable>");
    process.stderr.write(`✗ HTTP ${res.status} after ${ms}ms: ${body}\n`);
    process.exit(3);
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    process.stderr.write(
      `✗ response was not JSON: ${e instanceof Error ? e.message : e}\n`,
    );
    process.exit(4);
  }

  const problems = checkShape(data);
  if (problems.length > 0) {
    process.stderr.write(`✗ response shape problems after ${ms}ms:\n`);
    for (const p of problems) process.stderr.write(`  - ${p}\n`);
    process.exit(5);
  }

  const regime = Array.isArray(data.regimePathSummary)
    ? `, ${data.regimePathSummary.length}-year regime path`
    : "";
  process.stdout.write(
    `✓ healthy round-trip in ${ms}ms — ` +
      `P(success)=${(data.successProbability * 100).toFixed(1)}%, ` +
      `${Object.keys(data.terminalValues).length} percentiles, ` +
      `${data.medianBalanceByYear.length} balance points${regime}, ` +
      `seedUsed=${data.seedUsed}\n`,
  );
  process.exit(0);
}

main();
