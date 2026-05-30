# CURRENT-STATE.md

_Last updated: 2026-05-29 (glide-path + tax-withdrawal tools). Session-start snapshot; maintain it._

## Status

Verified green locally: typecheck clean, lint clean, prettier clean, 57 tests
pass, build succeeds (~218 kB / ~68 kB gzip). The pwos-core compliance packages
and the nexus-core planning engine are **not yet wired**; the app runs in UI-dev
mode with `VITE_COMPLIANCE_NOOP=1`. The UI now exposes three tools via a tab bar
(Monte Carlo, Glide path, Tax withdrawal), each wired to its gateway method with
client-side request-shape validation and hand-rolled SVG/CSS results (no chart
library). Accounts/asset classes are a single shared portfolio.

## Architecture as built

Thin UI → `planning-gateway` → (`nexus-mcp` | `pw-api`). Wire contract v0.1.0,
PII-free and enforced by test. Compliance is a fail-closed tripwire (stubbed).
See README.md for the two-deployment diagram.

## File inventory

- `src/contract/planning.ts` — wire contract v0.1.0; 5 tools; PII-free invariant.
- `src/contract/planning.test.ts` — contract + PII-free enforcement (13 tests).
- `src/lib/planning-gateway.ts` — backend-agnostic transport; ContractMismatchError; subjectRef header; ACTIVE_BACKEND export.
- `src/lib/compliance.ts` — assertNoPII tripwire + auditCall; pwos-core peer-dep impls commented.
- `src/store/scenario.ts` — Zustand scenario state; DEFAULT_INPUTS seeded with a valid balanced scenario.
- `src/components/ScenarioForm.tsx` — full scenario editor: plan params, asset classes (id/label/return/vol/λ), accounts (type/balance/allocation), guaranteed income, filing status; Run disabled with inline reasons until valid.
- `src/components/scenario-validation.ts` — pure request-shape validation (allocation-sums-to-1, unique ids, known-id refs). No quant logic.
- `src/components/scenario-validation.test.ts` — 15 unit tests (incl. float-tolerance band boundaries).
- `src/components/ResultsPanel.tsx` — success probability + 3 hand-rolled charts: median-balance line/area, terminal-value percentile bars, regime-path strip (when present). Inline SVG/CSS, no chart lib.
- `src/components/results-viz.ts` — pure geometry helpers (seriesGeometry, percentileBars, regimeRuns). Presentation math only; no quant logic.
- `src/components/results-viz.test.ts` — 15 unit tests (SVG coords, percentile bars, regime runs).
- `src/App.tsx`, `src/main.tsx`, `src/index.css`, `index.html` — shell.
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
