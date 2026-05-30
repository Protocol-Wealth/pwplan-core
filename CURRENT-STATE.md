# CURRENT-STATE.md

_Last updated: 2026-05-30 (glide-path + tax-withdrawal tools). Session-start snapshot; maintain it._

## Status

Verified green locally: typecheck clean, lint clean, prettier clean, 58 tests
pass, build succeeds (~225 kB / ~69 kB gzip). The pwos-core compliance packages
and the nexus-core planning engine are **not yet wired**; the app runs in UI-dev
mode with `VITE_COMPLIANCE_NOOP=1`. The UI now exposes three tools via a tab bar
(Monte Carlo, Glide path, Tax withdrawal), each wired to its gateway method with
client-side request-shape validation and hand-rolled SVG/CSS results (no chart
library). Accounts/asset classes are a single shared portfolio.

## Architecture as built

Thin UI → `planning-gateway` → (`nexus-mcp` | `pw-api`). Wire contract v0.1.0,
PII-free and enforced by test. Compliance is a fail-closed tripwire (stubbed).
See README.md for the two-deployment diagram. The UI exposes three tools behind a
tab bar (Monte Carlo, Glide path, Tax withdrawal), each wired to its gateway
method (`planning.monteCarlo` / `glidePath` / `taxWithdrawal`); the remaining two
contract tools (correlation_matrix, regime_return_generator) are in the contract
but not yet surfaced as their own UI.

## File inventory

- `src/contract/planning.ts` — wire contract v0.1.0; 5 tools; PII-free invariant.
- `src/contract/planning.test.ts` — contract + PII-free enforcement (13 tests).
- `src/lib/planning-gateway.ts` — backend-agnostic transport; ContractMismatchError; subjectRef header; ACTIVE_BACKEND export.
- `src/lib/compliance.ts` — assertNoPII tripwire + auditCall; pwos-core peer-dep impls commented.
- `src/store/scenario.ts` — Zustand store: active `tool` + per-tool inputs (scenario / glidePath / tax) and result slots; accounts/asset classes are one shared portfolio. Seeded valid defaults.
- `src/components/ScenarioForm.tsx` — Monte Carlo editor: plan params, asset classes (id/label/return/vol/λ), accounts (type/balance/allocation), guaranteed income, filing status; Run gated on validity.
- `src/components/GlidePathTool.tsx` — glide-path form + equity-weight-by-age line chart (fixed 0–1 axis).
- `src/components/TaxWithdrawalTool.tsx` — tax form over the shared portfolio + withdrawals-by-account table (total tax, effective rate, RMD indicator).
- `src/components/scenario-validation.ts` / `.test.ts` — pure scenario request-shape validation (allocation-sums-to-1, unique ids, known-id refs); 15 tests. No quant logic.
- `src/components/tool-validation.ts` / `.test.ts` — pure glide-path + tax request-shape validation (ranges, age ordering, portfolio presence); 10 tests. No quant logic.
- `src/components/ResultsPanel.tsx` — Monte Carlo results: success probability + 3 hand-rolled charts (median-balance line/area, terminal percentile bars, regime strip when present). Inline SVG/CSS, no chart lib.
- `src/components/results-viz.ts` / `.test.ts` — pure geometry helpers (seriesGeometry incl. forcedMax, percentileBars, regimeRuns, ageWeightSeries); 20 tests. Presentation math only.
- `src/components/format.ts`, `form-controls.tsx`, `charts.tsx`, `result-shell.tsx` — shared presentational primitives (formatters, form controls, generic LineChart, error/running/empty framing). No logic of substance.
- `src/App.tsx` (tool tab bar), `src/main.tsx`, `src/index.css`, `index.html` — shell.
- Configs: `package.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `.env.example`.
- CI: `.github/workflows/ci.yml` (8 jobs).
- `LICENSE` (Apache-2.0), `NOTICE` (patent TODO), `README.md`, `CONTRIBUTING.md`.
- Governance: `CLAUDE.md`, `CURRENT-STATE.md`, `CHANGELOG.md`, `ROADMAP.md`.

## Wired vs stubbed

- **Wired:** contract, gateway transport, store, UI, CI, tests.
- **Stubbed:** pwos-core pii-guard / audit-log (commented; no-op in dev).
  nexus-core planning tools (server side) do not exist yet, so the gateway will
  404 until a backend is running.

## Known gaps

- Charts have no automated render test (no React Testing Library — adding one
  would pull in a heavy dev dep, against repo rules). The pure geometry helpers
  in `results-viz.ts` are unit-tested; `ResultsPanel` composition is verified by
  eye / typecheck only.
- Form validation is request-shape only (allocations sum to 1, known ids, etc.);
  it intentionally does not validate financial sanity (that is the engine's job).
- No live backend to integration-test against, so charts are unexercised against
  real engine output (only the seeded happy path + unit-tested geometry).
- `NOTICE` patent application number is a placeholder.
