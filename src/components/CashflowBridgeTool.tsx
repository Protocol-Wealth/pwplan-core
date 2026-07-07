// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import {
  validateBudgetPacingProjection,
  validateCashReserveAnalysis,
  validateCashflowPlanningBridge,
} from "./tool-validation";
import { ResultShell } from "./result-shell";
import {
  Field,
  IssueList,
  NumberInput,
  RunButton,
  Select,
} from "./form-controls";
import { pct, usd } from "./format";
import type {
  BudgetPacingProjectionResult,
  CashReserveAnalysisResult,
  CashflowPlanningBridgeResult,
  SpendingVolatility,
} from "../contract/planning";

const VOLATILITY_OPTIONS: { value: SpendingVolatility; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-stone-200 py-1.5 font-mono text-sm tabular-nums">
      <span className="text-stone-500">{label}</span>
      <span className="text-right text-stone-800">{value}</span>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border border-stone-300 p-4">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function CashflowBridgeForm() {
  const {
    cashflowPlanningBridgeInputs: bridge,
    cashReserveAnalysisInputs: reserve,
    budgetPacingProjectionInputs: pacing,
    setCashflowPlanningBridgeInputs,
    setCashReserveAnalysisInputs,
    setBudgetPacingProjectionInputs,
    setCashflowPlanningBridgeResult,
    setCashReserveAnalysisResult,
    setBudgetPacingProjectionResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const bridgeIssues = validateCashflowPlanningBridge(bridge);
  const reserveIssues = validateCashReserveAnalysis(reserve);
  const pacingIssues = validateBudgetPacingProjection(pacing);

  async function runBridge() {
    if (bridgeIssues.length > 0) return;
    setRunning(true);
    setError(null);
    try {
      setCashflowPlanningBridgeResult(
        await planning.cashflowPlanningBridge(bridge),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function runReserve() {
    if (reserveIssues.length > 0) return;
    setRunning(true);
    setError(null);
    try {
      setCashReserveAnalysisResult(
        await planning.cashReserveAnalysis({
          monthlyEssentialSpending: reserve.monthlyEssentialSpending,
          monthlyTotalSpending: reserve.monthlyTotalSpending,
          currentCashReserve: reserve.currentCashReserve,
          targetMonths: reserve.targetMonths,
          ...(reserve.secondaryTargetMonths > 0
            ? { secondaryTargetMonths: reserve.secondaryTargetMonths }
            : {}),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function runPacing() {
    if (pacingIssues.length > 0) return;
    setRunning(true);
    setError(null);
    try {
      setBudgetPacingProjectionResult(
        await planning.budgetPacingProjection(pacing),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
          Cash Flow Bridge
        </h2>
        <p className="mt-2 font-mono text-[0.6rem] leading-relaxed text-stone-500">
          Synthetic monthly-close aggregates only. No CSV upload, transaction
          rows, merchant strings, account nicknames, household records, notes,
          approvals, release state, or audit trail.
        </p>
      </div>

      <Panel title="Planning bridge">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Months analyzed">
            <NumberInput
              value={bridge.monthsAnalyzed}
              onChange={(v) =>
                setCashflowPlanningBridgeInputs({ monthsAnalyzed: v })
              }
            />
          </Field>
          <Field label="Average spend">
            <NumberInput
              value={bridge.averageMonthlySpending}
              step={100}
              onChange={(v) =>
                setCashflowPlanningBridgeInputs({
                  averageMonthlySpending: v,
                })
              }
            />
          </Field>
          <Field label="Essential spend">
            <NumberInput
              value={bridge.essentialMonthlySpending}
              step={100}
              onChange={(v) =>
                setCashflowPlanningBridgeInputs({
                  essentialMonthlySpending: v,
                })
              }
            />
          </Field>
          <Field label="Lifestyle spend">
            <NumberInput
              value={bridge.lifestyleMonthlySpending}
              step={100}
              onChange={(v) =>
                setCashflowPlanningBridgeInputs({
                  lifestyleMonthlySpending: v,
                })
              }
            />
          </Field>
          <Field label="Average income">
            <NumberInput
              value={bridge.averageMonthlyIncome}
              step={100}
              onChange={(v) =>
                setCashflowPlanningBridgeInputs({ averageMonthlyIncome: v })
              }
            />
          </Field>
          <Field label="Average savings">
            <NumberInput
              value={bridge.averageMonthlySavings}
              step={100}
              onChange={(v) =>
                setCashflowPlanningBridgeInputs({ averageMonthlySavings: v })
              }
            />
          </Field>
          <Field label="Cash reserve">
            <NumberInput
              value={bridge.currentCashReserve}
              step={100}
              onChange={(v) =>
                setCashflowPlanningBridgeInputs({ currentCashReserve: v })
              }
            />
          </Field>
          <Field label="Target reserve months">
            <NumberInput
              value={bridge.targetCashReserveMonths}
              step={0.5}
              onChange={(v) =>
                setCashflowPlanningBridgeInputs({
                  targetCashReserveMonths: v,
                })
              }
            />
          </Field>
          <Field label="One-time adjustment">
            <NumberInput
              value={bridge.oneTimeExpenseAdjustment}
              step={100}
              onChange={(v) =>
                setCashflowPlanningBridgeInputs({
                  oneTimeExpenseAdjustment: v,
                })
              }
            />
          </Field>
          <Field label="Volatility">
            <Select
              value={bridge.spendingVolatility}
              options={VOLATILITY_OPTIONS}
              onChange={(v) =>
                setCashflowPlanningBridgeInputs({
                  spendingVolatility: v as SpendingVolatility,
                })
              }
            />
          </Field>
        </div>
        <IssueList issues={bridgeIssues} />
        <RunButton
          running={running}
          disabled={bridgeIssues.length > 0}
          onClick={runBridge}
          label="Run bridge"
        />
      </Panel>

      <Panel title="Cash reserve analysis">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Essential spend">
            <NumberInput
              value={reserve.monthlyEssentialSpending}
              step={100}
              onChange={(v) =>
                setCashReserveAnalysisInputs({
                  monthlyEssentialSpending: v,
                })
              }
            />
          </Field>
          <Field label="Total spend">
            <NumberInput
              value={reserve.monthlyTotalSpending}
              step={100}
              onChange={(v) =>
                setCashReserveAnalysisInputs({ monthlyTotalSpending: v })
              }
            />
          </Field>
          <Field label="Cash reserve">
            <NumberInput
              value={reserve.currentCashReserve}
              step={100}
              onChange={(v) =>
                setCashReserveAnalysisInputs({ currentCashReserve: v })
              }
            />
          </Field>
          <Field label="Target months">
            <NumberInput
              value={reserve.targetMonths}
              step={0.5}
              onChange={(v) =>
                setCashReserveAnalysisInputs({ targetMonths: v })
              }
            />
          </Field>
          <Field label="Secondary months">
            <NumberInput
              value={reserve.secondaryTargetMonths}
              step={0.5}
              onChange={(v) =>
                setCashReserveAnalysisInputs({ secondaryTargetMonths: v })
              }
            />
          </Field>
        </div>
        <IssueList issues={reserveIssues} />
        <RunButton
          running={running}
          disabled={reserveIssues.length > 0}
          onClick={runReserve}
          label="Analyze reserve"
        />
      </Panel>

      <Panel title="Budget pacing projection">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Month day">
            <NumberInput
              value={pacing.monthDay}
              onChange={(v) => setBudgetPacingProjectionInputs({ monthDay: v })}
            />
          </Field>
          <Field label="Days in month">
            <NumberInput
              value={pacing.daysInMonth}
              onChange={(v) =>
                setBudgetPacingProjectionInputs({ daysInMonth: v })
              }
            />
          </Field>
          <Field label="Month-to-date spend">
            <NumberInput
              value={pacing.monthToDateSpending}
              step={100}
              onChange={(v) =>
                setBudgetPacingProjectionInputs({
                  monthToDateSpending: v,
                })
              }
            />
          </Field>
          <Field label="Monthly budget">
            <NumberInput
              value={pacing.monthlyBudget}
              step={100}
              onChange={(v) =>
                setBudgetPacingProjectionInputs({ monthlyBudget: v })
              }
            />
          </Field>
          <Field label="Recurring remaining">
            <NumberInput
              value={pacing.recurringRemaining}
              step={100}
              onChange={(v) =>
                setBudgetPacingProjectionInputs({ recurringRemaining: v })
              }
            />
          </Field>
          <Field label="One-time remaining">
            <NumberInput
              value={pacing.knownOneTimeRemaining}
              step={100}
              onChange={(v) =>
                setBudgetPacingProjectionInputs({
                  knownOneTimeRemaining: v,
                })
              }
            />
          </Field>
        </div>
        <IssueList issues={pacingIssues} />
        <RunButton
          running={running}
          disabled={pacingIssues.length > 0}
          onClick={runPacing}
          label="Project pace"
        />
      </Panel>
    </section>
  );
}

export function CashflowBridgeResults() {
  const {
    cashflowPlanningBridgeResult,
    cashReserveAnalysisResult,
    budgetPacingProjectionResult,
    error,
    running,
  } = useScenario();
  const hasResult =
    cashflowPlanningBridgeResult !== null ||
    cashReserveAnalysisResult !== null ||
    budgetPacingProjectionResult !== null;

  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={hasResult}
      emptyText="No cash-flow bridge output yet. Run one of the synthetic aggregate tools."
    >
      <section className="space-y-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
          Result
        </h2>
        {cashflowPlanningBridgeResult && (
          <PlanningBridgePanel result={cashflowPlanningBridgeResult} />
        )}
        {cashReserveAnalysisResult && (
          <ReservePanel result={cashReserveAnalysisResult} />
        )}
        {budgetPacingProjectionResult && (
          <PacingPanel result={budgetPacingProjectionResult} />
        )}
      </section>
    </ResultShell>
  );
}

function PlanningBridgePanel({
  result,
}: {
  result: CashflowPlanningBridgeResult;
}) {
  return (
    <Panel title="Planning bridge output">
      <Row label="Annual spend" value={usd(result.annualSpend)} />
      <Row
        label="Normalized annual spend"
        value={usd(result.normalizedAnnualSpend)}
      />
      <Row label="Savings rate" value={pct(result.savingsRate)} />
      <Row label="Cash reserve target" value={usd(result.cashReserveTarget)} />
      <Row label="Cash reserve gap" value={usd(result.cashReserveGap)} />
      <Row
        label="Retirement income floor"
        value={usd(result.retirementIncomeFloor)}
      />
      <Row
        label="Lifestyle band"
        value={`${usd(result.retirementLifestyleBand.lower)} / ${usd(
          result.retirementLifestyleBand.target,
        )} / ${usd(result.retirementLifestyleBand.upper)}`}
      />
      <Row label="Volatility" value={result.spendingVolatility} />
      {result.planningWarnings.length > 0 && (
        <List title="Warnings" values={result.planningWarnings} />
      )}
      {result.recommendedNextTools.length > 0 && (
        <List
          title="Recommended next tools"
          values={result.recommendedNextTools}
        />
      )}
      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </Panel>
  );
}

function ReservePanel({ result }: { result: CashReserveAnalysisResult }) {
  return (
    <Panel title="Reserve output">
      <Row label="Target reserve" value={usd(result.targetReserve)} />
      <Row
        label="Secondary target"
        value={
          result.secondaryTargetReserve === null
            ? "-"
            : usd(result.secondaryTargetReserve)
        }
      />
      <Row label="Current reserve" value={usd(result.currentReserve)} />
      <Row label="Gap to target" value={usd(result.gapToTarget)} />
      <Row
        label="Gap to secondary"
        value={
          result.gapToSecondaryTarget === null
            ? "-"
            : usd(result.gapToSecondaryTarget)
        }
      />
      <Row
        label="Months covered (essential)"
        value={result.monthsCoveredEssential.toFixed(1)}
      />
      <Row
        label="Months covered (total)"
        value={result.monthsCoveredTotal.toFixed(1)}
      />
      <Row label="Status" value={result.status} />
      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </Panel>
  );
}

function PacingPanel({ result }: { result: BudgetPacingProjectionResult }) {
  return (
    <Panel title="Budget pace output">
      <Row
        label="Projected month-end spend"
        value={usd(result.projectedMonthEndSpending)}
      />
      <Row label="Projected variance" value={usd(result.projectedVariance)} />
      <Row label="Budget used" value={pct(result.budgetUsedPct)} />
      <Row label="Pacing status" value={result.pacingStatus} />
      <Row label="Warning level" value={result.warningLevel} />
      {Object.keys(result.assumptions).length > 0 && (
        <List
          title="Assumptions"
          values={Object.entries(result.assumptions).map(
            ([key, value]) => `${key}: ${String(value)}`,
          )}
        />
      )}
      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </Panel>
  );
}

function List({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <h4 className="font-mono text-[0.65rem] uppercase tracking-wider text-stone-500">
        {title}
      </h4>
      <ul className="mt-2 space-y-1">
        {values.map((value) => (
          <li
            key={value}
            className="font-mono text-[0.65rem] leading-relaxed text-stone-600"
          >
            • {value}
          </li>
        ))}
      </ul>
    </div>
  );
}
