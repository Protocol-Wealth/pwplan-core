// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateIncomeLayering } from "./tool-validation";
import { buildIncomeLayeringRequest } from "./income-layering-request";
import { ResultShell } from "./result-shell";
import {
  Card,
  Empty,
  Field,
  IssueList,
  NumberInput,
  RunButton,
  SectionHeader,
  Select,
  TextInput,
} from "./form-controls";
import { pct, usd, usdCompact } from "./format";
import type {
  AccountType,
  FilingStatus,
  IncomeLayer,
  IncomeLayeringResult,
} from "../contract/planning";

const FILING_STATUS_OPTIONS: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_joint", label: "Married - joint" },
  { value: "married_separate", label: "Married - separate" },
  { value: "head_of_household", label: "Head of household" },
];

const STREAM_KIND_OPTIONS = [
  { value: "pension", label: "Pension" },
  { value: "annuity", label: "Annuity" },
];

const ACCOUNT_LABEL: Record<AccountType, string> = {
  taxable: "Taxable",
  traditional: "Traditional",
  roth: "Roth",
};

const LAYER_COLORS = [
  "#1c1917",
  "#0369a1",
  "#047857",
  "#b45309",
  "#7c3aed",
  "#be123c",
] as const;

function layerLabel(source: string): string {
  return source
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceColor(source: string): string {
  let hash = 0;
  for (const char of source) hash += char.charCodeAt(0);
  return LAYER_COLORS[hash % LAYER_COLORS.length];
}

export function IncomeLayeringForm() {
  const {
    incomeLayeringInputs: i,
    inputs,
    setIncomeLayeringInputs,
    setIncomeLayeringResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateIncomeLayering(i, inputs.accounts);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setIncomeLayeringResult(
        await planning.incomeLayering(
          buildIncomeLayeringRequest(i, inputs.accounts),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function updateStream(
    index: number,
    patch: Partial<(typeof i.incomeStreams)[number]>,
  ) {
    setIncomeLayeringInputs({
      incomeStreams: i.incomeStreams.map((stream, streamIndex) =>
        streamIndex === index ? { ...stream, ...patch } : stream,
      ),
    });
  }

  function addStream() {
    setIncomeLayeringInputs({
      incomeStreams: [
        ...i.incomeStreams,
        {
          kind: "pension",
          annualAmount: 12_000,
          startAge: i.retirementAge,
          endAge: 0,
          colaRate: 0,
        },
      ],
    });
  }

  function removeStream(index: number) {
    setIncomeLayeringInputs({
      incomeStreams: i.incomeStreams.filter((_, streamIndex) => {
        return streamIndex !== index;
      }),
    });
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Income layering
      </h2>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Retirement-income timeline from de-identified assumptions: earned
        income, Social Security, pension or annuity streams, RMDs, and
        gap-filling withdrawals from the shared account buckets.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Current age">
          <NumberInput
            value={i.currentAge}
            onChange={(v) => setIncomeLayeringInputs({ currentAge: v })}
          />
        </Field>
        <Field label="Retirement age">
          <NumberInput
            value={i.retirementAge}
            onChange={(v) => setIncomeLayeringInputs({ retirementAge: v })}
          />
        </Field>
        <Field label="Terminal age">
          <NumberInput
            value={i.terminalAge}
            onChange={(v) => setIncomeLayeringInputs({ terminalAge: v })}
          />
        </Field>
        <Field label="Annual spending target">
          <NumberInput
            value={i.spendingTarget}
            onChange={(v) => setIncomeLayeringInputs({ spendingTarget: v })}
          />
        </Field>
        <Field label="Earned income">
          <NumberInput
            value={i.earnedIncome}
            onChange={(v) => setIncomeLayeringInputs({ earnedIncome: v })}
          />
        </Field>
        <Field label="Filing status">
          <Select
            value={i.filingStatus}
            onChange={(v) =>
              setIncomeLayeringInputs({ filingStatus: v as FilingStatus })
            }
            options={FILING_STATUS_OPTIONS}
          />
        </Field>
        <Field label="Tax year">
          <NumberInput
            value={i.taxYear}
            onChange={(v) => setIncomeLayeringInputs({ taxYear: v })}
          />
        </Field>
        <Field label="Base year">
          <NumberInput
            value={i.baseYear}
            onChange={(v) => setIncomeLayeringInputs({ baseYear: v })}
          />
        </Field>
        <Field label="Spending inflation">
          <NumberInput
            value={i.spendingInflationRate}
            onChange={(v) =>
              setIncomeLayeringInputs({ spendingInflationRate: v })
            }
            step={0.001}
          />
        </Field>
        <Field label="Wage growth">
          <NumberInput
            value={i.wageGrowthRate}
            onChange={(v) => setIncomeLayeringInputs({ wageGrowthRate: v })}
            step={0.001}
          />
        </Field>
        <Field label="Expected return">
          <NumberInput
            value={i.expectedReturn}
            onChange={(v) => setIncomeLayeringInputs({ expectedReturn: v })}
            step={0.001}
          />
        </Field>
        <Field label="Bracket fill target">
          <NumberInput
            value={i.bracketFillTargetRate}
            onChange={(v) =>
              setIncomeLayeringInputs({ bracketFillTargetRate: v })
            }
            step={0.001}
          />
        </Field>
        <Field label="Birth year for RMD policy">
          <NumberInput
            value={i.birthYear}
            onChange={(v) => setIncomeLayeringInputs({ birthYear: v })}
          />
        </Field>
        <Field label="State code">
          <TextInput
            value={i.stateCode}
            onChange={(v) => setIncomeLayeringInputs({ stateCode: v })}
            placeholder="PA"
          />
        </Field>
      </div>

      <section className="space-y-3">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
          Social Security
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary PIA monthly">
            <NumberInput
              value={i.primaryPiaMonthly}
              onChange={(v) =>
                setIncomeLayeringInputs({ primaryPiaMonthly: v })
              }
            />
          </Field>
          <Field label="Primary claim age">
            <NumberInput
              value={i.primaryClaimAge}
              onChange={(v) => setIncomeLayeringInputs({ primaryClaimAge: v })}
            />
          </Field>
          <Field label="Primary FRA">
            <NumberInput
              value={i.primaryFraAge}
              onChange={(v) => setIncomeLayeringInputs({ primaryFraAge: v })}
            />
          </Field>
          <Field label="Primary COLA">
            <NumberInput
              value={i.primaryColaRate}
              onChange={(v) => setIncomeLayeringInputs({ primaryColaRate: v })}
              step={0.001}
            />
          </Field>
          <Field label="Spouse PIA monthly">
            <NumberInput
              value={i.spousePiaMonthly}
              onChange={(v) => setIncomeLayeringInputs({ spousePiaMonthly: v })}
            />
          </Field>
          <Field label="Spouse claim age">
            <NumberInput
              value={i.spouseClaimAge}
              onChange={(v) => setIncomeLayeringInputs({ spouseClaimAge: v })}
            />
          </Field>
          <Field label="Spouse FRA">
            <NumberInput
              value={i.spouseFraAge}
              onChange={(v) => setIncomeLayeringInputs({ spouseFraAge: v })}
            />
          </Field>
          <Field label="Spouse COLA">
            <NumberInput
              value={i.spouseColaRate}
              onChange={(v) => setIncomeLayeringInputs({ spouseColaRate: v })}
              step={0.001}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Pension / annuity streams"
          addLabel="Add stream"
          onAdd={addStream}
        />
        {i.incomeStreams.length === 0 ? (
          <Empty>No pension or annuity streams added.</Empty>
        ) : (
          i.incomeStreams.map((stream, index) => (
            <Card key={index} onRemove={() => removeStream(index)}>
              <div className="grid grid-cols-2 gap-4 pr-6">
                <Field label="Type">
                  <Select
                    value={stream.kind}
                    onChange={(v) =>
                      updateStream(index, {
                        kind: v as (typeof stream)["kind"],
                      })
                    }
                    options={STREAM_KIND_OPTIONS}
                  />
                </Field>
                <Field label="Annual amount">
                  <NumberInput
                    value={stream.annualAmount}
                    onChange={(v) => updateStream(index, { annualAmount: v })}
                  />
                </Field>
                <Field label="Start age">
                  <NumberInput
                    value={stream.startAge}
                    onChange={(v) => updateStream(index, { startAge: v })}
                  />
                </Field>
                <Field label="End age (0 = open)">
                  <NumberInput
                    value={stream.endAge}
                    onChange={(v) => updateStream(index, { endAge: v })}
                  />
                </Field>
                <Field label="COLA">
                  <NumberInput
                    value={stream.colaRate}
                    onChange={(v) => updateStream(index, { colaRate: v })}
                    step={0.001}
                  />
                </Field>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
          Shared account buckets
        </h3>
        {inputs.accounts.length === 0 ? (
          <Empty>Add accounts in the Monte Carlo tab.</Empty>
        ) : (
          <ul className="border border-stone-200">
            {inputs.accounts.map((account, index) => (
              <li
                key={`${account.type}-${index}`}
                className="flex justify-between border-b border-stone-100 px-2 py-1 font-mono text-[0.65rem] tabular-nums text-stone-600 last:border-b-0"
              >
                <span>{ACCOUNT_LABEL[account.type]}</span>
                <span>{usd(account.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
          Survivor switch
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Survivor year (0 = off)">
            <NumberInput
              value={i.survivorYear}
              onChange={(v) => setIncomeLayeringInputs({ survivorYear: v })}
            />
          </Field>
          <Field label="Survivor filing status">
            <Select
              value={i.survivorFilingStatus}
              onChange={(v) =>
                setIncomeLayeringInputs({
                  survivorFilingStatus: v as FilingStatus,
                })
              }
              options={FILING_STATUS_OPTIONS}
            />
          </Field>
        </div>
      </section>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Build income timeline"
      />
    </section>
  );
}

export function IncomeLayeringResults() {
  const { incomeLayeringResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No income timeline yet. Set assumptions and build the timeline."
    >
      {result && <IncomeLayeringPanel result={result} />}
    </ResultShell>
  );
}

function IncomeLayeringPanel({ result }: { result: IncomeLayeringResult }) {
  const years = result.years.slice(0, 35);
  const sourceEntries = Object.entries(result.rollups.sourceTotals);
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="grid grid-cols-2 gap-px bg-stone-200">
        <Metric
          label="Spending target"
          value={usd(result.rollups.totalSpendingTarget)}
        />
        <Metric label="Net income" value={usd(result.rollups.totalNetIncome)} />
        <Metric label="Total gap" value={usd(result.rollups.totalGap)} />
        <Metric label="Total tax" value={usd(result.rollups.totalTax)} />
      </div>

      <div className="space-y-1">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Timeline by year
        </span>
        <div className="space-y-1">
          {years.map((year) => (
            <IncomeYearRow key={year.year} year={year} />
          ))}
        </div>
        {result.years.length > years.length && (
          <p className="font-mono text-[0.6rem] text-stone-500">
            Showing first {years.length} of {result.years.length} projection
            years.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
          Source totals
        </h3>
        <table className="w-full border border-stone-200 font-mono text-[0.7rem] tabular-nums">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="px-2 py-1 text-left font-normal uppercase tracking-wider">
                Source
              </th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-wider">
                Gross
              </th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-wider">
                Tax
              </th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-wider">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {sourceEntries.map(([source, totals]) => (
              <tr
                key={source}
                className="border-b border-stone-100 last:border-b-0"
              >
                <td className="px-2 py-1 text-stone-700">
                  {layerLabel(source)}
                </td>
                <td className="px-2 py-1 text-right text-stone-800">
                  {usd(totals.gross)}
                </td>
                <td className="px-2 py-1 text-right text-stone-800">
                  {usd(totals.tax)}
                </td>
                <td className="px-2 py-1 text-right text-stone-800">
                  {usd(totals.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 font-mono text-[0.65rem] text-stone-500">
        <p>
          First gap age:{" "}
          {result.rollups.firstGapAge === null
            ? "none"
            : result.rollups.firstGapAge}
          {" · "}RMD start age {result.rollups.rmdStartAge}
        </p>
        <p>
          Tax table {result.assumptions.taxTableYear} /{" "}
          {result.assumptions.taxTableVersion}; withdrawal order{" "}
          {result.assumptions.withdrawalOrder.join(" -> ")}
        </p>
        {result.disclaimer && <p>{result.disclaimer}</p>}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-3">
      <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div className="font-mono text-lg tabular-nums text-stone-900">
        {value}
      </div>
    </div>
  );
}

function IncomeYearRow({
  year,
}: {
  year: IncomeLayeringResult["years"][number];
}) {
  const scale = Math.max(year.spendingTarget, year.netIncome, 1);
  const positiveLayers = year.layers.filter((layer) => layer.net > 0);
  return (
    <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem] items-center gap-2 font-mono text-[0.6rem] tabular-nums">
      <span className="text-stone-500">{year.age}</span>
      <div className="flex h-3 overflow-hidden bg-stone-100">
        {positiveLayers.map((layer, index) => (
          <LayerSegment
            key={`${layer.source}-${index}`}
            layer={layer}
            scale={scale}
          />
        ))}
        {year.gap > 0 && (
          <div
            title={`Gap ${usd(year.gap)}`}
            className="h-3 bg-stone-300"
            style={{ width: `${(year.gap / scale) * 100}%` }}
          />
        )}
      </div>
      <span className="text-right text-stone-700">
        {usdCompact(year.netIncome)}
      </span>
      <span
        className={`text-right ${
          year.gap > 0 ? "text-amber-700" : "text-stone-500"
        }`}
      >
        {year.gap > 0 ? usdCompact(year.gap) : pct(year.effectiveTaxRate)}
      </span>
    </div>
  );
}

function LayerSegment({ layer, scale }: { layer: IncomeLayer; scale: number }) {
  return (
    <div
      title={`${layerLabel(layer.source)} ${usd(layer.net)}`}
      className="h-3"
      style={{
        width: `${(layer.net / scale) * 100}%`,
        backgroundColor: sourceColor(layer.source),
      }}
    />
  );
}
