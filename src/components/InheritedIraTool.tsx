// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateInheritedIra } from "./tool-validation";
import { ResultShell } from "./result-shell";
import {
  Card,
  Empty,
  Field,
  NumberInput,
  Select,
  SectionHeader,
  IssueList,
  RunButton,
} from "./form-controls";
import { usd, pct } from "./format";
import type {
  FilingStatus,
  InheritedIraAnalysisResult,
  InheritedIraBeneficiaryType,
} from "../contract/planning";

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_joint", label: "Married - joint" },
  { value: "married_separate", label: "Married - separate" },
  { value: "head_of_household", label: "Head of household" },
];

const BENEFICIARY_TYPES: {
  value: InheritedIraBeneficiaryType;
  label: string;
}[] = [
  { value: "other_designated_beneficiary", label: "Designated beneficiary" },
  { value: "spouse", label: "Spouse" },
  { value: "minor_child_of_decedent", label: "Minor child of decedent" },
  { value: "disabled", label: "Disabled" },
  { value: "chronically_ill", label: "Chronically ill" },
  {
    value: "not_more_than_10_years_younger",
    label: "Not >10 years younger",
  },
  { value: "non_designated_beneficiary", label: "Non-designated" },
];

function replaceAt<T>(arr: T[], i: number, next: T): T[] {
  return arr.map((x, j) => (j === i ? next : x));
}

function removeAt<T>(arr: T[], i: number): T[] {
  return arr.filter((_, j) => j !== i);
}

