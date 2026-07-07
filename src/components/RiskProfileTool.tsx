// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { RISK_PROFILE_QUESTIONS } from "../lib/risk-profile-questionnaire";
import { validateRiskProfileScore } from "./tool-validation";
import { ResultShell } from "./result-shell";
import { Field, Select, IssueList, RunButton } from "./form-controls";
import { pct } from "./format";
import { optimizerPatchFromRiskProfile } from "./risk-profile-handoff";
import type {
  RiskProfile,
  RiskProfileBand,
  RiskProfileScoreResult,
} from "../contract/planning";

function profileLabel(profile: RiskProfile): string {
  return profile
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RiskProfileForm() {
  const {
    riskProfileScoreInputs: r,
    setRiskProfileScoreInputs,
    setRiskProfileScoreResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateRiskProfileScore(r);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      setRiskProfileScoreResult(
        await planning.riskProfileScore({ answers: r.answers }),
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
        Risk profile
      </h2>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Fixed-answer questionnaire that maps to the optimizer&apos;s riskProfile
        field. It uses answer ids only: no free text, notes, identity, advisor
        override, approvals, or audit trail.
      </p>

      <div className="grid grid-cols-1 gap-4">
        {RISK_PROFILE_QUESTIONS.map((question) => (
          <Field key={question.id} label={question.label}>
            <Select
              value={r.answers[question.id] ?? ""}
              onChange={(v) =>
                setRiskProfileScoreInputs({
                  answers: { [question.id]: v },
                })
              }
              options={question.answers.map((answer) => ({
                value: answer.id,
                label: `${answer.label} (${answer.score})`,
              }))}
            />
          </Field>
        ))}
      </div>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Score risk profile"
      />
    </section>
  );
}

export function RiskProfileResults() {
  const { riskProfileScoreResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No risk profile yet. Answer the fixed questionnaire and score it."
    >
      {result && <RiskProfilePanel result={result} />}
    </ResultShell>
  );
}

function SuggestedWeightRow({
  id,
  weight,
  maxWeight,
}: {
  id: string;
  weight: number;
  maxWeight: number;
}) {
  const frac = maxWeight > 0 ? Math.max(0, weight / maxWeight) : 0;
  return (
    <tr className="border-b border-stone-200 font-mono text-[0.7rem] tabular-nums">
      <td className="py-1.5 pr-2 text-stone-700">{id}</td>
      <td className="py-1.5 pr-2">
        <div className="h-2 w-full bg-stone-100">
          <div
            className="h-2 bg-stone-800"
            style={{ width: `${(frac * 100).toFixed(1)}%` }}
          />
        </div>
      </td>
      <td className="py-1.5 pl-2 text-right text-stone-800">{pct(weight)}</td>
    </tr>
  );
}

function BandRow({ band }: { band: RiskProfileBand }) {
  return (
    <tr className="border-b border-stone-200 font-mono text-[0.65rem] tabular-nums">
      <td className="py-1.5 pr-2 text-stone-700">
        {profileLabel(band.profile)}
      </td>
      <td className="py-1.5 px-2 text-right text-stone-600">
        {band.scoreMin}-{band.scoreMax}
      </td>
      <td className="py-1.5 pl-2 text-right text-stone-600">
        {pct(band.annualVolatilityLow)}-{pct(band.annualVolatilityHigh)}
      </td>
    </tr>
  );
}

function RiskProfilePanel({ result }: { result: RiskProfileScoreResult }) {
  const { setOptimizeAllocationInputs, setTool } = useScenario();
  const suggestedWeights = Object.entries(result.suggestedWeights);
  const maxWeight = suggestedWeights.reduce(
    (max, [, weight]) => Math.max(max, weight),
    0,
  );

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Score · {result.score}/{result.maxScore}
        </p>
        <p className="font-mono text-2xl text-stone-800">
          {profileLabel(result.profile)}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          Volatility band {pct(result.riskBand.annualVolatilityLow)}-
          {pct(result.riskBand.annualVolatilityHigh)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          setOptimizeAllocationInputs(
            optimizerPatchFromRiskProfile(result.profile),
          );
          setTool("optimize_allocation");
        }}
        className="w-full border border-stone-900 bg-white px-4 py-2 font-mono text-sm uppercase tracking-wider text-stone-800 transition hover:bg-stone-100"
      >
        Load into Optimize Allocation
      </button>

      <div>
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
          Suggested weights
        </h3>
        <table className="mt-2 w-full">
          <tbody>
            {suggestedWeights.map(([id, weight]) => (
              <SuggestedWeightRow
                key={id}
                id={id}
                weight={weight}
                maxWeight={maxWeight}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
          Bands
        </h3>
        <table className="mt-2 w-full">
          <thead>
            <tr className="border-b border-stone-300 font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
              <th className="py-1 pr-2 text-left">Profile</th>
              <th className="py-1 px-2 text-right">Score</th>
              <th className="py-1 pl-2 text-right">Volatility</th>
            </tr>
          </thead>
          <tbody>
            {result.bands.map((band) => (
              <BandRow key={band.profile} band={band} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[0.65rem] text-stone-500">
        {result.assumptions.questionnaireVersion} ·{" "}
        {result.assumptions.optimizerField}
      </p>

      <p className="font-mono text-[0.65rem] leading-relaxed text-stone-500">
        {result.disclaimer}
      </p>
    </section>
  );
}
