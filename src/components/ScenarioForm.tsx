// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import {
  allocationSum,
  isAllocationBalanced,
  validateScenario,
} from "./scenario-validation";
import {
  Field,
  NumberInput,
  TextInput,
  Select,
  SectionHeader,
  Card,
  Empty,
  IssueList,
  RunButton,
} from "./form-controls";
import type {
  AccountType,
  AssetClass,
  FilingStatus,
  ReturnModel,
} from "../contract/planning";

const RETURN_MODELS: { value: ReturnModel; label: string }[] = [
  { value: "emf_regime", label: "EMF regime (default)" },
  { value: "markov_regime", label: "Markov regime switching" },
  { value: "block_bootstrap", label: "Historical block bootstrap" },
  { value: "student_t", label: "Student-t (fat tails)" },
  { value: "multivariate_normal", label: "Multivariate normal" },
];

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "taxable", label: "Taxable" },
  { value: "traditional", label: "Traditional" },
  { value: "roth", label: "Roth" },
];

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_joint", label: "Married — joint" },
  { value: "married_separate", label: "Married — separate" },
  { value: "head_of_household", label: "Head of household" },
];

function replaceAt<T>(arr: T[], i: number, next: T): T[] {
  return arr.map((x, j) => (j === i ? next : x));
}

function removeAt<T>(arr: T[], i: number): T[] {
  return arr.filter((_, j) => j !== i);
}

