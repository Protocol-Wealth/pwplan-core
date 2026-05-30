import { ScenarioForm } from "./components/ScenarioForm";
import { ResultsPanel } from "./components/ResultsPanel";
import { PLANNING_CONTRACT_VERSION } from "./contract/planning";

export default function App() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10 border-b border-stone-900 pb-4">
        <h1 className="font-mono text-2xl tracking-tight text-stone-900">
          pwplan-core
        </h1>
        <p className="mt-1 font-mono text-xs text-stone-500">
          regime-adaptive financial planning · engine contract{" "}
          {PLANNING_CONTRACT_VERSION}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <ScenarioForm />
        <ResultsPanel />
      </div>

      <footer className="mt-16 border-t border-stone-200 pt-4">
        <p className="font-mono text-[0.65rem] leading-relaxed text-stone-400">
          Software, not investment advice. Outputs are projections, not
          guarantees. Not affiliated with, and does not endorse, any third-party
          tool. Apache-2.0 · defensive patent.
        </p>
      </footer>
    </main>
  );
}
