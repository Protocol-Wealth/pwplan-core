// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { parseIdList, validateCorrelation } from "./tool-validation";
import { ResultShell } from "./result-shell";
import { MatrixTable } from "./MatrixTable";
import {
  Field,
  NumberInput,
  TextInput,
  IssueList,
  RunButton,
} from "./form-controls";
import type { CorrelationResult } from "../contract/planning";

export function CorrelationForm() {
  const {
    correlationInputs: c,
    setCorrelationInputs,
    setCorrelationResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateCorrelation(c);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setCorrelationResult(
        await planning.correlationMatrix({
          assetClassIds: parseIdList(c.assetClassIdsText),
          lookbackDays: c.lookbackDays,
          shrinkage: c.shrinkage,
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
        Correlation matrix
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Asset-class ids (comma-separated)">
            <TextInput
              value={c.assetClassIdsText}
              placeholder="us_equity, us_bonds"
              onChange={(v) => setCorrelationInputs({ assetClassIdsText: v })}
            />
          </Field>
        </div>
        <Field label="Lookback (trading days)">
          <NumberInput
            value={c.lookbackDays}
            onChange={(v) => setCorrelationInputs({ lookbackDays: v })}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={c.shrinkage}
          onChange={(e) =>
            setCorrelationInputs({ shrinkage: e.target.checked })
          }
          className="h-4 w-4 accent-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        />
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-stone-500">
          Ledoit-Wolf shrinkage
        </span>
      </label>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Real-data return correlations across asset classes. Use ids the engine
        has return series for (e.g. <code>us_equity</code>,{" "}
        <code>us_bonds</code>).
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Estimate correlations"
      />
    </section>
  );
}

export function CorrelationResults() {
  const { correlationResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No correlation matrix yet. Set the asset-class ids and estimate."
    >
      {result && <CorrelationPanel result={result} />}
    </ResultShell>
  );
}

function CorrelationPanel({ result }: { result: CorrelationResult }) {
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="space-y-2">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Correlation matrix · as of {result.asOf}
        </p>
        <MatrixTable
          ids={Object.keys(result.matrix)}
          matrix={result.matrix}
          corner="ρ"
          caption="Asset-class correlation matrix"
        />
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </section>
  );
}