export function ScenarioForm() {
  const { inputs, setInputs, setResult, setRunning, setError, running } =
    useScenario();

  const issues = validateScenario(inputs);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      const result = await planning.monteCarlo({
        currentAge: inputs.currentAge,
        retirementAge: inputs.retirementAge,
        horizonAge: inputs.horizonAge,
        accounts: inputs.accounts,
        assetClasses: inputs.assetClasses,
        annualSpend: inputs.annualSpend,
        spendColaRate: inputs.spendColaRate,
        guaranteedIncome: inputs.guaranteedIncome,
        filingStatus: inputs.filingStatus,
        returnModel: inputs.returnModel,
        paths: inputs.paths,
      });
      setResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  // --- asset classes -------------------------------------------------------

  function addAssetClass() {
    setInputs({
      assetClasses: [
        ...inputs.assetClasses,
        {
          id: "",
          label: "",
          expectedReturn: 0.06,
          volatility: 0.12,
          lambda: 0.2,
        },
      ],
    });
  }

  function updateAssetClass(i: number, patch: Partial<AssetClass>) {
    const prev = inputs.assetClasses[i];
    // Store ids trimmed so allocation keys match how scenario-validation
    // normalizes ids (it trims for known-id and duplicate checks). Otherwise a
    // padded id like " us_equity " is stored untrimmed but validated trimmed,
    // yielding a spurious "unknown asset class" error that wedges Run disabled.
    const next =
      patch.id !== undefined
        ? { ...prev, ...patch, id: patch.id.trim() }
        : { ...prev, ...patch };
    let accounts = inputs.accounts;
    // Re-key allocations when the (normalized) id changes so they don't go stale.
    if (next.id !== prev.id) {
      accounts = inputs.accounts.map((a) => {
        if (!(prev.id in a.allocation)) return a;
        const allocation = { ...a.allocation };
        allocation[next.id] = allocation[prev.id];
        delete allocation[prev.id];
        return { ...a, allocation };
      });
    }
    setInputs({
      assetClasses: replaceAt(inputs.assetClasses, i, next),
      accounts,
    });
  }

  function removeAssetClass(i: number) {
    const removedId = inputs.assetClasses[i].id;
    const accounts = inputs.accounts.map((a) => {
      if (!(removedId in a.allocation)) return a;
      const allocation = { ...a.allocation };
      delete allocation[removedId];
      return { ...a, allocation };
    });
    setInputs({ assetClasses: removeAt(inputs.assetClasses, i), accounts });
  }

  // --- accounts ------------------------------------------------------------

  function addAccount() {
    setInputs({
      accounts: [
        ...inputs.accounts,
        { type: "taxable", balance: 0, allocation: {} },
      ],
    });
  }

  function updateAccount(
    i: number,
    patch: Partial<(typeof inputs.accounts)[number]>,
  ) {
    setInputs({
      accounts: replaceAt(inputs.accounts, i, {
        ...inputs.accounts[i],
        ...patch,
      }),
    });
  }

  function removeAccount(i: number) {
    setInputs({ accounts: removeAt(inputs.accounts, i) });
  }

  function setWeight(accountIndex: number, assetId: string, weight: number) {
    const account = inputs.accounts[accountIndex];
    updateAccount(accountIndex, {
      allocation: { ...account.allocation, [assetId]: weight },
    });
  }

  // --- guaranteed income ---------------------------------------------------

  function addIncome() {
    setInputs({
      guaranteedIncome: [
        ...inputs.guaranteedIncome,
        { label: "", annualAmount: 0, startAge: 67, colaRate: 0.02 },
      ],
    });
  }

  function updateIncome(
    i: number,
    patch: Partial<(typeof inputs.guaranteedIncome)[number]>,
  ) {
    setInputs({
      guaranteedIncome: replaceAt(inputs.guaranteedIncome, i, {
        ...inputs.guaranteedIncome[i],
        ...patch,
      }),
    });
  }

  function removeIncome(i: number) {
    setInputs({ guaranteedIncome: removeAt(inputs.guaranteedIncome, i) });
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Scenario
      </h2>

      {/* Plan ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Current age">
          <NumberInput
            value={inputs.currentAge}
            onChange={(v) => setInputs({ currentAge: v })}
          />
        </Field>
        <Field label="Retirement age">
          <NumberInput
            value={inputs.retirementAge}
            onChange={(v) => setInputs({ retirementAge: v })}
          />
        </Field>
        <Field label="Horizon age">
          <NumberInput
            value={inputs.horizonAge}
            onChange={(v) => setInputs({ horizonAge: v })}
          />
        </Field>
        <Field label="Annual spend">
          <NumberInput
            value={inputs.annualSpend}
            onChange={(v) => setInputs({ annualSpend: v })}
          />
        </Field>
        <Field label="Spend COLA">
          <NumberInput
            step={0.001}
            value={inputs.spendColaRate}
            onChange={(v) => setInputs({ spendColaRate: v })}
          />
        </Field>
        <Field label="Paths">
          <NumberInput
            value={inputs.paths}
            onChange={(v) => setInputs({ paths: v })}
          />
        </Field>
        <Field label="Filing status">
          <Select
            value={inputs.filingStatus}
            onChange={(v) => setInputs({ filingStatus: v as FilingStatus })}
            options={FILING_STATUSES}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Return model">
            <Select
              value={inputs.returnModel}
              onChange={(v) => setInputs({ returnModel: v as ReturnModel })}
              options={RETURN_MODELS}
            />
          </Field>
        </div>
      </div>

      {/* Asset classes --------------------------------------------------- */}
      <div className="space-y-3">
        <SectionHeader
          title="Asset classes"
          addLabel="asset class"
          onAdd={addAssetClass}
        />
        {inputs.assetClasses.length === 0 && <Empty>No asset classes.</Empty>}
        {inputs.assetClasses.map((ac, i) => (
          <Card key={i} onRemove={() => removeAssetClass(i)}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Id">
                <TextInput
                  value={ac.id}
                  placeholder="us_equity"
                  onChange={(v) => updateAssetClass(i, { id: v })}
                />
              </Field>
              <Field label="Label">
                <TextInput
                  value={ac.label}
                  placeholder="US Equity"
                  onChange={(v) => updateAssetClass(i, { label: v })}
                />
              </Field>
              <Field label="Exp. return">
                <NumberInput
                  step={0.005}
                  value={ac.expectedReturn}
                  onChange={(v) => updateAssetClass(i, { expectedReturn: v })}
                />
              </Field>
              <Field label="Volatility">
                <NumberInput
                  step={0.005}
                  value={ac.volatility}
                  onChange={(v) => updateAssetClass(i, { volatility: v })}
                />
              </Field>
              <Field label="λ (EMF decay)">
                <NumberInput
                  step={0.01}
                  value={ac.lambda ?? 0}
                  onChange={(v) => updateAssetClass(i, { lambda: v })}
                />
              </Field>
            </div>
          </Card>
        ))}
      </div>

      {/* Accounts -------------------------------------------------------- */}
      <div className="space-y-3">
        <SectionHeader title="Accounts" addLabel="account" onAdd={addAccount} />
        {inputs.accounts.length === 0 && <Empty>No accounts.</Empty>}
        {inputs.accounts.map((account, i) => {
          const sum = allocationSum(account);
          const balanced = isAllocationBalanced(account);
          return (
            <Card key={i} onRemove={() => removeAccount(i)}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <Select
                    value={account.type}
                    onChange={(v) =>
                      updateAccount(i, { type: v as AccountType })
                    }
                    options={ACCOUNT_TYPES}
                  />
                </Field>
                <Field label="Balance">
                  <NumberInput
                    value={account.balance}
                    onChange={(v) => updateAccount(i, { balance: v })}
                  />
                </Field>
              </div>

              <div className="mt-3 space-y-1">
                <span className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
                  Allocation
                </span>
                {inputs.assetClasses.length === 0 ? (
                  <p className="font-mono text-[0.65rem] text-stone-500">
                    Add asset classes to allocate.
                  </p>
                ) : (
                  <>
                    {inputs.assetClasses.map((ac, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <span className="flex-1 truncate font-mono text-[0.65rem] text-stone-600">
                          {ac.label || ac.id || "(unnamed)"}
                        </span>
                        <input
                          type="number"
                          step={0.05}
                          min={0}
                          value={account.allocation[ac.id] ?? 0}
                          onChange={(e) =>
                            setWeight(i, ac.id, Number(e.target.value))
                          }
                          className="w-24 border border-stone-300 bg-white px-2 py-1 text-right font-mono text-sm tabular-nums focus:border-stone-900 focus:outline-none"
                        />
                      </div>
                    ))}
                    <div
                      className={`flex justify-between border-t border-stone-200 pt-1 font-mono text-[0.65rem] tabular-nums ${
                        balanced ? "text-stone-500" : "text-red-600"
                      }`}
                    >
                      <span>sum</span>
                      <span>
                        {(sum * 100).toFixed(1)}%{balanced ? " ✓" : " ✗"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Guaranteed income ----------------------------------------------- */}
      <div className="space-y-3">
        <SectionHeader
          title="Guaranteed income"
          addLabel="income"
          onAdd={addIncome}
        />
        {inputs.guaranteedIncome.length === 0 && <Empty>None.</Empty>}
        {inputs.guaranteedIncome.map((income, i) => (
          <Card key={i} onRemove={() => removeIncome(i)}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Source">
                  <TextInput
                    value={income.label}
                    placeholder="Social Security"
                    onChange={(v) => updateIncome(i, { label: v })}
                  />
                </Field>
              </div>
              <Field label="Annual amount">
                <NumberInput
                  value={income.annualAmount}
                  onChange={(v) => updateIncome(i, { annualAmount: v })}
                />
              </Field>
              <Field label="Start age">
                <NumberInput
                  value={income.startAge}
                  onChange={(v) => updateIncome(i, { startAge: v })}
                />
              </Field>
              <Field label="COLA">
                <NumberInput
                  step={0.001}
                  value={income.colaRate}
                  onChange={(v) => updateIncome(i, { colaRate: v })}
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
        label="Run simulation"
      />
    </section>
  );
}
