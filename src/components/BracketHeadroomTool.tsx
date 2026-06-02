// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateBracketHeadroom } from "./tool-validation";
import { ResultShell } from "./result-shell";
import {
  Field,
  NumberInput,
  Select,
  IssueList,
  RunButton,
} from "./form-controls";
import { usd, pct } from "./format";
import type {
  FilingStatus,
  TaxBracketHeadroomResult,
} from "../contract/planning";

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_joint", label: "Married — joint" },
  { value: "married_separate", label: "Married — separate" },
  { value: "head_of_household", label: "Head of household" },
];

export function BracketHeadroomForm() {
  const {
    bracketInputs: b,
    setBracketInputs,
    setBracketResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateBracketHeadroom(b);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setBracketResult(
        await planning.taxBracketHeadroom({
          taxableIncome: b.taxableIncome,
          filingStatus: b.filingStatus,
          targetRate: b.targetRate,
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
        Tax-bracket headroom / Roth-fill
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Taxable income">
          <NumberInput
            value={b.taxableIncome}
            onChange={(v) => setBracketInputs({ taxableIncome: v })}
          />
        </Field>
        <Field label="Filing status">
          <Select
            value={b.filingStatus}
            onChange={(v) =>
              setBracketInputs({ filingStatus: v as FilingStatus })
            }
            options={FILING_STATUSES}
          />
        </Field>
        <Field label="Target rate (fill to)">
          <NumberInput
            step={0.01}
            value={b.targetRate}
            onChange={(v) => setBracketInputs({ targetRate: v })}
          />
        </Field>
      </div>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        How much more ordinary income (e.g. a Roth conversion) fits before the
        next federal rate — or up to your target rate.
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Compute headroom"
      />
    </section>
  );
}

export function BracketHeadroomResults() {
  const { bracketResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No headroom computed yet. Set income + filing status and compute."
    >
      {result && <BracketPanel result={result} />}
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

function BracketPanel({ result }: { result: TaxBracketHeadroomResult }) {
  const roomNext =
    result.roomToNextBracket === null
      ? "— (top bracket)"
      : usd(result.roomToNextBracket);
  const next = result.nextRate === null ? "—" : pct(result.nextRate);
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Room before the next rate ({next})
        </p>
        <p className="font-mono text-2xl tabular-nums text-stone-800">
          {roomNext}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          Currently in the {pct(result.marginalRate)} marginal bracket.
        </p>
      </div>

      <div>
        <Row
          label="Taxable income (after std. deduction)"
          value={usd(result.taxableIncome)}
        />
        <Row label="Marginal rate" value={pct(result.marginalRate)} />
        {result.targetRate !== undefined && (
          <Row
            label={`Room to fill ${pct(result.targetRate)}`}
            value={
              result.roomToTargetRate === null ||
              result.roomToTargetRate === undefined
                ? "— (target at/above top rate)"
                : usd(result.roomToTargetRate)
            }
          />
        )}
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not tax advice
      </p>
    </section>
  );
}
