// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateRoth } from "./tool-validation";
import { ResultShell } from "./result-shell";
import {
  Field,
  NumberInput,
  Select,
  IssueList,
  RunButton,
} from "./form-controls";
import { usd, pct } from "./format";
import type { FilingStatus, RothConversionResult } from "../contract/planning";

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_joint", label: "Married — joint" },
  { value: "married_separate", label: "Married — separate" },
  { value: "head_of_household", label: "Head of household" },
];

export function RothConversionForm() {
  const {
    rothInputs: r,
    setRothInputs,
    setRothResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateRoth(r);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      const result = await planning.rothConversion({
        currentTaxableIncome: r.currentTaxableIncome,
        filingStatus: r.filingStatus,
        conversionAmount: r.conversionAmount,
        growthRate: r.growthRate,
        years: r.years,
        retirementMarginalRate: r.retirementMarginalRate,
        taxesPaidFromConversion: r.taxesPaidFromConversion,
      });
      setRothResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Roth conversion
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Current taxable income">
          <NumberInput
            value={r.currentTaxableIncome}
            onChange={(v) => setRothInputs({ currentTaxableIncome: v })}
          />
        </Field>
        <Field label="Filing status">
          <Select
            value={r.filingStatus}
            onChange={(v) => setRothInputs({ filingStatus: v as FilingStatus })}
            options={FILING_STATUSES}
          />
        </Field>
        <Field label="Conversion amount">
          <NumberInput
            value={r.conversionAmount}
            onChange={(v) => setRothInputs({ conversionAmount: v })}
          />
        </Field>
        <Field label="Years to withdrawal">
          <NumberInput
            value={r.years}
            onChange={(v) => setRothInputs({ years: v })}
          />
        </Field>
        <Field label="Growth rate">
          <NumberInput
            step={0.005}
            value={r.growthRate}
            onChange={(v) => setRothInputs({ growthRate: v })}
          />
        </Field>
        <Field label="Retirement marginal rate">
          <NumberInput
            step={0.01}
            value={r.retirementMarginalRate}
            onChange={(v) => setRothInputs({ retirementMarginalRate: v })}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={r.taxesPaidFromConversion}
          onChange={(e) =>
            setRothInputs({ taxesPaidFromConversion: e.target.checked })
          }
          className="h-4 w-4 accent-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        />
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-stone-500">
          Pay conversion tax from the converted amount
        </span>
      </label>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Compare conversion"
      />
    </section>
  );
}

export function RothConversionResults() {
  const { rothResult: result, error, running } = useScenario();

  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No conversion comparison yet. Set the inputs and compare."
    >
      {result && <RothPanel result={result} />}
    </ResultShell>
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

function RothPanel({ result }: { result: RothConversionResult }) {
  const favorsConvert = result.netBenefit > 0;
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div
        className={`border p-4 ${
          favorsConvert
            ? "border-emerald-300 bg-emerald-50"
            : "border-stone-300 bg-stone-50"
        }`}
      >
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Net benefit of converting
        </p>
        <p
          className={`font-mono text-2xl tabular-nums ${
            favorsConvert ? "text-emerald-700" : "text-stone-800"
          }`}
        >
          {favorsConvert ? "+" : ""}
          {usd(result.netBenefit)}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          Converting wins when your retirement rate exceeds{" "}
          <span className="text-stone-700">
            {pct(result.breakevenRetirementRate)}
          </span>{" "}
          (the effective conversion rate).
        </p>
      </div>

      <div>
        <Row
          label="Conversion tax (incremental)"
          value={usd(result.conversionTax)}
        />
        <Row
          label="Effective conversion rate"
          value={pct(result.effectiveConversionRate)}
        />
        <Row label="Roth seed" value={usd(result.rothSeed)} />
        <Row
          label="External tax paid today"
          value={usd(result.externalTaxPaidToday)}
        />
        <Row
          label="Converted (after-tax, terminal)"
          value={usd(result.convertedAfterTaxValue)}
        />
        <Row
          label="Not converted (after-tax, terminal)"
          value={usd(result.notConvertedAfterTaxValue)}
        />
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not tax advice
      </p>
    </section>
  );
}
