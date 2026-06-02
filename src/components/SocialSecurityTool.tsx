// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateSocialSecurity } from "./tool-validation";
import { ResultShell } from "./result-shell";
import { Field, NumberInput, IssueList, RunButton } from "./form-controls";
import { usd, pct } from "./format";
import type { SocialSecurityClaimingResult } from "../contract/planning";

export function SocialSecurityForm() {
  const {
    socialSecurityInputs: s,
    setSocialSecurityInputs,
    setSocialSecurityResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateSocialSecurity(s);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setSocialSecurityResult(
        await planning.socialSecurityClaiming({
          piaMonthly: s.piaMonthly,
          fraAge: s.fraAge,
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
        Social Security claiming age
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Monthly benefit at FRA (PIA)">
          <NumberInput
            value={s.piaMonthly}
            onChange={(v) => setSocialSecurityInputs({ piaMonthly: v })}
          />
        </Field>
        <Field label="Full retirement age">
          <NumberInput
            value={s.fraAge}
            onChange={(v) => setSocialSecurityInputs({ fraAge: v })}
          />
        </Field>
      </div>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Benefit at each claim age 62–70 from your PIA (the benefit at full
        retirement age), plus the breakeven ages. Nominal dollars; educational.
      </p>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Compare claim ages"
      />
    </section>
  );
}

export function SocialSecurityResults() {
  const { socialSecurityResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No claim-age comparison yet. Set your PIA and compare."
    >
      {result && <SocialSecurityPanel result={result} />}
    </ResultShell>
  );
}

function SocialSecurityPanel({
  result,
}: {
  result: SocialSecurityClaimingResult;
}) {
  const maxMonthly = Math.max(
    ...result.byClaimAge.map((r) => r.monthlyBenefit),
  );
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="space-y-1">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Monthly benefit by claim age (FRA {result.fraAge})
        </span>
        {result.byClaimAge.map((row) => (
          <div key={row.claimAge} className="flex items-center gap-2">
            <span className="w-6 font-mono text-[0.65rem] tabular-nums text-stone-500">
              {row.claimAge}
            </span>
            <div className="h-3 flex-1 bg-stone-100">
              <div
                className="h-3 bg-stone-700"
                style={{ width: `${(row.monthlyBenefit / maxMonthly) * 100}%` }}
              />
            </div>
            <span className="w-20 text-right font-mono text-[0.65rem] tabular-nums text-stone-700">
              {usd(row.monthlyBenefit)}
            </span>
            <span className="w-12 text-right font-mono text-[0.6rem] tabular-nums text-stone-400">
              {pct(row.pctOfPia)}
            </span>
          </div>
        ))}
      </div>

      <div>
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Breakeven ages (cumulative, nominal)
        </span>
        {result.breakevens.map((b) => (
          <div
            key={`${b.earlier}-${b.later}`}
            className="flex justify-between border-b border-stone-200 py-1 font-mono text-sm tabular-nums"
          >
            <span className="text-stone-500">
              claim {b.earlier} vs {b.later}
            </span>
            <span className="text-stone-800">
              {b.breakevenAge === null ? "—" : `age ${b.breakevenAge}`}
            </span>
          </div>
        ))}
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </section>
  );
}
