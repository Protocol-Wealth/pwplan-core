import { useScenario, type GlidePathShape } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateGlidePath } from "./tool-validation";
import { ageWeightSeries } from "./results-viz";
import { ChartHeading, LineChart } from "./charts";
import { ResultShell } from "./result-shell";
import {
  Field,
  NumberInput,
  Select,
  IssueList,
  RunButton,
} from "./form-controls";
import { pct } from "./format";

const GLIDE_SHAPES: { value: GlidePathShape; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "to_through", label: "To-through retirement" },
  { value: "rising_equity", label: "Rising equity" },
];

export function GlidePathForm() {
  const {
    glidePathInputs: g,
    setGlidePathInputs,
    setGlidePathResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateGlidePath(g);
  const runnable = issues.length === 0;

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      const result = await planning.glidePath({
        currentAge: g.currentAge,
        retirementAge: g.retirementAge,
        horizonAge: g.horizonAge,
        startEquityWeight: g.startEquityWeight,
        endEquityWeight: g.endEquityWeight,
        shape: g.shape,
      });
      setGlidePathResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Glide path
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Current age">
          <NumberInput
            value={g.currentAge}
            onChange={(v) => setGlidePathInputs({ currentAge: v })}
          />
        </Field>
        <Field label="Retirement age">
          <NumberInput
            value={g.retirementAge}
            onChange={(v) => setGlidePathInputs({ retirementAge: v })}
          />
        </Field>
        <Field label="Horizon age">
          <NumberInput
            value={g.horizonAge}
            onChange={(v) => setGlidePathInputs({ horizonAge: v })}
          />
        </Field>
        <Field label="Shape">
          <Select
            value={g.shape}
            onChange={(v) => setGlidePathInputs({ shape: v as GlidePathShape })}
            options={GLIDE_SHAPES}
          />
        </Field>
        <Field label="Start equity weight">
          <NumberInput
            step={0.05}
            value={g.startEquityWeight}
            onChange={(v) => setGlidePathInputs({ startEquityWeight: v })}
          />
        </Field>
        <Field label="End equity weight">
          <NumberInput
            step={0.05}
            value={g.endEquityWeight}
            onChange={(v) => setGlidePathInputs({ endEquityWeight: v })}
          />
        </Field>
      </div>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Compute glide path"
      />
    </section>
  );
}

export function GlidePathResults() {
  const { glidePathResult: result, error, running } = useScenario();

  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No glide path yet. Set the parameters and compute."
    >
      {result && (
        <GlidePathChart
          equityWeightByAge={result.equityWeightByAge}
          contractVersion={result.contractVersion}
        />
      )}
    </ResultShell>
  );
}

function GlidePathChart({
  equityWeightByAge,
  contractVersion,
}: {
  equityWeightByAge: Record<string, number>;
  contractVersion: string;
}) {
  const { ages, weights } = ageWeightSeries(equityWeightByAge);

  if (ages.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
          Result
        </h2>
        <p className="font-mono text-sm text-stone-400">
          The engine returned an empty glide path.
        </p>
      </section>
    );
  }

  const firstAge = ages[0];
  const lastAge = ages[ages.length - 1];
  const startWeight = weights[0];
  const endWeight = weights[weights.length - 1];

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="space-y-2">
        <ChartHeading>Equity weight by age</ChartHeading>
        <LineChart
          values={weights}
          forcedMax={1}
          ariaLabel={`Target equity weight from ${pct(startWeight)} at age ${firstAge} to ${pct(endWeight)} at age ${lastAge}.`}
          footer={{
            left: `age ${firstAge}`,
            center: `${pct(startWeight)} → ${pct(endWeight)}`,
            right: `age ${lastAge}`,
          }}
        />
      </div>

      <p className="font-mono text-[0.65rem] text-stone-400">
        contract {contractVersion}
      </p>
    </section>
  );
}
