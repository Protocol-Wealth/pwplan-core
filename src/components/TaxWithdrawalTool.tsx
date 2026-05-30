import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateTaxWithdrawal } from "./tool-validation";
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
  AccountType,
  FilingStatus,
  TaxWithdrawalResult,
} from "../contract/planning";

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_joint", label: "Married — joint" },
  { value: "married_separate", label: "Married — separate" },
  { value: "head_of_household", label: "Head of household" },
];

const ACCOUNT_LABEL: Record<AccountType, string> = {
  taxable: "Taxable",
  traditional: "Traditional",
  roth: "Roth",
};

export function TaxWithdrawalForm() {
  const {
    taxInputs: t,
    inputs,
    setTaxInputs,
    setTaxResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateTaxWithdrawal(t, inputs.accounts);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      const result = await planning.taxWithdrawal({
        year: t.year,
        filingStatus: t.filingStatus,
        accounts: inputs.accounts,
        grossNeed: t.grossNeed,
        age: t.age,
        otherTaxableIncome: t.otherTaxableIncome,
      });
      setTaxResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Tax-aware withdrawal
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tax year">
          <NumberInput
            value={t.year}
            onChange={(v) => setTaxInputs({ year: v })}
          />
        </Field>
        <Field label="Age (for RMD)">
          <NumberInput
            value={t.age}
            onChange={(v) => setTaxInputs({ age: v })}
          />
        </Field>
        <Field label="Gross need">
          <NumberInput
            value={t.grossNeed}
            onChange={(v) => setTaxInputs({ grossNeed: v })}
          />
        </Field>
        <Field label="Other taxable income">
          <NumberInput
            value={t.otherTaxableIncome}
            onChange={(v) => setTaxInputs({ otherTaxableIncome: v })}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Filing status">
            <Select
              value={t.filingStatus}
              onChange={(v) =>
                setTaxInputs({ filingStatus: v as FilingStatus })
              }
              options={FILING_STATUSES}
            />
          </Field>
        </div>
      </div>

      {/* Accounts are the shared portfolio (edited in the Monte Carlo tab). */}
      <div className="space-y-1">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          Portfolio (from Monte Carlo tab)
        </span>
        {inputs.accounts.length === 0 ? (
          <p className="font-mono text-[0.65rem] text-stone-400">
            No accounts configured.
          </p>
        ) : (
          <ul className="border border-stone-200">
            {inputs.accounts.map((a, i) => (
              <li
                key={i}
                className="flex justify-between border-b border-stone-100 px-2 py-1 font-mono text-[0.65rem] tabular-nums text-stone-600 last:border-b-0"
              >
                <span>{ACCOUNT_LABEL[a.type]}</span>
                <span>{usd(a.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Plan withdrawal"
      />
    </section>
  );
}

export function TaxWithdrawalResults() {
  const { taxResult: result, error, running } = useScenario();

  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No withdrawal plan yet. Set the parameters and plan."
    >
      {result && <TaxTable result={result} />}
    </ResultShell>
  );
}

function TaxTable({ result }: { result: TaxWithdrawalResult }) {
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="grid grid-cols-2 gap-px bg-stone-200">
        <div className="bg-white p-3">
          <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-400">
            Total tax
          </div>
          <div className="font-mono text-lg tabular-nums text-stone-900">
            {usd(result.totalTax)}
          </div>
        </div>
        <div className="bg-white p-3">
          <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-400">
            Effective rate
          </div>
          <div className="font-mono text-lg tabular-nums text-stone-900">
            {pct(result.effectiveRate)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
          Withdrawals by account
        </h3>
        <table className="w-full border border-stone-200 font-mono text-[0.7rem] tabular-nums">
          <thead>
            <tr className="border-b border-stone-200 text-stone-400">
              <th className="px-2 py-1 text-left font-normal uppercase tracking-wider">
                Account
              </th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-wider">
                Gross
              </th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-wider">
                Tax
              </th>
            </tr>
          </thead>
          <tbody>
            {result.withdrawals.map((w, i) => (
              <tr key={i} className="border-b border-stone-100 last:border-b-0">
                <td className="px-2 py-1 text-stone-700">
                  {ACCOUNT_LABEL[w.type]}
                </td>
                <td className="px-2 py-1 text-right text-stone-800">
                  {usd(w.gross)}
                </td>
                <td className="px-2 py-1 text-right text-stone-800">
                  {usd(w.tax)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        className={`font-mono text-[0.65rem] ${
          result.rmdSatisfied ? "text-stone-500" : "text-amber-700"
        }`}
      >
        RMD {result.rmdSatisfied ? "satisfied ✓" : "not satisfied ✗"} · contract{" "}
        {result.contractVersion}
      </p>
    </section>
  );
}
