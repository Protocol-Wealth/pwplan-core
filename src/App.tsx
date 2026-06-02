// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { ScenarioForm } from "./components/ScenarioForm";
import { ResultsPanel } from "./components/ResultsPanel";
import { GlidePathForm, GlidePathResults } from "./components/GlidePathTool";
import {
  TaxWithdrawalForm,
  TaxWithdrawalResults,
} from "./components/TaxWithdrawalTool";
import {
  RothConversionForm,
  RothConversionResults,
} from "./components/RothConversionTool";
import {
  SequenceStressForm,
  SequenceStressResults,
} from "./components/SequenceStressTool";
import { ScenarioIO } from "./components/ScenarioIO";
import { useScenario, type PlanningTool } from "./store/scenario";
import { PLANNING_CONTRACT_VERSION } from "./contract/planning";

const TOOLS: { value: PlanningTool; label: string }[] = [
  { value: "monte_carlo", label: "Monte Carlo" },
  { value: "glide_path", label: "Glide path" },
  { value: "tax_withdrawal", label: "Tax withdrawal" },
  { value: "roth_conversion", label: "Roth conversion" },
  { value: "sequence_stress", label: "Sequence risk" },
];

function ToolTabs() {
  const { tool, setTool } = useScenario();
  return (
    <nav className="mb-8 flex gap-px border border-stone-300 bg-stone-200">
      {TOOLS.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => setTool(t.value)}
          aria-current={tool === t.value ? "page" : undefined}
          className={`flex-1 px-4 py-2 font-mono text-xs uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-900 ${
            tool === t.value
              ? "bg-stone-900 text-stone-50"
              : "bg-white text-stone-600 hover:bg-stone-100"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function ActiveTool() {
  const tool = useScenario((s) => s.tool);
  switch (tool) {
    case "glide_path":
      return (
        <>
          <GlidePathForm />
          <GlidePathResults />
        </>
      );
    case "tax_withdrawal":
      return (
        <>
          <TaxWithdrawalForm />
          <TaxWithdrawalResults />
        </>
      );
    case "roth_conversion":
      return (
        <>
          <RothConversionForm />
          <RothConversionResults />
        </>
      );
    case "sequence_stress":
      return (
        <>
          <SequenceStressForm />
          <SequenceStressResults />
        </>
      );
    case "monte_carlo":
      return (
        <>
          <ScenarioForm />
          <ResultsPanel />
        </>
      );
  }
}

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

      <ToolTabs />

      <ScenarioIO />

      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <ActiveTool />
      </div>

      <footer className="mt-16 border-t border-stone-200 pt-4">
        <p className="font-mono text-[0.65rem] leading-relaxed text-stone-500">
          Software, not investment advice. Outputs are projections, not
          guarantees. Not affiliated with, and does not endorse, any third-party
          tool. Apache-2.0 · defensive patent.
        </p>
      </footer>
    </main>
  );
}
