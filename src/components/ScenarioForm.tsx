import { useScenario } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import type { ReturnModel } from "../contract/planning";

const RETURN_MODELS: { value: ReturnModel; label: string }[] = [
  { value: "emf_regime", label: "EMF regime (default)" },
  { value: "markov_regime", label: "Markov regime switching" },
  { value: "block_bootstrap", label: "Historical block bootstrap" },
  { value: "student_t", label: "Student-t (fat tails)" },
  { value: "multivariate_normal", label: "Multivariate normal" },
];

export function ScenarioForm() {
  const { inputs, setInputs, setResult, setRunning, setError, running } =
    useScenario();

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const result = await planning.monteCarlo({
        currentAge: inputs.currentAge,
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

  return (
    <section className="space-y-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Scenario
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Current age">
          <NumberInput
            value={inputs.currentAge}
            onChange={(v) => setInputs({ currentAge: v })}
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
        <Field label="Return model">
          <select
            className="w-full border border-stone-300 bg-white px-2 py-1 font-mono text-sm focus:border-stone-900 focus:outline-none"
            value={inputs.returnModel}
            onChange={(e) =>
              setInputs({ returnModel: e.target.value as ReturnModel })
            }
          >
            {RETURN_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <button
        onClick={run}
        disabled={running}
        className="w-full bg-stone-900 px-4 py-2 font-mono text-sm uppercase tracking-wider text-stone-50 transition hover:bg-stone-700 disabled:opacity-40"
      >
        {running ? "Running…" : "Run simulation"}
      </button>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[0.65rem] uppercase tracking-wider text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full border border-stone-300 bg-white px-2 py-1 font-mono text-sm focus:border-stone-900 focus:outline-none"
    />
  );
}
