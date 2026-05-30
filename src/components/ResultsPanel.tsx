import { useScenario } from "../store/scenario";

export function ResultsPanel() {
  const { result, error, running } = useScenario();

  if (error) {
    return (
      <section className="border border-red-300 bg-red-50 p-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-red-600">
          Engine error
        </h2>
        <p className="mt-2 font-mono text-sm text-red-800">{error}</p>
      </section>
    );
  }

  if (running) {
    return (
      <section className="border border-stone-200 p-4">
        <p className="font-mono text-sm text-stone-500">Awaiting nexus-core…</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="border border-dashed border-stone-300 p-4">
        <p className="font-mono text-sm text-stone-400">
          No result yet. Configure a scenario and run the simulation.
        </p>
      </section>
    );
  }

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <section className="space-y-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-900 p-4">
        <div className="font-mono text-[0.65rem] uppercase tracking-wider text-stone-500">
          Probability of success
        </div>
        <div className="mt-1 font-mono text-4xl tabular-nums text-stone-900">
          {pct(result.successProbability)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-stone-200">
        {Object.entries(result.terminalValues).map(([k, v]) => (
          <div key={k} className="bg-white p-3">
            <div className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-400">
              terminal {k}
            </div>
            <div className="font-mono text-sm tabular-nums text-stone-800">
              {usd(v)}
            </div>
          </div>
        ))}
      </div>

      <p className="font-mono text-[0.65rem] text-stone-400">
        seed {result.seedUsed} · contract {result.contractVersion}
      </p>
    </section>
  );
}
