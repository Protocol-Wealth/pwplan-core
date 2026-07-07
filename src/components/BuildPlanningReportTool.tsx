// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { useScenario, type ReportSectionDraft } from "../store/scenario";
import { planning } from "../lib/planning-gateway";
import { validateBuildPlanningReport } from "./tool-validation";
import { ResultShell } from "./result-shell";
import {
  Field,
  NumberInput,
  Select,
  TextInput,
  SectionHeader,
  Card,
  Empty,
  IssueList,
  RunButton,
} from "./form-controls";
import type {
  BuildPlanningReportRequest,
  BuildPlanningReportResult,
  PlanningReportMetadata,
  PlanningReportSection,
  PlanningReportSectionInput,
} from "../contract/planning";

/** Split a newline-separated findings textarea into trimmed, non-empty lines. */
function parseFindings(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function roadmapSections(scope: "focused" | "full"): ReportSectionDraft[] {
  const sections: ReportSectionDraft[] = [
    {
      kind: "snapshot",
      title: "Snapshot",
      findingsText: "Current balance sheet and allocation summary reviewed.",
    },
    {
      kind: "trajectory",
      title: "Trajectory",
      findingsText: "Planning trajectory reviewed with current assumptions.",
    },
    {
      kind: "goals",
      title: "Goals",
      findingsText: "Stated planning goal reviewed for discussion.",
    },
  ];
  if (scope === "full") {
    sections.push(
      {
        kind: "income",
        title: "Income",
        findingsText: "Income-layering inputs reviewed for retirement years.",
      },
      {
        kind: "guardrails",
        title: "Guardrails",
        findingsText: "Spending guardrails reviewed for planning discussion.",
      },
      {
        kind: "historical_blend",
        title: "Historical Context",
        findingsText: "Historical blend exhibit reviewed for context.",
      },
    );
  }
  return sections;
}

export function BuildPlanningReportForm() {
  const {
    buildReportInputs: r,
    setBuildReportInputs,
    setBuildReportResult,
    setRunning,
    setError,
    running,
  } = useScenario();

  const issues = validateBuildPlanningReport(r);
  const runnable = issues.length === 0;

  function addSection() {
    setBuildReportInputs({
      sections: [...r.sections, { kind: "", title: "", findingsText: "" }],
    });
  }

  function removeSection(i: number) {
    setBuildReportInputs({
      sections: r.sections.filter((_, idx) => idx !== i),
    });
  }

  function patchSection(i: number, patch: Partial<ReportSectionDraft>) {
    setBuildReportInputs({
      sections: r.sections.map((s, idx) =>
        idx === i ? { ...s, ...patch } : s,
      ),
    });
  }

  async function run() {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      const sections: PlanningReportSectionInput[] = r.sections.map((s) => {
        const findings = parseFindings(s.findingsText);
        return {
          kind: s.kind.trim(),
          ...(s.title.trim() ? { title: s.title.trim() } : {}),
          ...(findings.length > 0 ? { findings } : {}),
        };
      });
      const request: Omit<BuildPlanningReportRequest, "contractVersion"> = {
        ...(r.title.trim() ? { title: r.title.trim() } : {}),
        includeRegime: r.includeRegime,
        sections,
      };
      if (r.preset === "wealth_roadmap") {
        request.preset = "wealth_roadmap";
        request.scope = r.scope;
        request.metadata = {
          assumptionVersion: r.assumptionVersion.trim(),
          cmaVersion: r.cmaVersion.trim(),
          taxYear: r.taxYear,
          seed: r.seed,
          ...(r.engineReference.trim()
            ? { engineReference: r.engineReference.trim() }
            : {}),
        };
      }
      setBuildReportResult(await planning.buildPlanningReport(request));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Build planning report
      </h2>

      <p className="font-mono text-[0.6rem] leading-relaxed text-stone-500">
        Assemble de-identified planning sections into an ordered report. Each
        section is a free-form <code>kind</code> + optional title + findings;
        the engine normalizes titles, collates findings, and (optionally)
        annotates the live regime. PII-free by construction.
      </p>

      <Field label="Report title">
        <TextInput
          value={r.title}
          placeholder={
            r.preset === "wealth_roadmap"
              ? "PW Wealth Roadmap"
              : "Planning summary"
          }
          onChange={(v) => setBuildReportInputs({ title: v })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Report type">
          <Select
            value={r.preset}
            onChange={(v) => {
              const preset =
                v === "wealth_roadmap" ? "wealth_roadmap" : "custom";
              setBuildReportInputs({
                preset,
                ...(preset === "wealth_roadmap" &&
                r.title.trim() === "Planning summary"
                  ? { title: "PW Wealth Roadmap" }
                  : {}),
                ...(preset === "wealth_roadmap"
                  ? { sections: roadmapSections(r.scope) }
                  : {}),
              });
            }}
            options={[
              { value: "custom", label: "Custom sections" },
              { value: "wealth_roadmap", label: "PW Wealth Roadmap" },
            ]}
          />
        </Field>
      </div>

      {r.preset === "wealth_roadmap" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Roadmap scope">
            <Select
              value={r.scope}
              onChange={(v) => {
                const scope = v === "full" ? "full" : "focused";
                setBuildReportInputs({
                  scope,
                  sections: roadmapSections(scope),
                });
              }}
              options={[
                { value: "focused", label: "Focused" },
                { value: "full", label: "Full" },
              ]}
            />
          </Field>
          <Field label="Assumption version">
            <TextInput
              value={r.assumptionVersion}
              placeholder="2026.07"
              onChange={(v) => setBuildReportInputs({ assumptionVersion: v })}
            />
          </Field>
          <Field label="CMA version">
            <TextInput
              value={r.cmaVersion}
              placeholder="engine-default-cma"
              onChange={(v) => setBuildReportInputs({ cmaVersion: v })}
            />
          </Field>
          <Field label="Tax year">
            <NumberInput
              value={r.taxYear}
              onChange={(v) => setBuildReportInputs({ taxYear: v })}
            />
          </Field>
          <Field label="Replay seed">
            <NumberInput
              value={r.seed}
              onChange={(v) => setBuildReportInputs({ seed: v })}
            />
          </Field>
          <div className="col-span-2">
            <Field label="Engine reference">
              <TextInput
                value={r.engineReference}
                placeholder="nexus-core"
                onChange={(v) => setBuildReportInputs({ engineReference: v })}
              />
            </Field>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <SectionHeader title="Sections" addLabel="Section" onAdd={addSection} />
        {r.sections.length === 0 && <Empty>No sections yet. Add one.</Empty>}
        {r.sections.map((s, i) => (
          <Card key={i} onRemove={() => removeSection(i)}>
            <div className="grid grid-cols-2 gap-3 pr-4">
              <Field label="Kind">
                <TextInput
                  value={s.kind}
                  placeholder="summary"
                  onChange={(v) => patchSection(i, { kind: v })}
                />
              </Field>
              <Field label="Title (optional)">
                <TextInput
                  value={s.title}
                  placeholder="Overview"
                  onChange={(v) => patchSection(i, { title: v })}
                />
              </Field>
            </div>
            <div className="mt-3 pr-4">
              <Field label="Findings (one per line)">
                <textarea
                  value={s.findingsText}
                  rows={2}
                  onChange={(e) =>
                    patchSection(i, { findingsText: e.target.value })
                  }
                  className="w-full border border-stone-300 bg-white px-2 py-1 font-mono text-sm focus:border-stone-900 focus:outline-none"
                />
              </Field>
            </div>
          </Card>
        ))}
      </div>

      <label className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-wider text-stone-600">
        <input
          type="checkbox"
          checked={r.includeRegime}
          onChange={(e) =>
            setBuildReportInputs({ includeRegime: e.target.checked })
          }
          className="accent-stone-900"
        />
        Annotate the live regime
      </label>

      <IssueList issues={issues} />

      <RunButton
        running={running}
        disabled={!runnable}
        onClick={run}
        label="Build report"
      />
    </section>
  );
}

export function BuildPlanningReportResults() {
  const { buildReportResult: result, error, running } = useScenario();
  return (
    <ResultShell
      error={error}
      running={running}
      hasResult={result !== null}
      emptyText="No report yet. Add sections and build."
    >
      {result && <ReportPanel result={result} />}
    </ResultShell>
  );
}

function Section({ section }: { section: PlanningReportSection }) {
  return (
    <div className="border border-stone-300 p-3">
      <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-400">
        {section.kind}
      </p>
      <h3 className="font-mono text-sm text-stone-800">{section.title}</h3>
      {section.metadata && (
        <p className="mt-1 font-mono text-[0.6rem] text-stone-500">
          <MetadataText metadata={section.metadata} />
        </p>
      )}
      {section.findings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {section.findings.map((f, i) => (
            <li
              key={i}
              className="font-mono text-[0.65rem] leading-relaxed text-stone-600"
            >
              • {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetadataText({
  metadata,
}: {
  metadata: PlanningReportMetadata & { scope?: string };
}) {
  return (
    <>
      assumptions {metadata.assumptionVersion} · CMA {metadata.cmaVersion} · tax{" "}
      {metadata.taxYear} · seed {metadata.seed}
      {metadata.scope ? ` · ${metadata.scope}` : ""}
      {metadata.engineReference ? ` · ${metadata.engineReference}` : ""}
    </>
  );
}

function ReportPanel({ result }: { result: BuildPlanningReportResult }) {
  const report = result.report;
  const release = report.release;
  return (
    <section className="space-y-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
        Result
      </h2>

      <div className="border border-stone-300 bg-stone-50 p-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
          {report.preset === "wealth_roadmap"
            ? `PW Wealth Roadmap · ${report.scope ?? "focused"}`
            : report.regime
              ? `Regime · ${report.regime}`
              : "Report"}
        </p>
        <p className="font-mono text-xl text-stone-800">{report.title}</p>
        <p className="mt-1 font-mono text-[0.65rem] text-stone-500">
          {report.sections.length} sections
        </p>
        {report.metadata && (
          <p className="mt-2 font-mono text-[0.6rem] text-stone-500">
            <MetadataText metadata={report.metadata} />
          </p>
        )}
      </div>

      {release && (
        <div
          className={`border p-3 ${
            release.blocked
              ? "border-amber-300 bg-amber-50"
              : "border-emerald-300 bg-emerald-50"
          }`}
        >
          <p className="font-mono text-[0.6rem] uppercase tracking-wider text-stone-500">
            Release state
          </p>
          <p className="mt-1 font-mono text-[0.7rem] text-stone-700">
            {release.blocked
              ? release.blockReason
              : release.released
                ? "Released"
                : "Not released"}
          </p>
          {release.uncuratedPriorityActions > 0 && (
            <p className="mt-1 font-mono text-[0.65rem] text-stone-600">
              {release.uncuratedPriorityActions} uncurated priority actions
            </p>
          )}
        </div>
      )}

      {(report.scopeStatement || report.planningBenefitNotice) && (
        <div className="space-y-2 border border-stone-300 p-3">
          {report.scopeStatement && (
            <p className="font-mono text-[0.65rem] leading-relaxed text-stone-600">
              {report.scopeStatement}
            </p>
          )}
          {report.planningBenefitNotice && (
            <p className="font-mono text-[0.65rem] leading-relaxed text-stone-600">
              {report.planningBenefitNotice}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {report.sections.map((section, i) => (
          <Section key={`${section.kind}-${i}`} section={section} />
        ))}
      </div>

      {report.assumptions.length > 0 && (
        <div>
          <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
            Assumptions
          </h3>
          <ul className="mt-2 space-y-1">
            {report.assumptions.map((a, i) => (
              <li
                key={i}
                className="font-mono text-[0.65rem] leading-relaxed text-stone-600"
              >
                • {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.disclaimer && (
        <p className="font-mono text-[0.65rem] leading-relaxed text-stone-500">
          {result.disclaimer}
        </p>
      )}

      <p className="font-mono text-[0.65rem] text-stone-500">
        contract {result.contractVersion} · educational, not advice
      </p>
    </section>
  );
}
