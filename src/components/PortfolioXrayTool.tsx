// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validatePortfolioXray } from "./tool-validation";
import { ResultShell } from "./result-shell";
import { IssueList, RunButton } from "./form-controls";
import { pct } from "./format";
import type {
  PortfolioXrayResult,
  XrayFinding,
  XraySeverity,
} from "../contract/planning";

export function PortfolioXrayForm() {
  const { inputs, setXrayResult, setRunning, setError, running } =
    useScenario();

  const issues = validatePortfolioXray(inputs.assetClasses, inputs.accounts);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setXrayResult(
        await planning.portfolioXray({
          assetClasses: inputs.assetClasses,
          accounts: inputs.accounts,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Portfolio X-ray
      </h2>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Regime-aware structural diagnostics for the shared Monte Carlo portfolio
        ({inputs.assetClasses.length} asset classes, {inputs.accounts.length}{" "}
        accounts): concentration, tax-location spread, and — the differentiator
        — EMF regime sensitivity measured against the <em>live</em> regime.
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Run X-ray"
      />
    </section>
  );
}

export function PortfolioXrayResults() {
  const { xrayResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No X-ray yet. It analyzes the Monte Carlo portfolio — set that up and run."
    >
      {result && <XrayPanel result={result} />}
    </ResultShell>
  );
}

const SEVERITY_STYLE: Record<XraySeverity, string> = {
  alert: "border-red-300 bg-red-50 text-red-800",
  warn: "border-amber-300 bg-amber-50 text-amber-800",
  info: "border-stone-300 bg-stone-50 text-stone-700",
};

function Finding({ finding }: { finding: XrayFinding }) {
  return (
    <div
      className={`border border-l-4 p-3 ${SEVERITY_STYLE[finding.severity]}`}
    >
      <p className="font-mono text-[0.7rem] uppercase tracking-wider">
        {finding.severity} · {finding.title}
      </p>
      <p className="mt-1 font-mono text-[0.65rem] leading-relaxed">
        {finding.detail}
      </p>
    </div>
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

function XrayPanel({ result }: { result: PortfolioXrayResult }) {
  const c = result.concentration;
  const m = result.accountMix;
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Live regime
        </p>
        <p className="font-mono text-2xl text-stone-800">{result.regime}</p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          Findings below are conditioned on this regime.
        </p>
      </div>

      <div className="space-y-2">
        {result.findings.map((f) => (
          <Finding key={f.id} finding={f} />
        ))}
      </div>

      <div>
        <Row
          label="Weighted expected return"
          value={pct(result.weightedExpectedReturn)}
        />
        <Row
          label="Weighted-avg volatility"
          value={pct(result.weightedAvgVolatility)}
        />
        <Row
          label="Portfolio λ (regime sensitivity)"
          value={result.portfolioLambda.toFixed(2)}
        />
        <Row label="Growth sleeve" value={pct(result.growthAllocation)} />
        <Row
          label="Concentration"
          value={`${c.maxWeightAsset} ${pct(c.maxWeight)} · eff. holdings ${c.effectiveHoldings}`}
        />
        <Row
          label="Account mix"
          value={`Txbl ${pct(m.taxable)} · Trad ${pct(m.traditional)} · Roth ${pct(m.roth)}`}
        />
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </section>
  );
}
