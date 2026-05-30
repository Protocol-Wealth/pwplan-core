# CURRENT-STATE.md

_Last updated: 2026-05-30 (initial scaffold). Session-start snapshot; maintain it._

## Status

Scaffold complete and verified green locally: typecheck clean, lint clean,
prettier clean, 13 tests pass, build succeeds (~203 kB / ~64 kB gzip). The
pwos-core compliance packages and the nexus-core planning engine are **not yet
wired**; the app runs in UI-dev mode with `VITE_COMPLIANCE_NOOP=1`.

## Architecture as built

Thin UI → `planning-gateway` → (`nexus-mcp` | `pw-api`). Wire contract v0.1.0,
PII-free and enforced by test. Compliance is a fail-closed tripwire (stubbed).
See README.md for the two-deployment diagram.

## File inventory

- `src/contract/planning.ts` — wire contract v0.1.0; 5 tools; PII-free invariant.
- `src/contract/planning.test.ts` — contract + PII-free enforcement (13 tests).
- `src/lib/planning-gateway.ts` — backend-agnostic transport; ContractMismatchError; subjectRef header; ACTIVE_BACKEND export.
- `src/lib/compliance.ts` — assertNoPII tripwire + auditCall; pwos-core peer-dep impls commented.
- `src/store/scenario.ts` — Zustand scenario state.
- `src/components/ScenarioForm.tsx` — basic inputs (age, horizon, spend, COLA, paths, return model).
- `src/components/ResultsPanel.tsx` — tabular results (success prob, terminal percentiles).
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

- ScenarioForm does not yet capture accounts, asset classes (with λ), allocations,
  or guaranteed income; the contract supports them, the UI does not collect them.
- ResultsPanel is tabular; no charts.
- No live backend to integration-test against.
- `NOTICE` patent application number is a placeholder.
