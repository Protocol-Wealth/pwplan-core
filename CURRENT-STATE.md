# CURRENT-STATE.md

_Last updated: 2026-05-30 (save/load + presets + a11y + SPDX headers; PR #1 merged to main). Session-start snapshot; maintain it._

## Status

Verified green locally: typecheck clean, lint clean, prettier clean, 104 tests
pass (8 test files), build succeeds (~235 kB / ~72 kB gzip). **This repo is now
positioned as demo / case-study tooling**: it runs
against the public nexus-core MCP engine (`https://nexusmcp.site` by default, no
`.env` needed) with de-identified / fake client data. The production compliance
stack (pwos-core PII de-identification + audit log) and any pw-api integration
have been **removed from this OSS repo** and live only in a private fork; the
`pw-api` gateway seam is kept so that fork stays a low-diff sync. The UI exposes
three tools via a tab bar (Monte Carlo, Glide path, Tax withdrawal), each wired
to its gateway method with client-side request-shape validation and hand-rolled
SVG/CSS results (no chart library). Accounts/asset classes are a shared portfolio.
Plan inputs can be saved/loaded as PII-free JSON and seeded from built-in
case-study presets. Every first-party source file carries an SPDX Apache-2.0
header. The demo-reframe work shipped via PR #1 (CCO + CTO/CISO approved) and is
merged to `main`; `main` is the live line again.

## Architecture as built

Thin UI → `planning-gateway` → `nexus-mcp` (open; the only backend this repo
uses) | `pw-api` (private-fork seam). Wire contract v0.1.0, PII-free and enforced
by test. `assertNoPII` is a small, always-on, dependency-free structural tripwire
(`src/lib/compliance.ts`); `auditCall` is a no-op seam (writes nothing). See
README.md "Compliance scope". The UI exposes three tools behind a tab bar, each
wired to its gateway method (`planning.monteCarlo` / `glidePath` /
`taxWithdrawal`); the remaining two contract tools (correlation_matrix,
regime_return_generator) are in the contract but not yet surfaced as their own UI.

## File inventory

_(Every first-party source file below carries an SPDX Apache-2.0 header.)_

- `src/contract/planning.ts` — wire contract v0.1.0; 5 tools; PII-free invariant.
- `src/contract/planning.test.ts` — contract + PII-free enforcement (13 tests).
- `src/lib/planning-gateway.ts` — backend-agnostic transport; ContractMismatchError; subjectRef header; ACTIVE_BACKEND export.
- `src/lib/planning-gateway.test.ts` — offline integration test (fetch mocked): PiiTripwireError + ContractMismatchError paths, tool-id/path/header wiring for all 5 tools, pw-api seam; 9 tests.
- `src/lib/compliance.ts` / `.test.ts` — always-on dep-free structural PII tripwire (`assertNoPII` + `findIdentityKey`) and a no-op `auditCall` seam; 9 tests. NOT the production compliance stack (that's private-fork + pwos-core).
- `src/store/scenario.ts` — Zustand store: active `tool` + per-tool inputs (scenario / glidePath / tax) and result slots; accounts/asset classes are one shared portfolio. Seeded valid defaults.
- `src/components/ScenarioForm.tsx` — Monte Carlo editor: plan params, asset classes (id/label/return/vol/λ), accounts (type/balance/allocation), guaranteed income, filing status; Run gated on validity.
- `src/components/GlidePathTool.tsx` — glide-path form + equity-weight-by-age line chart (fixed 0–1 axis).
- `src/components/TaxWithdrawalTool.tsx` — tax form over the shared portfolio + withdrawals-by-account table (total tax, effective rate, RMD indicator).
- `src/components/scenario-io.ts` / `.test.ts` — pure, versioned, PII-free serialize/parse for plan inputs (fail-closed `assertNoPII` on save + on the raw input at load); 13 tests. No browser storage.
- `src/components/scenario-presets.ts` / `.test.ts` — three built-in case-study snapshots (accumulator / near-retiree / crisis-stress), each validator-clean and round-trip-safe; 15 tests.
- `src/components/ScenarioIO.tsx` — Save (Blob download) / Load (file input) / preset picker; uses the store's `loadSnapshot`.
- `src/components/scenario-validation.ts` / `.test.ts` — pure scenario request-shape validation (allocation-sums-to-1, unique ids, known-id refs); 15 tests. No quant logic.
- `src/components/tool-validation.ts` / `.test.ts` — pure glide-path + tax request-shape validation (ranges, age ordering, portfolio presence); 10 tests. No quant logic.
- `src/components/ResultsPanel.tsx` — Monte Carlo results: success probability + 3 hand-rolled charts (median-balance line/area, terminal percentile bars, regime strip when present). Inline SVG/CSS, no chart lib.
- `src/components/results-viz.ts` / `.test.ts` — pure geometry helpers (seriesGeometry incl. forcedMax, percentileBars, regimeRuns, ageWeightSeries); 20 tests. Presentation math only.
- `src/components/format.ts`, `form-controls.tsx`, `charts.tsx`, `result-shell.tsx` — shared presentational primitives (formatters, form controls, generic LineChart, error/running/empty framing). No logic of substance.
- `src/App.tsx` (tool tab bar + ScenarioIO), `src/main.tsx`, `src/index.css`, `index.html` — shell.
- `scripts/smoke-nexus.mjs` — opt-in live round-trip against nexusmcp.site (PII-free default scenario); not in the gate suite, never in CI.
- `docs/nexus-core-requirements.md` — consumer-side spec of what the nexus-core MCP server must provide (5 tools, enums, CORS/determinism, demo capabilities, contract gaps).
- Configs: `package.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `.env.example`.
- CI: `.github/workflows/ci.yml` (7 jobs).
- `LICENSE` (Apache-2.0), `NOTICE` (patent TODO), `README.md`, `CONTRIBUTING.md`.
- Governance: `CLAUDE.md`, `CURRENT-STATE.md`, `CHANGELOG.md`, `ROADMAP.md`.

## Wired vs stubbed

- **Wired:** contract, gateway transport, PII tripwire (always-on, dep-free),
  store, UI, CI, tests.
- **Seam / no-op:** `auditCall` writes nothing here; the `pw-api` backend branch
  exists for the private fork. Production compliance (pwos-core) is intentionally
  absent — out of scope for this OSS repo.
- nexus-core MCP serves the contract at `nexusmcp.site` for demos; a local engine
  is optional.

## Known gaps

- Charts have no automated render test (no React Testing Library — adding one
  would pull in a heavy dev dep, against repo rules). The pure geometry helpers
  in `results-viz.ts` are unit-tested; `ResultsPanel` composition is verified by
  eye / typecheck only.
- Form validation is request-shape only (allocations sum to 1, known ids, etc.);
  it intentionally does not validate financial sanity (that is the engine's job).
- The gateway dispatch path has offline integration coverage
  (`planning-gateway.test.ts`, fetch mocked). There is no automated test against
  the _live_ `nexusmcp.site` (deliberate — a flaky external engine must not gate
  CI); `scripts/smoke-nexus.mjs` is the opt-in manual check.
- `NOTICE` patent application number is a placeholder (blocked on the maintainer).
- The two contract tools `correlation_matrix` and `regime_return_generator` have
  contract types + gateway methods but no dedicated UI yet.

## Next planned work

- **Contract additive changes (next up):** add `pathCacheKey?` to
  `MonteCarloRequest` and a `capital_market_assumptions` tool, folded into v0.1.0
  with NO version bump (the nexus-core engine is pre-first-release, so amending
  0.1.0 is not breaking; bumping would break the exact-match `ContractMismatchError`
  against an engine shipping 0.1.0). See `docs/nexus-core-requirements.md` §6.
- **Theming** to the `-core` family visual language (needs a design reference).
- **NOTICE patent number** when issued.
