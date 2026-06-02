# CURRENT-STATE.md

_Last updated: 2026-06-01 (contract+gateway now cover 8 tools; added two new tool tabs — Roth conversion + Sequence-of-returns stress — wired contract → gateway → UI, matching nexus-core's new tools. These go live when nexus-core PR #100 deploys. Earlier this session: the two `0.1.0` additions (`capital_market_assumptions` + `pathCacheKey?`) + the "real data, fake clients" Monte Carlo control. No version bump). Session-start snapshot; maintain it._

## Status

Verified green locally: typecheck clean, lint clean, prettier clean, 124 tests
pass (8 test files), build succeeds (~248 kB / ~75 kB gzip). **This repo is now
positioned as demo / case-study tooling**: it runs
against the public nexus-core MCP engine (`https://nexusmcp.site` by default, no
`.env` needed) with de-identified / fake client data. The production compliance
stack (pwos-core PII de-identification + audit log) and any pw-api integration
have been **removed from this OSS repo** and live only in a private fork; the
`pw-api` gateway seam is kept so that fork stays a low-diff sync. The UI exposes
five tools via a tab bar (Monte Carlo, Glide path, Tax withdrawal, Roth
conversion, Sequence risk), each wired to its gateway method with client-side
request-shape validation and hand-rolled SVG/CSS results (no chart library).
Accounts/asset classes are a shared portfolio.
Plan inputs can be saved/loaded as PII-free JSON and seeded from built-in
case-study presets. Every first-party source file carries an SPDX Apache-2.0
header. The demo-reframe work shipped via PR #1 (CCO + CTO/CISO approved) and is
merged to `main`; `main` is the live line again.

## Architecture as built

Thin UI → `planning-gateway` → `nexus-mcp` (open; the only backend this repo
uses) | `pw-api` (private-fork seam). Wire contract v0.1.0, PII-free and enforced
by test. `assertNoPII` is a small, always-on, dependency-free structural tripwire
(`src/lib/compliance.ts`); `auditCall` is a no-op seam (writes nothing). See
README.md "Compliance scope". The contract + gateway now cover **8** engine
tools; the UI exposes five behind a tab bar (`planning.monteCarlo` / `glidePath`
/ `taxWithdrawal` / `rothConversion` / `sequenceOfReturnsStress`), plus the
`capitalMarketAssumptions` control inside the Monte Carlo tab. Only
`correlation_matrix` and `regime_return_generator` remain contract+gateway-only
(no dedicated UI). The Roth + Sequence tools call nexus-core tools that go live
when nexus-core PR #100 merges and deploys (engine side already tested there).

## File inventory

_(Every first-party source file below carries an SPDX Apache-2.0 header.)_

- `src/contract/planning.ts` — wire contract v0.1.0; **8 tools**; PII-free invariant.
  `MonteCarloRequest` carries an optional `retirementAge?` + `pathCacheKey?`.
  `CapitalMarketAssumptionsRequest`/`Result` source real returns/vols/λ/correlations
  that drop straight into a `MonteCarloRequest`. `RothConversionRequest`/`Result`
  (convert-now vs leave-pre-tax) and `SequenceOfReturnsStressRequest`/`Result`
  (+ `SequenceOutcome`) are the 7th/8th tools.
- `src/contract/planning.test.ts` — contract + PII-free enforcement (13 tests).
- `src/lib/planning-gateway.ts` — backend-agnostic transport; ContractMismatchError; subjectRef header; ACTIVE_BACKEND export; one `planning.*` method per tool (8).
- `src/lib/planning-gateway.test.ts` — offline integration test (fetch mocked): PiiTripwireError + ContractMismatchError paths, tool-id/path/header wiring for all 8 tools, CMA drop-in round-trip, `pathCacheKey` passthrough, Roth + Sequence dispatch, pw-api seam; 13 tests.
- `src/lib/compliance.ts` / `.test.ts` — always-on dep-free structural PII tripwire (`assertNoPII` + `findIdentityKey`) and a no-op `auditCall` seam; 9 tests. NOT the production compliance stack (that's private-fork + pwos-core).
- `src/store/scenario.ts` — Zustand store: active `tool` (5 UI tools) + per-tool inputs (scenario / glidePath / tax / roth / sor) and result slots; accounts/asset classes are one shared portfolio. Seeded valid defaults. Plus an ephemeral `assumptions` slice (`{ asOf, correlations }` + `loadingAssumptions`) holding live engine capital-market assumptions — outside `ScenarioInputs` (re-fetched, not persisted; cleared on snapshot load).
- `src/components/ScenarioForm.tsx` — Monte Carlo editor: plan params (current / retirement / horizon age, spend, COLA, paths, filing status, return model), asset classes (id/label/return/vol/λ), accounts (type/balance/allocation), guaranteed income; Run gated on validity. Includes the **"Load real market assumptions"** control (calls `capital_market_assumptions`, drops real returns/vols/λ onto the current portfolio + carries the engine correlation matrix into the run; provenance `asOf` line + a compact read-only `CorrelationMatrix`).
- `src/components/GlidePathTool.tsx` — glide-path form + equity-weight-by-age line chart (fixed 0–1 axis).
- `src/components/TaxWithdrawalTool.tsx` — tax form over the shared portfolio + withdrawals-by-account table (total tax, effective rate, RMD indicator).
- `src/components/RothConversionTool.tsx` — Roth-conversion form (income, filing status, conversion amount, growth, years, retirement rate, pay-from-conversion toggle) + results panel (net benefit, breakeven rate, incremental conversion tax + effective rate, both terminal after-tax values).
- `src/components/SequenceStressTool.tsx` — sequence-of-returns-stress form (initial balance, constant annual spend, comma-separated returns) + results panel (sequence-risk gap + each ordering's terminal balance + depletion year).
- `src/components/scenario-io.ts` / `.test.ts` — pure, versioned, PII-free serialize/parse for plan inputs (fail-closed `assertNoPII` on save + on the raw input at load); 13 tests. No browser storage.
- `src/components/scenario-presets.ts` / `.test.ts` — three built-in case-study snapshots (accumulator / near-retiree / crisis-stress), each validator-clean and round-trip-safe; 15 tests.
- `src/components/ScenarioIO.tsx` — Save (Blob download) / Load (file input) / preset picker; uses the store's `loadSnapshot`.
- `src/components/scenario-validation.ts` / `.test.ts` — pure scenario request-shape validation (allocation-sums-to-1, unique ids, known-id refs, age ordering `currentAge ≤ retirementAge < horizonAge`); 20 tests. No quant logic.
- `src/components/tool-validation.ts` / `.test.ts` — pure request-shape validation for glide-path, tax, Roth (`validateRoth`) and sequence-stress (`validateSequenceStress` + `parseReturns`); ranges, age ordering, portfolio presence, return parsing; 21 tests. No quant logic.
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
- Of the 8 contract tools, the UI surfaces six: Monte Carlo, Glide path, Tax
  withdrawal, Roth conversion, Sequence risk (tabs) + `capital_market_assumptions`
  (the Monte Carlo "Load real market assumptions" control). Only
  `correlation_matrix` and `regime_return_generator` remain contract+gateway-only
  (no dedicated UI) — engine-internal; `regime_return_generator` would pair with
  the `pathCacheKey` reuse path.
- The Roth conversion + Sequence risk tabs call nexus-core tools added in
  nexus-core PR #100; until that merges + deploys, those two tabs return a gateway
  error against the live engine (the client side is fully tested offline).

## Next planned work

- **Contract additive changes — DONE (2026-06-01).** `pathCacheKey?` on
  `MonteCarloRequest` and the `capital_market_assumptions` tool are now in the
  contract + gateway + tests, folded into v0.1.0 with NO version bump, matching
  the live 6-tool engine. `NEXT-PROMPT.md` (now stale) can be deleted; the only
  remaining piece of that hand-off is its step 4 — the CMA UI flow (see below).
- **CMA "real data, fake clients" UI — DONE (2026-06-01).** The Monte Carlo form
  loads real engine assumptions + correlations onto a de-identified portfolio
  (verified end-to-end live).
- **Roth conversion + Sequence-of-returns-stress tools — DONE (2026-06-01).**
  Contract + gateway + UI tabs (8 tools total). Engine side in nexus-core PR #100;
  the tabs go live once it deploys. A live smoke check of the two new tools is the
  follow-up after deploy.
- **Standalone `correlation_matrix` / `regime_return_generator` tabs (optional):**
  dedicated tool tabs for the last two contract tools; `regime_return_generator`
  would close the `pathCacheKey` reuse loop (generate EMF paths → replay the key
  in a Monte Carlo run). Lower priority — engine-internal surfaces.
- **Theming** to the `-core` family visual language (needs a design reference).
- **NOTICE patent number** when issued.
