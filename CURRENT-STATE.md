# CURRENT-STATE.md

_Last updated: 2026-06-03 (added the **Roth · IRMAA** composite-planner tab — 16th UI tab — consuming the new **case contract** `src/contract/roth-conversion.ts` (`PLANNING_CASE_CONTRACT_VERSION = 1.0.0`), distinct from the v0.1.0 wire contract; new `analyzeRothConversion` gateway method + `validateRothIrmaa` + `RothIrmaaPlannerTool`; +12 tests. Earlier 2026-06-02: FIRE/Risk-metrics/Rebalance tabs (nexus-core #117), the regime-aware Portfolio X-ray tab (#116), Correlation + Regime-paths tabs, the four calculator tabs, Roth + Sequence, the `0.1.0` additions, the CMA control. No version bump). Session-start snapshot; maintain it._

## Status

Verified green locally: typecheck clean, lint clean, prettier clean, 173 tests
pass (8 test files), build succeeds (~287 kB / ~82 kB gzip). **This repo is now
positioned as demo / case-study tooling**: it runs
against the public nexus-core MCP engine (`https://nexusmcp.site` by default, no
`.env` needed) with de-identified / fake client data. The production compliance
stack (pwos-core PII de-identification + audit log) and any pw-api integration
have been **removed from this OSS repo** and live only in a private fork; the
`pw-api` gateway seam is kept so that fork stays a low-diff sync. The UI exposes
**twelve** tools via a wrapping tab bar (Monte Carlo, Glide path, Tax withdrawal,
Roth conversion, Sequence risk, RMD, Bracket room, Social Security, Regime SWR,
Correlation, Regime paths, X-ray), each wired to its gateway method with
client-side request-shape validation and hand-rolled SVG/CSS results (no chart
library). Accounts/asset classes are a shared portfolio.
Plan inputs can be saved/loaded as PII-free JSON and seeded from built-in
case-study presets. Every first-party source file carries an SPDX Apache-2.0
header. The demo-reframe work shipped via PR #1 (CCO + CTO/CISO approved) and is
merged to `main`; `main` is the live line again.

## Architecture as built

Thin UI → `planning-gateway` → `nexus-mcp` (open; the only backend this repo
uses) | `pw-api` (private-fork seam). Wire contract v0.1.0, PII-free and enforced
by test. `assertNoPII` is a small, always-on, dependency-free structural tripwire
(`src/lib/compliance.ts`); `auditCall` is a no-op seam (writes nothing). See
README.md "Compliance scope". The contract + gateway cover all **13** engine
tools; the UI exposes twelve behind a wrapping tab bar (monteCarlo / glidePath /
taxWithdrawal / rothConversion / sequenceOfReturnsStress / rmd / taxBracketHeadroom
/ socialSecurityClaiming / regimeConditionedSwr / correlationMatrix /
regimeReturnGenerator / portfolioXray), plus the `capitalMarketAssumptions` control
inside the Monte Carlo tab — i.e. **every tool is surfaced.** Tabs run against the
live engine; tools through nexus-core #101 (rev nexus-core-00041) are smoke-verified
live. The X-ray tool (#116) + the #115 dep batch are merged-but-not-yet-deployed —
they go live on the next deploy.

## File inventory

_(Every first-party source file below carries an SPDX Apache-2.0 header.)_

- `src/contract/planning.ts` — wire contract v0.1.0; **16 tools**; PII-free invariant.
  `MonteCarloRequest` carries an optional `retirementAge?` + `pathCacheKey?`.
  `CapitalMarketAssumptionsRequest`/`Result` source real returns/vols/λ/correlations
  that drop straight into a `MonteCarloRequest`. Plus `RothConversionRequest`/`Result`,
  `SequenceOfReturnsStressRequest`/`Result` (+ `SequenceOutcome`), `RmdRequest`/`Result`,
  `TaxBracketHeadroomRequest`/`Result`, `SocialSecurityClaimingRequest`/`Result`
  (+ `SocialSecurityClaimRow`/`Breakeven`), `RegimeConditionedSwrRequest`/`Result`,
  `PortfolioXrayRequest`/`Result` (+ `XrayFinding`/`XraySeverity`), `FireRequest`/`Result`,
  `RiskMetricsRequest`/`Result`, `RebalanceRequest`/`Result` (+ `RebalanceRow`).
- `src/contract/planning.test.ts` — contract + PII-free enforcement (13 tests).
- `src/contract/roth-conversion.ts` — the **case contract** `PLANNING_CASE_CONTRACT_VERSION = 1.0.0` (a mirror of `@protocolwealthos/planning-contract` / the nexus-core JSON-Schema): `PlanningContract` + `RothConversionAnalysis` (+ nested) for the composite Roth/IRMAA analysis. Distinct from the v0.1.0 wire contract; PII-free. `roth-conversion.test.ts` enforces semver + the PII-free invariant.
- `src/lib/planning-gateway.ts` — backend-agnostic transport; ContractMismatchError; subjectRef header; ACTIVE_BACKEND export; one `planning.*` method per wire tool (16) + the composite `analyzeRothConversion(req)` (POST `/mcp/tools/analyze_roth_conversion`; opaque `case_id` minted at dispatch).
- `src/lib/planning-gateway.test.ts` — offline integration test (fetch mocked): PiiTripwireError + ContractMismatchError paths, tool-id/path/header wiring for all 16 tools, CMA drop-in round-trip, `pathCacheKey` passthrough, per-tool dispatch shape checks, pw-api seam; 23 tests.
- `src/lib/compliance.ts` / `.test.ts` — always-on dep-free structural PII tripwire (`assertNoPII` + `findIdentityKey`) and a no-op `auditCall` seam; 9 tests. NOT the production compliance stack (that's private-fork + pwos-core).
- `src/store/scenario.ts` — Zustand store: active `tool` (15 UI tools) + per-tool inputs (scenario / glidePath / tax / roth / sor / rmd / bracket / socialSecurity / regimeSwr / correlation / regimeGen / fire / riskMetrics / rebalance) + result slots (incl. `xrayResult` / `fireResult` / `riskMetricsResult` / `rebalanceResult`); the Portfolio X-ray + Rebalance reuse the shared scenario portfolio. Accounts/asset classes are one shared portfolio. Seeded valid defaults. Plus an ephemeral `assumptions` slice (`{ asOf, correlations }` + `loadingAssumptions`) holding live engine capital-market assumptions — outside `ScenarioInputs` (re-fetched, not persisted; cleared on snapshot load).
- `src/components/ScenarioForm.tsx` — Monte Carlo editor: plan params (current / retirement / horizon age, spend, COLA, paths, filing status, return model), asset classes (id/label/return/vol/λ), accounts (type/balance/allocation), guaranteed income; Run gated on validity. Includes the **"Load real market assumptions"** control (calls `capital_market_assumptions`, drops real returns/vols/λ onto the current portfolio + carries the engine correlation matrix into the run; provenance `asOf` line + the shared `MatrixTable`).
- `src/components/MatrixTable.tsx` — generic read-only square-matrix renderer (ids × ids → numbers); shared by the CMA control, the Correlation tab, and the Regime-paths transition matrix.
- `src/components/GlidePathTool.tsx` — glide-path form + equity-weight-by-age line chart (fixed 0–1 axis).
- `src/components/TaxWithdrawalTool.tsx` — tax form over the shared portfolio + withdrawals-by-account table (total tax, effective rate, RMD indicator).
- `src/components/RothConversionTool.tsx` — Roth-conversion form (income, filing status, conversion amount, growth, years, retirement rate, pay-from-conversion toggle) + results panel (net benefit, breakeven rate, incremental conversion tax + effective rate, both terminal after-tax values).
- `src/components/SequenceStressTool.tsx` — sequence-of-returns-stress form (initial balance, constant annual spend, comma-separated returns) + results panel (sequence-risk gap + each ordering's terminal balance + depletion year).
- `src/components/RmdTool.tsx` — RMD form (age, prior year-end balance) + results (RMD amount, distribution period, effective rate; "no RMD before 73" when it doesn't apply).
- `src/components/BracketHeadroomTool.tsx` — bracket-headroom/Roth-fill form (taxable income, filing status, target rate) + results (room to next rate, marginal rate, room to fill the target rate).
- `src/components/SocialSecurityTool.tsx` — Social Security form (PIA, FRA) + results (monthly-benefit-by-claim-age bar chart 62–70 + breakeven ages).
- `src/components/RegimeSwrTool.tsx` — regime-SWR form (base rate, portfolio balance) + results (live regime, multiplier, adjusted rate, first-year withdrawal).
- `src/components/CorrelationTool.tsx` — correlation-matrix form (asset-class ids, lookback, shrinkage toggle) + results (`MatrixTable` of the real-data ρ matrix + `asOf`).
- `src/components/RegimeReturnTool.tsx` — regime-return-generator form (horizon, paths; over the shared portfolio's λ-bearing asset classes) + results (current regime, transition `MatrixTable`, `pathCacheKey`).
- `src/components/PortfolioXrayTool.tsx` — regime-aware X-ray over the shared Monte Carlo portfolio (no own inputs) + results (live regime, severity-coded findings, weighted return/vol, portfolio λ, growth sleeve, concentration, account mix). `validatePortfolioXray` reuses `isAllocationBalanced`.
- `src/components/FireTool.tsx` — FIRE / Coast-FIRE form (age/balance/contribution/growth/spend/SWR) + results (FIRE number, coast number + reached flag, projected balance, surplus/gap, years/age to FI). `validateFire`.
- `src/components/RiskMetricsTool.tsx` — risk-metrics form (returns text + risk-free rate + periods/year) + results (annualized return/vol, Sharpe, Sortino, max drawdown, VaR/CVaR). Reuses `parseReturns`; `validateRiskMetrics`.
- `src/components/RebalanceTool.tsx` — rebalance form (an editable target weight per shared asset class; live target-sum readout) + results (one-way turnover, per-asset current/target/trade table). `validateRebalance`.
- `src/components/scenario-io.ts` / `.test.ts` — pure, versioned, PII-free serialize/parse for plan inputs (fail-closed `assertNoPII` on save + on the raw input at load); 13 tests. No browser storage.
- `src/components/scenario-presets.ts` / `.test.ts` — three built-in case-study snapshots (accumulator / near-retiree / crisis-stress), each validator-clean and round-trip-safe; 15 tests.
- `src/components/ScenarioIO.tsx` — Save (Blob download) / Load (file input) / preset picker; uses the store's `loadSnapshot`.
- `src/components/scenario-validation.ts` / `.test.ts` — pure scenario request-shape validation (allocation-sums-to-1, unique ids, known-id refs, age ordering `currentAge ≤ retirementAge < horizonAge`); 20 tests. No quant logic.
- `src/components/tool-validation.ts` / `.test.ts` — pure request-shape validation for glide-path, tax, Roth, sequence-stress (`parseReturns`), RMD, bracket-headroom, Social Security, regime-SWR, correlation (`validateCorrelation` + `parseIdList`), regime-gen (`validateRegimeGen`), portfolio X-ray (`validatePortfolioXray`, reusing `isAllocationBalanced`), FIRE (`validateFire`), risk-metrics (`validateRiskMetrics`), and rebalance (`validateRebalance`); ranges, age ordering, portfolio presence, list parsing, λ presence, target-weight sums; 60 tests. No quant logic.
- `src/components/ResultsPanel.tsx` — Monte Carlo results: success probability + 3 hand-rolled charts (median-balance line/area, terminal percentile bars, regime strip when present). Inline SVG/CSS, no chart lib.
- `src/components/results-viz.ts` / `.test.ts` — pure geometry helpers (seriesGeometry incl. forcedMax, percentileBars, regimeRuns, ageWeightSeries); 20 tests. Presentation math only.
- `src/components/format.ts`, `form-controls.tsx`, `charts.tsx`, `result-shell.tsx` — shared presentational primitives (formatters, form controls, generic LineChart, error/running/empty framing). No logic of substance.
- `src/App.tsx` (tool tab bar + ScenarioIO), `src/main.tsx`, `src/index.css`, `index.html` — shell.
- `scripts/smoke-nexus.mjs` — opt-in live round-trip against nexusmcp.site (PII-free default scenario); not in the gate suite, never in CI.
- `docs/nexus-core-requirements.md` — the original consumer-side spec handed to nexus-core (the first 6 tools, enums, CORS/determinism). Historical: the engine has since grown to 12 tools; `src/contract/planning.ts` is the source of truth.
- Configs: `package.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `.env.example`.
- CI: `.github/workflows/ci.yml` (7 jobs).
- `LICENSE` (Apache-2.0), `NOTICE` (patent #64/082,241), `README.md`, `CONTRIBUTING.md`.
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
- `NOTICE` patent application number is USPTO #64/082,241 (PW-PROV-003, filed
  2026-06-04; conversion deadline 2027-06-04).
- **All 16 wire-contract tools are surfaced in the UI** — 15 tabs +
  `capital_market_assumptions` (the Monte Carlo "Load real market assumptions"
  control); no gateway-only tools. Plus a **16th tab — Roth · IRMAA** — for the
  composite case contract (v1.0.0), which is not one of the 16 wire tools.
- The FIRE / Risk-metrics / Rebalance tabs (#117), the Portfolio X-ray tab (#116),
  and the **Roth · IRMAA tab** are merged-but-not-yet-deployed. The Roth · IRMAA
  tab additionally needs the nexus-core composite tool (`analyze_roth_conversion`)
  deployed to `nexusmcp.site` — until then it works only against a local
  `nexus-core serve`.

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
  Contract + gateway + UI tabs. Engine side in nexus-core PR #100 (merged +
  deployed); both tools smoke-verified live.
- **RMD, Bracket-headroom/Roth-fill, Social Security, Regime-SWR tabs — DONE
  (2026-06-02).** Contract + gateway + UI tabs. Engine side in nexus-core PR #101
  (merged + deployed, rev nexus-core-00041); smoke-verified live.
- **Correlation matrix + Regime return generator tabs — DONE (2026-06-02).** The
  last two contract-only tools now have UI (shared `MatrixTable`); the Regime-paths
  tab closes the `pathCacheKey` reuse loop. Both smoke-verified live.
- **Regime-aware Portfolio X-ray tab — DONE (2026-06-02).** Analyzes the shared MC
  portfolio → live regime + severity-coded findings + metrics. 13th tool, 12 UI
  tabs. Engine side nexus-core #116; smoke-verify on the next deploy.
- **FIRE, Risk-metrics, Rebalance tabs — DONE (2026-06-02).** FIRE/Coast-FIRE
  numbers; return-series risk stats (Sharpe/Sortino/drawdown/VaR); rebalance-to-
  target drift + trades over the shared portfolio. 16 contract tools, 15 UI tabs.
  Engine side nexus-core #117; smoke-verify on the next deploy.
- **Theming** to the `-core` family visual language — _next up; needs a design
  reference (held for input)._
- **NOTICE patent number** — filed 2026-06-04 as USPTO #64/082,241 (PW-PROV-003
  provisional); 12-month conversion deadline 2027-06-04.
