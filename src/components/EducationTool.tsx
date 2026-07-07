// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateEducationFunding } from "./tool-validation";
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
  EducationFundingResult,
  EducationStudentFundingInput,
  EducationStudentFundingResult,
  EducationVehicleRule,
} from "../contract/planning";

const CURRENT_YEAR = new Date().getFullYear();
const COST_PRESETS = [
  { value: "private", label: "Private college", annualCost: 45_000 },
  { value: "public", label: "Public in-state", annualCost: 28_000 },
  { value: "community", label: "Community college", annualCost: 8_000 },
  { value: "custom", label: "Custom", annualCost: null },
] as const;
const VEHICLES = [
  { value: "529", label: "529" },
  { value: "coverdell_esa", label: "Coverdell ESA" },
  { value: "ugma_utma", label: "UGMA/UTMA" },
];

function presetForCost(annualCost: number): string {
  return (
    COST_PRESETS.find(
      (p) => p.annualCost !== null && p.annualCost === annualCost,
    )?.value ?? "custom"
  );
}

function startYear(s: EducationStudentFundingInput): number {
  return CURRENT_YEAR + s.yearsUntilStart;
}

export function EducationFundingForm() {
  const {
    educationFundingInputs: e,
    setEducationFundingInputs,
    setEducationFundingResult,
    setEducationVehicleRulesResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateEducationFunding(e);
  const runnable = issues.length === 0;

  function patchStudent(
    index: number,
    patch: Partial<EducationStudentFundingInput>,
  ) {
    setEducationFundingInputs({
      students: e.students.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  }

  function addStudent() {
    const next = e.students.length + 1;
    setEducationFundingInputs({
      students: [
        ...e.students,
        {
          subjectRef: `student-${next}`,
          annualCost: 45_000,
          yearsUntilStart: 8,
          fundingYears: 4,
          currentSavings: 0,
          monthlyContribution: 0,
        },
      ],
    });
  }

  function removeStudent(index: number) {
    setEducationFundingInputs({
      students: e.students.filter((_, i) => i !== index),
    });
  }

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      const [funding, rules] = await Promise.all([
        planning.educationFunding({
          students: e.students,
          tuitionInflation: e.tuitionInflation,
          afterTaxReturn: e.afterTaxReturn,
        }),
        planning.educationVehicleRules({ taxYear: e.taxYear }),
      ]);
      setEducationFundingResult(funding);
      setEducationVehicleRulesResult(rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Education funding
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tax year">
          <NumberInput
            value={e.taxYear}
            onChange={(v) => setEducationFundingInputs({ taxYear: v })}
          />
        </Field>
        <Field label="Vehicle focus">
          <Select
            value={e.selectedVehicle}
            options={VEHICLES}
            onChange={(v) => setEducationFundingInputs({ selectedVehicle: v })}
          />
        </Field>
        <Field label="Tuition inflation">
          <NumberInput
            value={e.tuitionInflation}
            step={0.005}
            onChange={(v) => setEducationFundingInputs({ tuitionInflation: v })}
          />
        </Field>
        <Field label="After-tax return">
          <NumberInput
            value={e.afterTaxReturn}
            step={0.005}
            onChange={(v) => setEducationFundingInputs({ afterTaxReturn: v })}
          />
        </Field>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Students" addLabel="Student" onAdd={addStudent} />
        {e.students.length === 0 && (
          <Empty>No student rows yet. Add one.</Empty>
        )}
        {e.students.map((student, i) => (
          <Card
            key={`${student.subjectRef}-${i}`}
            onRemove={() => removeStudent(i)}
          >
            <div className="grid grid-cols-2 gap-3 pr-4">
              <Field label="Subject ref">
                <TextInput
                  value={student.subjectRef}
                  placeholder={`student-${i + 1}`}
                  onChange={(v) => patchStudent(i, { subjectRef: v })}
                />
              </Field>
              <Field label="Cost basis">
                <Select
                  value={presetForCost(student.annualCost)}
                  options={COST_PRESETS.map((p) => ({
                    value: p.value,
                    label: p.label,
                  }))}
                  onChange={(v) => {
                    const preset = COST_PRESETS.find((p) => p.value === v);
                    if (preset && preset.annualCost !== null) {
                      patchStudent(i, { annualCost: preset.annualCost });
                    }
                  }}
                />
              </Field>
              <Field label="Annual cost">
                <NumberInput
                  value={student.annualCost}
                  step={1000}
                  onChange={(v) => patchStudent(i, { annualCost: v })}
                />
              </Field>
              <Field label="Start year">
                <NumberInput
                  value={startYear(student)}
                  onChange={(v) =>
                    patchStudent(i, {
                      yearsUntilStart: Math.max(
                        0,
                        Math.round(v - CURRENT_YEAR),
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Funding years">
                <NumberInput
                  value={student.fundingYears}
                  onChange={(v) =>
                    patchStudent(i, { fundingYears: Math.round(v) })
                  }
                />
              </Field>
              <Field label="Current savings">
                <NumberInput
                  value={student.currentSavings ?? 0}
                  step={1000}
                  onChange={(v) => patchStudent(i, { currentSavings: v })}
                />
              </Field>
              <Field label="Monthly contribution">
                <NumberInput
                  value={student.monthlyContribution ?? 0}
                  step={50}
                  onChange={(v) => patchStudent(i, { monthlyContribution: v })}
                />
              </Field>
            </div>
          </Card>
        ))}
      </div>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Run education funding"
      />
    </section>
  );
}

export function EducationFundingResults() {
  const {
    educationFundingResult: funding,
    educationVehicleRulesResult: rules,
    educationFundingInputs: inputs,
    error,
    running,
  } = useScenario();

  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={funding !== null || rules !== null}
      emptyText="No education funding output yet. Set the rows and run."
    >
      {funding && <FundingPanel result={funding} />}
      {rules && (
        <VehicleRulesPanel
          rules={rules.rules}
          selectedVehicle={inputs.selectedVehicle}
          disclaimer={rules.disclaimer}
        />
      )}
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

function FundingPanel({ result }: { result: EducationFundingResult }) {
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Funding result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Household monthly need
        </p>
        <p className="font-mono text-2xl tabular-nums text-stone-800">
          {usd(result.householdTotals.savingsNeed.monthly)}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          annual {usd(result.householdTotals.savingsNeed.annual)} · lump sum{" "}
          {usd(result.householdTotals.savingsNeed.lumpSum)}
        </p>
      </div>

      <div>
        <Row
          label="Total future cost"
          value={usd(result.householdTotals.totalFutureCost)}
        />
        <Row
          label="Cost at goal start"
          value={usd(result.householdTotals.totalCostAtGoalStart)}
        />
        <Row
          label="Projected savings"
          value={usd(result.householdTotals.projectedSavingsAtStart)}
        />
        <Row
          label="Savings gap"
          value={usd(result.householdTotals.savingsGapAtStart)}
        />
        <Row label="Tuition inflation" value={pct(result.tuitionInflation)} />
        <Row label="After-tax return" value={pct(result.afterTaxReturn)} />
      </div>

      <div className="space-y-4">
        {result.students.map((student) => (
          <StudentPanel key={student.subjectRef} student={student} />
        ))}
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} ·{" "}
        {result.disclaimer ?? "educational, not advice"}
      </p>
    </section>
  );
}

function StudentPanel({ student }: { student: EducationStudentFundingResult }) {
  const max = Math.max(...student.cost.costSchedule.map((row) => row.cost), 1);
  const height = Math.max(92, 24 + student.cost.costSchedule.length * 20);
  return (
    <div className="border border-stone-300 p-3">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-mono text-sm text-stone-800">
          {student.subjectRef}
        </h3>
        <span className="font-mono text-[0.65rem] text-stone-500">
          monthly need {usd(student.savingsNeed.monthly)}
        </span>
      </div>

      <svg
        viewBox={`0 0 320 ${height}`}
        className="h-auto w-full border border-stone-200 bg-white"
        role="img"
        aria-label={`Education cost schedule for ${student.subjectRef}`}
      >
        {student.cost.costSchedule.map((row, i) => {
          const width = (row.cost / max) * 250;
          const y = 12 + i * 20;
          return (
            <g key={row.yearIndex}>
              <text
                x="8"
                y={y + 10}
                className="fill-stone-500 font-mono text-[8px]"
              >
                Y{row.yearIndex + 1}
              </text>
              <rect x="36" y={y} width={width} height="10" fill="#1c1917" />
              <text
                x={Math.min(292, 42 + width)}
                y={y + 9}
                className="fill-stone-600 font-mono text-[8px]"
              >
                {usdCompact(row.cost)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3">
        <Row label="First-year cost" value={usd(student.cost.firstYearCost)} />
        <Row
          label="Total cost at start"
          value={usd(student.cost.totalCostAtGoalStart)}
        />
        <Row
          label="Projected savings"
          value={usd(student.projectedSavingsAtStart)}
        />
        <Row label="Savings gap" value={usd(student.savingsGapAtStart)} />
      </div>
    </div>
  );
}

function moneyOrDash(n: number | null): string {
  return n === null ? "—" : usd(n);
}

function phaseout(value: [number, number] | null): string {
  return value === null ? "—" : `${usd(value[0])}–${usd(value[1])}`;
}

function VehicleRulesPanel({
  rules,
  selectedVehicle,
  disclaimer,
}: {
  rules: EducationVehicleRule[];
  selectedVehicle: string;
  disclaimer?: string;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Vehicle rules
      </h2>

      <div className="overflow-x-auto border border-stone-300">
        <table className="min-w-full border-collapse font-mono text-[0.65rem]">
          <thead className="bg-stone-100 text-stone-500">
            <tr>
              <th className="border-b border-stone-300 px-2 py-2 text-left">
                Vehicle
              </th>
              <th className="border-b border-stone-300 px-2 py-2 text-right">
                Limit
              </th>
              <th className="border-b border-stone-300 px-2 py-2 text-right">
                5-year single
              </th>
              <th className="border-b border-stone-300 px-2 py-2 text-right">
                MAGI phaseout
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr
                key={rule.vehicle}
                className={
                  rule.vehicle === selectedVehicle ? "bg-stone-50" : "bg-white"
                }
              >
                <td className="border-b border-stone-200 px-2 py-2 text-stone-800">
                  {rule.label}
                </td>
                <td className="border-b border-stone-200 px-2 py-2 text-right tabular-nums text-stone-700">
                  {moneyOrDash(rule.contributionLimit)}
                </td>
                <td className="border-b border-stone-200 px-2 py-2 text-right tabular-nums text-stone-700">
                  {moneyOrDash(rule.fiveYearSuperfundingSingle)}
                </td>
                <td className="border-b border-stone-200 px-2 py-2 text-right tabular-nums text-stone-700">
                  {phaseout(rule.magiPhaseoutSingle)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rules.map((rule) => (
        <div
          key={`${rule.vehicle}-notes`}
          className="border border-stone-200 p-3"
        >
          <p className="font-mono text-[0.65rem] uppercase tracking-wider text-stone-500">
            {rule.label}
          </p>
          <p className="mt-1 font-mono text-[0.65rem] leading-relaxed text-stone-600">
            {rule.qualifiedDistributionTreatment}
          </p>
          <ul className="mt-2 space-y-1">
            {rule.referenceNotes.map((note, i) => (
              <li
                key={i}
                className="font-mono text-[0.65rem] leading-relaxed text-stone-600"
              >
                • {note}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {disclaimer && (
        <p className="font-mono text-[0.65rem] text-stone-500">{disclaimer}</p>
      )}
    </section>
  );
}