export function InheritedIraForm() {
  const {
    inheritedIraInputs: i,
    setInheritedIraInputs,
    setInheritedIraResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateInheritedIra(i);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setInheritedIraResult(
        await planning.inheritedIraAnalysis({
          inheritedBalance: i.inheritedBalance,
          beneficiaryOrdinaryIncome: i.beneficiaryOrdinaryIncome,
          ...(i.beneficiaryOrdinaryIncomeByYear.length > 0
            ? {
                beneficiaryOrdinaryIncomeByYear:
                  i.beneficiaryOrdinaryIncomeByYear,
              }
            : {}),
          filingStatus: i.filingStatus,
          taxYear: i.taxYear,
          yearsRemaining: i.yearsRemaining,
          annualReturn: i.annualReturn,
          taxableDistributionRatio: i.taxableDistributionRatio,
          beneficiaryType: i.beneficiaryType,
          beneficiaryAge: i.beneficiaryAge,
          decedentAge: i.decedentAge,
          targetRate: i.targetRate,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function addIncomeYear() {
    setInheritedIraInputs({
      beneficiaryOrdinaryIncomeByYear: [
        ...i.beneficiaryOrdinaryIncomeByYear,
        i.beneficiaryOrdinaryIncome,
      ],
    });
  }

  function updateIncomeYear(index: number, value: number) {
    setInheritedIraInputs({
      beneficiaryOrdinaryIncomeByYear: replaceAt(
        i.beneficiaryOrdinaryIncomeByYear,
        index,
        value,
      ),
    });
  }

  function removeIncomeYear(index: number) {
    setInheritedIraInputs({
      beneficiaryOrdinaryIncomeByYear: removeAt(
        i.beneficiaryOrdinaryIncomeByYear,
        index,
      ),
    });
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Inherited IRA
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Inherited balance">
          <NumberInput
            value={i.inheritedBalance}
            onChange={(v) => setInheritedIraInputs({ inheritedBalance: v })}
          />
        </Field>
        <Field label="Ordinary income">
          <NumberInput
            value={i.beneficiaryOrdinaryIncome}
            onChange={(v) =>
              setInheritedIraInputs({ beneficiaryOrdinaryIncome: v })
            }
          />
        </Field>
        <Field label="Tax year">
          <NumberInput
            value={i.taxYear}
            onChange={(v) => setInheritedIraInputs({ taxYear: v })}
          />
        </Field>
        <Field label="Years remaining">
          <NumberInput
            value={i.yearsRemaining}
            onChange={(v) => setInheritedIraInputs({ yearsRemaining: v })}
          />
        </Field>
        <Field label="Annual return">
          <NumberInput
            step={0.005}
            value={i.annualReturn}
            onChange={(v) => setInheritedIraInputs({ annualReturn: v })}
          />
        </Field>
        <Field label="Taxable ratio">
          <NumberInput
            step={0.01}
            value={i.taxableDistributionRatio}
            onChange={(v) =>
              setInheritedIraInputs({ taxableDistributionRatio: v })
            }
          />
        </Field>
        <Field label="Target rate">
          <NumberInput
            step={0.01}
            value={i.targetRate}
            onChange={(v) => setInheritedIraInputs({ targetRate: v })}
          />
        </Field>
        <Field label="Filing status">
          <Select
            value={i.filingStatus}
            onChange={(v) =>
              setInheritedIraInputs({ filingStatus: v as FilingStatus })
            }
            options={FILING_STATUSES}
          />
        </Field>
        <Field label="Beneficiary age">
          <NumberInput
            value={i.beneficiaryAge}
            onChange={(v) => setInheritedIraInputs({ beneficiaryAge: v })}
          />
        </Field>
        <Field label="Decedent age">
          <NumberInput
            value={i.decedentAge}
            onChange={(v) => setInheritedIraInputs({ decedentAge: v })}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Beneficiary type">
            <Select
              value={i.beneficiaryType}
              onChange={(v) =>
                setInheritedIraInputs({
                  beneficiaryType: v as InheritedIraBeneficiaryType,
                })
              }
              options={BENEFICIARY_TYPES}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="Year-by-year income"
          addLabel="year"
          onAdd={addIncomeYear}
        />
        {i.beneficiaryOrdinaryIncomeByYear.length === 0 && (
          <Empty>Uses the single ordinary-income value for every year.</Empty>
        )}
        {i.beneficiaryOrdinaryIncomeByYear.map((value, index) => (
          <Card key={index} onRemove={() => removeIncomeYear(index)}>
            <Field label={`Year ${index + 1} ordinary income`}>
              <NumberInput
                value={value}
                onChange={(v) => updateIncomeYear(index, v)}
              />
            </Field>
          </Card>
        ))}
      </div>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Run inherited IRA analysis"
      />
    </section>
  );
}

export function InheritedIraResults() {
  const { inheritedIraResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No inherited IRA analysis yet. Enter de-identified numeric assumptions and run the comparison."
    >
      {result && <InheritedIraPanel result={result} />}
    </ResultShell>
  );
}

function InheritedIraPanel({ result }: { result: InheritedIraAnalysisResult }) {
  const top = result.strategyRankings[0];
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      {top && (
        <div className="border border-stone-900 p-4">
          <div className="font-mono text-[0.65rem] uppercase tracking-wider text-stone-500">
            Highest after-tax strategy
          </div>
          <div className="mt-1 font-mono text-2xl tabular-nums text-stone-900">
            {top.strategy.replaceAll("_", " ")}
          </div>
          <p className="mt-1 font-mono text-[0.65rem] tabular-nums text-stone-500">
            {usd(top.netAfterTaxReceived)} after tax ·{" "}
            {usd(top.totalIncrementalFederalTax)} incremental federal tax
          </p>
        </div>
      )}

      <div className="overflow-hidden border border-stone-200">
        <table className="w-full border-collapse font-mono text-[0.65rem]">
          <thead className="bg-stone-50 text-stone-500">
            <tr>
              <th className="px-2 py-1 text-left font-normal">Rank</th>
              <th className="px-2 py-1 text-left font-normal">Strategy</th>
              <th className="px-2 py-1 text-right font-normal">After tax</th>
              <th className="px-2 py-1 text-right font-normal">Fed tax</th>
              <th className="px-2 py-1 text-right font-normal">Peak rate</th>
            </tr>
          </thead>
          <tbody>
            {result.strategyRankings.map((row) => (
              <tr key={row.strategy} className="border-t border-stone-200">
                <td className="px-2 py-1 text-stone-500">{row.rank}</td>
                <td className="px-2 py-1 text-stone-700">
                  {row.strategy.replaceAll("_", " ")}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-stone-700">
                  {usd(row.netAfterTaxReceived)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-stone-700">
                  {usd(row.totalIncrementalFederalTax)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-stone-700">
                  {pct(row.peakMarginalOrdinaryRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 border border-stone-200 p-3">
        <p className="font-mono text-[0.65rem] text-stone-700">
          {result.beneficiaryClassification.label} ·{" "}
          {result.beneficiaryClassification.eligibleDesignatedBeneficiary
            ? "eligible designated beneficiary"
            : "10-year comparison context"}
        </p>
        <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
          {result.assumptions.taxScope}; {result.assumptions.annualRmdScope}
        </p>
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · tax table {result.taxTableVersion}
      </p>
    </section>
  );
}
