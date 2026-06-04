// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { analyzeRothConversion } from "../lib/planning-gateway";
import { validateRothIrmaa } from "./tool-validation";
import { ResultShell } from "./result-shell";
import {
  Field,
  NumberInput,
  Select,
  TextInput,
  IssueList,
  RunButton,
} from "./form-controls";
import { usd, pct } from "./format";
import type { RothIrmaaInputs } from "../store/scenario";
import type {
  ContractFilingStatus,
  ConversionIntent,
  PlanningContract,
  RothConversionAnalysis,
  TargetRule,
  YearAnalysis,
} from "../contract/roth-conversion";

const FILING_STATUSES: { value: ContractFilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "mfj", label: "Married — joint" },
  { value: "mfs", label: "Married — separate" },
];

const TARGET_RULES: { value: TargetRule; label: string }[] = [
  { value: "fill_to_irmaa_tier", label: "Fill to IRMAA tier" },
  { value: "fill_to_rate", label: "Fill to tax rate" },
  { value: "fixed_amount", label: "Fixed amount" },
];

/** Map the flat form state to a PII-free PlanningContract. `case_id` is a fresh
 *  opaque token, never identity-derived. */
function buildContract(r: RothIrmaaInputs): PlanningContract {
  const birthYears =
    r.filingStatus === "single"
      ? [r.birthYearSelf]
      : [r.birthYearSelf, r.birthYearSpouse];
  const years = Array.from(
    { length: r.conversionYears },
    (_, i) => r.taxYear + i,
  );
  const intent: ConversionIntent = { target_rule: r.targetRule, years };
  if (r.targetRule === "fill_to_rate") intent.target_rate = r.targetRate;
  if (r.targetRule === "fixed_amount") intent.fixed_amount = r.fixedAmount;
  return {
    case_id: crypto.randomUUID(),
    tax_year: r.taxYear,
    filing_status: r.filingStatus,
    state_code: r.stateCode.toUpperCase(),
    birth_years: birthYears,
    medicare_enrolled: Math.min(r.medicareEnrolled, birthYears.length),
    income_ex_conversion: {
      pension: r.pension,
      social_security_gross: r.socialSecurityGross,
      taxable_interest: r.taxableInterest,
      tax_exempt_interest: r.taxExemptInterest,
      ordinary_dividends: r.ordinaryDividends,
      qualified_dividends: r.qualifiedDividends,
      long_term_gains: r.longTermGains,
    },
    accounts: {
      trad_ira_aggregate: r.tradIraAggregate,
      nondeductible_basis: r.nondeductibleBasis,
      taxable_liquidity: r.taxableLiquidity,
      employer_plan_aggregate: r.employerPlanAggregate,
    },
    intent,
  };
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export function RothIrmaaForm() {
  const {
    rothIrmaaInputs: r,
    setRothIrmaaInputs,
    setRothIrmaaResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateRothIrmaa(r);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      const result = await analyzeRothConversion({
        contract: buildContract(r),
        irmaa_inflation: r.irmaaInflation,
        irmaa_buffer: r.irmaaBuffer,
      });
      setRothIrmaaResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Roth conversion · IRMAA-constrained
      </h2>

      <Group title="Case">
        <Field label="First conversion year">
          <NumberInput
            value={r.taxYear}
            onChange={(v) => setRothIrmaaInputs({ taxYear: v })}
          />
        </Field>
        <Field label="Conversion years (1–5)">
          <NumberInput
            value={r.conversionYears}
            onChange={(v) => setRothIrmaaInputs({ conversionYears: v })}
          />
        </Field>
        <Field label="Filing status">
          <Select
            value={r.filingStatus}
            onChange={(v) =>
              setRothIrmaaInputs({ filingStatus: v as ContractFilingStatus })
            }
            options={FILING_STATUSES}
          />
        </Field>
        <Field label="State code">
          <TextInput
            value={r.stateCode}
            onChange={(v) => setRothIrmaaInputs({ stateCode: v })}
            placeholder="PA"
          />
        </Field>
        <Field label="Birth year (self)">
          <NumberInput
            value={r.birthYearSelf}
            onChange={(v) => setRothIrmaaInputs({ birthYearSelf: v })}
          />
        </Field>
        {r.filingStatus !== "single" && (
          <Field label="Birth year (spouse)">
            <NumberInput
              value={r.birthYearSpouse}
              onChange={(v) => setRothIrmaaInputs({ birthYearSpouse: v })}
            />
          </Field>
        )}
        <Field label="On Medicare (count)">
          <NumberInput
            value={r.medicareEnrolled}
            onChange={(v) => setRothIrmaaInputs({ medicareEnrolled: v })}
          />
        </Field>
      </Group>

      <Group title="Intent">
        <Field label="Target rule">
          <Select
            value={r.targetRule}
            onChange={(v) =>
              setRothIrmaaInputs({ targetRule: v as TargetRule })
            }
            options={TARGET_RULES}
          />
        </Field>
        {r.targetRule === "fill_to_rate" && (
          <Field label="Target rate">
            <NumberInput
              step={0.01}
              value={r.targetRate}
              onChange={(v) => setRothIrmaaInputs({ targetRate: v })}
            />
          </Field>
        )}
        {r.targetRule === "fixed_amount" && (
          <Field label="Fixed amount">
            <NumberInput
              value={r.fixedAmount}
              onChange={(v) => setRothIrmaaInputs({ fixedAmount: v })}
            />
          </Field>
        )}
      </Group>

      <Group title="Income (before any conversion)">
        <Field label="Pension">
          <NumberInput
            value={r.pension}
            onChange={(v) => setRothIrmaaInputs({ pension: v })}
          />
        </Field>
        <Field label="Social Security (gross)">
          <NumberInput
            value={r.socialSecurityGross}
            onChange={(v) => setRothIrmaaInputs({ socialSecurityGross: v })}
          />
        </Field>
        <Field label="Taxable interest">
          <NumberInput
            value={r.taxableInterest}
            onChange={(v) => setRothIrmaaInputs({ taxableInterest: v })}
          />
        </Field>
        <Field label="Tax-exempt interest">
          <NumberInput
            value={r.taxExemptInterest}
            onChange={(v) => setRothIrmaaInputs({ taxExemptInterest: v })}
          />
        </Field>
        <Field label="Ordinary dividends">
          <NumberInput
            value={r.ordinaryDividends}
            onChange={(v) => setRothIrmaaInputs({ ordinaryDividends: v })}
          />
        </Field>
        <Field label="Qualified dividends">
          <NumberInput
            value={r.qualifiedDividends}
            onChange={(v) => setRothIrmaaInputs({ qualifiedDividends: v })}
          />
        </Field>
        <Field label="Long-term gains">
          <NumberInput
            value={r.longTermGains}
            onChange={(v) => setRothIrmaaInputs({ longTermGains: v })}
          />
        </Field>
      </Group>

      <Group title="Accounts">
        <Field label="Traditional IRA (aggregate)">
          <NumberInput
            value={r.tradIraAggregate}
            onChange={(v) => setRothIrmaaInputs({ tradIraAggregate: v })}
          />
        </Field>
        <Field label="Nondeductible basis (8606)">
          <NumberInput
            value={r.nondeductibleBasis}
            onChange={(v) => setRothIrmaaInputs({ nondeductibleBasis: v })}
          />
        </Field>
        <Field label="Taxable liquidity (to pay tax)">
          <NumberInput
            value={r.taxableLiquidity}
            onChange={(v) => setRothIrmaaInputs({ taxableLiquidity: v })}
          />
        </Field>
        <Field label="Employer plan (401k/403b)">
          <NumberInput
            value={r.employerPlanAggregate}
            onChange={(v) => setRothIrmaaInputs({ employerPlanAggregate: v })}
          />
        </Field>
      </Group>

      <Group title="IRMAA projection assumptions">
        <Field label="Inflation (per year)">
          <NumberInput
            step={0.005}
            value={r.irmaaInflation}
            onChange={(v) => setRothIrmaaInputs({ irmaaInflation: v })}
          />
        </Field>
        <Field label="Buffer below each floor">
          <NumberInput
            value={r.irmaaBuffer}
            onChange={(v) => setRothIrmaaInputs({ irmaaBuffer: v })}
          />
        </Field>
      </Group>

      <IssueList issues={issues} />
      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Analyze conversion"
      />
    </section>
  );
}

export function RothIrmaaResults() {
  const { rothIrmaaResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No analysis yet. Set the case and analyze."
    >
      {result && <AnalysisPanel result={result} />}
    </ResultShell>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between border-b border-stone-200 py-1.5 font-mono text-sm tabular-nums">
      <span className="text-stone-500">{label}</span>
      <span className={accent ? "text-amber-700" : "text-stone-800"}>
        {value}
      </span>
    </div>
  );
}

/** The projected-IRMAA assumption is a fiduciary disclosure, shown prominently —
 *  not buried in fine print. */
function ProjectionDisclosure({ result }: { result: RothConversionAnalysis }) {
  const y0 = result.years[0];
  const s = result.snapshot;
  return (
    <div className="border border-amber-300 bg-amber-50 p-4">
      <p className="font-mono text-[0.6rem] uppercase tracking-wider text-amber-700">
        Projected IRMAA tiers — assumption
      </p>
      <p className="mt-1 font-mono text-[0.7rem] leading-relaxed text-amber-900">
        Medicare IRMAA runs on a 2-year MAGI lookback, so a conversion this year
        drives premiums in <span className="font-semibold">year + 2</span> (e.g.{" "}
        {y0.year} → {y0.target_premium_year}). CMS has not published those tiers
        yet, so they are <span className="font-semibold">projected</span> from{" "}
        {s.irmaa_tiers_source_year} tiers at {pct(s.irmaa_inflation_assumption)}
        /yr and a{" "}
        <span className="font-semibold">{usd(s.irmaa_buffer)} buffer</span> is
        held below each projected floor. The recommendation is an estimate, not
        a guarantee that a tier will not be crossed.
      </p>
    </div>
  );
}

function ConstraintBadge({ constraint }: { constraint: string }) {
  const irmaa = constraint === "irmaa";
  return (
    <span
      className={`font-mono text-[0.6rem] uppercase tracking-wider ${
        irmaa ? "text-amber-700" : "text-stone-500"
      }`}
    >
      bound by {constraint.replace("_", " ")}
    </span>
  );
}

function YearCard({ y }: { y: YearAnalysis }) {
  return (
    <div className="border border-stone-300 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-sm text-stone-800">
          {y.year}{" "}
          <span className="text-stone-400">· ages {y.ages.join("/")}</span>
        </h3>
        <ConstraintBadge constraint={y.binding_constraint} />
      </div>

      <p className="mt-2 font-mono text-2xl tabular-nums text-stone-900">
        {usd(y.recommended_amount)}
      </p>
      <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
        recommended conversion · effective rate{" "}
        {pct(y.effective_conversion_rate)}
      </p>

      <div className="mt-4">
        <p className="mb-1 font-mono text-[0.6rem] uppercase tracking-wider text-stone-400">
          Per-ceiling options
        </p>
        {y.options.map((o) => (
          <div
            key={o.key}
            className="flex justify-between border-b border-stone-100 py-1 font-mono text-[0.7rem] tabular-nums"
          >
            <span className="text-stone-500">{o.label}</span>
            <span
              className={
                o.crosses_irmaa_cliff ? "text-red-600" : "text-stone-700"
              }
            >
              {usd(o.amount)} @ {pct(o.marginal_rate_after)}
              {o.crosses_irmaa_cliff ? " · crosses IRMAA" : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Row label="MAGI before conversion" value={usd(y.magi_ex_conversion)} />
        {y.irmaa.projected_next_floor !== null && (
          <Row
            label="Projected next IRMAA floor"
            value={usd(y.irmaa.projected_next_floor)}
          />
        )}
        {y.irmaa.cliff_cost_if_crossed !== null && (
          <Row
            label="IRMAA cliff cost if crossed"
            value={usd(y.irmaa.cliff_cost_if_crossed)}
            accent
          />
        )}
        <Row
          label="Incremental federal tax"
          value={usd(y.incremental_federal_tax)}
        />
        <Row
          label={`State tax (${y.state_tax.modeled ? y.state_tax.treatment : "unmodeled"})`}
          value={usd(y.state_tax.incremental_state_tax)}
        />
        <Row label="NIIT delta (3.8%)" value={usd(y.niit.incremental_niit)} />
        <Row
          label={`LTCG stacking (${pct(y.ltcg.ltcg_rate_before)}→${pct(y.ltcg.ltcg_rate_after)})`}
          value={usd(y.ltcg.incremental_ltcg_tax)}
        />
        {y.pro_rata.applies && (
          <Row
            label="Non-taxable basis recovered"
            value={usd(y.pro_rata.basis_recovered)}
          />
        )}
        <Row
          label="Breakeven retirement rate"
          value={pct(y.breakeven_retirement_rate)}
        />
        {y.liquidity.gated && (
          <Row
            label="Liquidity-limited tax due"
            value={usd(y.liquidity.total_tax_due)}
            accent
          />
        )}
      </div>

      {y.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {y.notes.map((n, i) => (
            <li
              key={i}
              className="font-mono text-[0.6rem] leading-snug text-stone-500"
            >
              • {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AnalysisPanel({ result }: { result: RothConversionAnalysis }) {
  const dn = result.do_nothing;
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <ProjectionDisclosure result={result} />

      <div className="border border-emerald-300 bg-emerald-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Total recommended over {result.sequence.years.length} year
          {result.sequence.years.length > 1 ? "s" : ""}
        </p>
        <p className="font-mono text-2xl tabular-nums text-emerald-700">
          {usd(result.sequence.total_recommended)}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          {result.sequence.recommended_by_year.map(usd).join(" + ")} · residual
          IRA {usd(result.sequence.residual_trad_balance)} · total tax{" "}
          {usd(result.sequence.total_incremental_tax)}
        </p>
      </div>

      <div className="space-y-4">
        {result.years.map((y) => (
          <YearCard key={y.year} y={y} />
        ))}
      </div>

      <div className="border border-stone-300 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Do nothing — the RMD drag
        </p>
        <p className="mt-2 font-mono text-[0.7rem] leading-relaxed text-stone-700">
          RMDs begin at {dn.rmd_start_age} ({dn.first_rmd_year}). Left
          unconverted, the IRA grows to about{" "}
          <span className="font-semibold">
            {usd(dn.projected_trad_balance_at_rmd)}
          </span>
          , forcing a first-year RMD near{" "}
          <span className="font-semibold">{usd(dn.first_year_rmd)}</span> taxed
          around {pct(dn.first_year_rmd_marginal_rate)} — the drag the
          conversion window relieves.
          {dn.employer_plan_aggregate ? (
            <>
              {" "}
              Pool includes {usd(dn.employer_plan_aggregate)} of employer-plan
              money.
            </>
          ) : null}
          {dn.survivor_first_year_rmd_marginal_rate != null &&
          dn.survivor_first_year_rmd_marginal_rate >
            dn.first_year_rmd_marginal_rate ? (
            <>
              {" "}
              If the surviving spouse later files single, that RMD lands near{" "}
              {pct(dn.survivor_first_year_rmd_marginal_rate)} — the joint→single
              compression.
            </>
          ) : null}
        </p>
      </div>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-400">
        engine {result.snapshot.engine_version} · contract{" "}
        {result.contract_version} · brackets{" "}
        {result.snapshot.bracket_table_year} (
        {result.snapshot.bracket_table_source}) · IRMAA{" "}
        {result.snapshot.irmaa_tiers_source_year} (
        {result.snapshot.irmaa_table_source}) · state (
        {result.snapshot.state_rule_source}) · educational, not tax advice
      </p>
    </section>
  );
}
