# CURRENT-STATE.md

_Last updated: 2026-07-07 (Inherited IRA tab on the 34-tool contract). Maintain it._

## Status

Last local gate for the Inherited IRA / LTC contract reconciliation slice was
green: typecheck clean, lint clean, 314 tests pass, build succeeds, and `git diff
--check` is clean.
**This repo is now
positioned as demo / case-study tooling**: it runs
against the public nexus-core MCP engine (`https://nexusmcp.site` by default, no
`.env` needed) with de-identified / fake client data. The production compliance
stack (pwos-core PII de-identification + audit log) and any pw-api integration
have been **removed from this OSS repo** and live only in a private fork; the
`pw-api` gateway seam is kept so that fork stays a low-diff sync. The wire
contract has **34** tools; the UI exposes **26 tabs** (22 one-tool wire tabs, the
Education tab, the synthetic Cash Flow Bridge tab, the Roth · IRMAA
case-contract tab, and the Scenario Compare tab), with
`capital_market_assumptions` surfaced as the Monte Carlo "Load real market
assumptions" control. The Report tab can dispatch either custom de-identified
sections or the `build_planning_report` `preset: "wealth_roadmap"` envelope with
focused/full scope and replay metadata. Each UI tab is wired to its gateway method with
client-side request-shape validation and hand-rolled SVG/CSS results (no chart
library). Accounts/asset classes are a shared portfolio. Plan inputs save/load
as PII-free schema-v4 JSON and built-in case-study presets use
the same full snapshot shape. Every first-party source file carries an SPDX
Apache-2.0 header. The demo-reframe work shipped via PR #1 (CCO + CTO/CISO
approved) and is merged to `main`; `main` is the live line again.

The hybrid product boundary is explicit as of 2026-07-05: this OSS repo may show
synthetic Cash Flow OS concepts, a Planning Bridge from derived monthly-close
values into planning assumptions, and education funding over opaque student refs,
but must not become a real Monarch import,
raw-transaction store, household record system, advisor/client workflow, approval
queue, release workflow, or compliance/audit trail.

## Architecture as built

Thin UI → `planning-gateway` → `nexus-mcp` (open; the only backend this repo
uses) | `pw-api` (private-fork seam). Wire contract v0.1.0, PII-free and enforced
by test. `assertNoPII` is a small, always-on, dependency-free structural tripwire
(`src/lib/compliance.ts`); `auditCall` is a no-op seam (writes nothing). See
README.md "Compliance scope". The contract + gateway cover all **34** current
nexus-core planning wire tools: monteCarlo / solveGoal / analyzeGoals /
projectCashFlow / glidePath / taxWithdrawal / historicalBlend / rothConversion /
sequenceOfReturnsStress / rmd / taxBracketHeadroom / socialSecurityClaiming /
regimeConditionedSwr / correlationMatrix / regimeReturnGenerator /
portfolioXray / fire / riskMetrics / riskProfileScore / performanceAnalysis /
inheritedIraAnalysis / rebalance / optimizeAllocation / incomeLayering /
irmaaHeadroom / analyzeRothConversion / sequenceConversions /
buildPlanningReport / educationFunding / educationVehicleRules /
cashflowPlanningBridge / cashReserveAnalysis / budgetPacingProjection, plus the
`capitalMarketAssumptions` control inside the Monte Carlo tab. The Roth · IRMAA composite planner also uses the case contract
v1.1.0 for its `contract` payload.

Cash-flow operating-system concepts now have a public-safe synthetic UI tab over
Nexus bridge calculations: `cashflow_planning_bridge`, `cash_reserve_analysis`,
and `budget_pacing_projection` accept derived monthly-close numbers and return
planning assumptions / reserve status / pacing signals. Raw CSV fields, raw
transaction arrays, merchant/payee text, account names, household/person
identifiers, notes, approvals, release state, and audit records remain
private-only. Live Nexus was deployed after the nexus-core S11/S12 merge and
smoked via `/health`, `/health/db`, unauthenticated restricted REST 401, and
public `llms.txt` listing 34 planning tools; an authenticated planning-tool
handshake was not run from this repo. UI tests remain mocked/offline and source
truth is the local nexus-core 34-tool contract.

## File inventory

_(Every first-party source file below carries an SPDX Apache-2.0 header.)_

- `src/contract/planning.ts` — wire contract v0.1.0; **34 tools**; PII-free invariant.
  `MonteCarloRequest` carries an optional `retirementAge?` + `pathCacheKey?`.
  `CapitalMarketAssumptionsRequest`/`Result` source real returns/vols/λ/correlations
  that drop straight into a `MonteCarloRequest`. Plus `RothConversionRequest`/`Result`,
  `CashflowPlanningBridgeRequest`/`Result`, `CashReserveAnalysisRequest`/`Result`,
  `BudgetPacingProjectionRequest`/`Result`,
  `EducationFundingRequest`/`Result`, `EducationVehicleRulesRequest`/`Result`,
  `IncomeLayeringRequest`/`Result`, `HistoricalBlendRequest`/`Result`,
  `RiskProfileScoreRequest`/`Result`, `PerformanceAnalysisRequest`/`Result`,
  `InheritedIraAnalysisRequest`/`Result`,
  `SequenceOfReturnsStressRequest`/`Result` (+ `SequenceOutcome`), `RmdRequest`/`Result`,
  `TaxBracketHeadroomRequest`/`Result`, `SocialSecurityClaimingRequest`/`Result`
  (+ `SocialSecurityClaimRow`/`Breakeven`), `RegimeConditionedSwrRequest`/`Result`,
  `PortfolioXrayRequest`/`Result` (+ `XrayFinding`/`XraySeverity`), `FireRequest`/`Result`,
  `RiskMetricsRequest`/`Result`, `RebalanceRequest`/`Result` (+ `RebalanceRow`),
  `OptimizeAllocationRequest`/`Result` (+ `RiskProfile`/`AllocationObjective`/`AllocationAssetClass`),
  `BuildPlanningReportRequest`/`Result` (+ `PlanningReportSectionInput`/`PlanningReportSection`/`PlanningReport` and additive `preset: "wealth_roadmap"` / `scope` / `metadata` fields),
  plus contract-parity types for `SolveGoal`, `AnalyzeGoals`, `ProjectCashFlow`,
  and `IrmaaHeadroom`. `MonteCarloRequest` and `ProjectCashFlowRequest` include optional
  public-safe `ltcShock` healthcare-cost stress fields; `ProjectCashFlowRequest`
  also includes optional taxable/traditional/Roth bucket fields; `TaxWithdrawalRequest`
  includes optional state / residency-change fields and year-only `birthYear`
  for the Nexus RMD start-age policy; date of birth remains forbidden.
- `src/contract/planning.test.ts` — contract + PII-free/raw-ingestion-field enforcement.
- `src/contract/roth-conversion.ts` — the **case contract** `PLANNING_CASE_CONTRACT_VERSION = 1.1.0` (a mirror of `@protocolwealthos/planning-contract` / the nexus-core JSON-Schema): `PlanningContract` + `RothConversionAnalysis` (+ nested) for the composite Roth/IRMAA analysis. Distinct from the v0.1.0 wire contract; PII-free. `roth-conversion.test.ts` enforces semver + the PII-free invariant.
- `src/lib/planning-gateway.ts` — backend-agnostic transport; ContractMismatchError; subjectRef header; ACTIVE_BACKEND export; fail-fast backend env parsing; one `planning.*` method per wire tool (34) plus the compatibility `analyzeRothConversion(req)` helper, now routed through the shared registry. `education_funding` additionally rejects non-opaque student `subjectRef` values before dispatch.
- `src/lib/planning-gateway.test.ts` — offline integration test (fetch mocked): PiiTripwireError + ContractMismatchError paths, tool-id/path/header wiring for all 34 tools, cash-flow bridge dispatch checks, education dispatch + `notes`→`referenceNotes` normalization, CMA drop-in round-trip, `pathCacheKey` passthrough, LTC shock passthrough on Monte Carlo/project-cash-flow requests, per-tool dispatch shape checks (incl. solve_goal, analyze_goals, project_cash_flow bucket fields, education_funding, education_vehicle_rules, income_layering, historical_blend, risk_profile_score, performance_analysis, inherited_ira_analysis, irmaa_headroom, analyze_roth_conversion, sequence_conversions, optimize_allocation, and build_planning_report / wealth_roadmap metadata), pw-api seam, and invalid-backend fail-fast behavior.
- `src/lib/compliance.ts` / `.test.ts` — always-on dep-free structural PII tripwire (`assertNoPII` + `findIdentityKey`) and a no-op `auditCall` seam; 9 tests. NOT the production compliance stack (that's private-fork + pwos-core).
- `src/lib/historical-blend-defaults.ts` — public-safe default `historical_blend` form state shared by the store, parser, presets, and UI.
- `src/lib/income-layering-defaults.ts` — public-safe default `income_layering` form state shared by the store, parser, presets, and UI.
- `src/lib/performance-analysis-defaults.ts` — public-safe default `performance_analysis` form state shared by the store, parser, presets, and UI.
- `src/lib/risk-profile-questionnaire.ts` — fixed public-safe `risk_profile_score` question/answer ids, labels, scores, and default answer set shared by the store, parser, validator, and UI. No free text or identity fields.
- `src/store/scenario.ts` — Zustand store: active `tool` (26 UI tabs) + per-tool inputs (scenario / glidePath / tax / roth / rothIrmaa / sor / rmd / bracket / socialSecurity / regimeSwr / correlation / regimeGen / fire / riskMetrics / incomeLayering / historicalBlend / performanceAnalysis / inheritedIra / riskProfileScore / rebalance / optimizeAllocation / buildReport / educationFunding / cashflowBridge / compare) + result slots (incl. `xrayResult` / `fireResult` / `riskMetricsResult` / `incomeLayeringResult` / `historicalBlendResult` / `performanceAnalysisResult` / `inheritedIraResult` / `riskProfileScoreResult` / `rebalanceResult` / `optimizeAllocationResult` / `buildReportResult` / education results / cash-flow bridge results / compare results); the Portfolio X-ray, Rebalance, and Income Layers tabs reuse the shared scenario portfolio. Accounts/asset classes are one shared portfolio. Seeded valid defaults. `BuildPlanningReportInputs` now includes `preset`, `scope`, `assumptionVersion`, `cmaVersion`, `taxYear`, `seed`, and `engineReference` for Wealth Roadmap replay stamping. `InheritedIraInputs` carries only inherited-balance, ordinary-income, filing-status, year-only tax inputs, ages, beneficiary type, and rate assumptions; no names, account numbers, raw holdings, notes, workflow state, approvals, release state, persistence, or audit trail. `PerformanceAnalysisInputs` carries only numeric TWR periods, MWR flows, terminal value/time, fee/return series, benchmark return series, periods-per-year, and flow timing; no symbols, account names, holdings, transaction rows, notes, or identity fields. `HistoricalBlendInputs` carries only asset-class ids, weights, lookback, optional as-of date, rebalance frequency, and display initial value; no account names, holdings, or identity fields. `IncomeLayeringInputs` carries only ages/year-only birth year, numeric assumptions, state code, Social Security amounts, and pension/annuity rows; no account names or identity fields. `RiskProfileScoreInputs` carries only fixed answer ids keyed by canonical question id. `ScenarioSnapshot` captures every current tool input, and `loadSnapshot` clears every result slot plus an ephemeral `assumptions` slice (`{ asOf, correlations }` + `loadingAssumptions`) holding live engine capital-market assumptions. The compare queue holds 2-3 in-memory scenario snapshots and a replay seed only; it is not persisted and adds no wire type.
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
- `src/components/IncomeLayeringTool.tsx` / `income-layering-request.ts` / `.test.ts` — income-layering form over `income_layering`, using shared Monte Carlo account balances plus de-identified earned-income, Social Security, pension/annuity, tax-year, state, and optional survivor assumptions. Results render rollups, a stacked after-tax income timeline, source totals, assumptions, and disclaimer. No client identity, account names, raw holdings, notes, advisor workflow state, approvals, release state, persistence, audit trail, or private compliance workflow.
- `src/components/HistoricalBlendTool.tsx` / `historical-blend-request.ts` / `.test.ts` — historical-blend form over `historical_blend`, using asset-class ids, weights, lookback, optional as-of date, rebalance frequency, and initial value only. Results render growth of initial value, recent calendar-year bars, trailing-return table, annualized stats, assumptions, and the engine disclaimer. No client identity, account names, holdings, provider ingestion, notes, advisor workflow state, approvals, release state, persistence, audit trail, or private compliance workflow.
- `src/components/PerformanceAnalysisTool.tsx` / `performance-analysis-request.ts` / `.test.ts` — performance-analysis form over `performance_analysis`, using only numeric TWR value/flow rows, MWR time/amount flows, terminal value/time, fee-drag return series, benchmark return series, periods-per-year, and flow timing. Results render TWR, MWR, fee drag, benchmark-relative figures, assumptions, and disclaimer. No symbols, account names, holdings, transaction rows, notes, advisor workflow state, approvals, release state, persistence, audit trail, or private compliance workflow.
- `src/components/InheritedIraTool.tsx` — inherited IRA form over `inherited_ira_analysis`, using inherited balance, beneficiary ordinary-income aggregates, filing status, tax year, years remaining, return/taxable-ratio/target-rate assumptions, beneficiary type, and ages only. Results render ranked 10-year distribution strategies, federal tax comparison, beneficiary classification, assumptions, and disclaimer. No names, account numbers, account nicknames, raw holdings, notes, advisor workflow state, approvals, release state, persistence, audit trail, or private compliance workflow.
- `src/components/RiskProfileTool.tsx` / `.test.ts` — fixed-answer risk-profile form over `risk_profile_score` + results (score, optimizer-compatible profile, volatility band, suggested weights, band table, assumptions, disclaimer) and a local "Load into Optimize Allocation" handoff that clears any stale explicit optimizer objective. Uses answer ids only; no free text, identity, advisor override, notes, approvals, audit trail, or suitability workflow state.
- `src/components/RebalanceTool.tsx` — rebalance form (an editable target weight per shared asset class; live target-sum readout) + results (one-way turnover, per-asset current/target/trade table). `validateRebalance`.
- `src/components/OptimizeAllocationTool.tsx` — optimize-allocation form (risk profile, objective override, optional id subset, weight bounds, return model, regime-aware toggle) + results (per-asset weight bar table, expected return/vol/Sharpe, objective + source, live regime + regimeNote). `validateOptimizeAllocation`.
- `src/components/BuildPlanningReportTool.tsx` — build-planning-report form (custom sections or PW Wealth Roadmap preset, focused/full scope, assumption/CMA/tax-year/seed metadata, add/remove de-identified sections with kind + optional title + findings textarea, regime-annotate toggle) + results (ordered sections with findings, scope/benefit text, release-block state, metadata stamps, disclaimer, and the engine's assumptions list). `validateBuildPlanningReport`.
- `src/components/EducationTool.tsx` — education-funding form (opaque student refs, annual cost presets, start year, funding years, current savings, monthly contribution, tuition inflation, after-tax return, vehicle focus) + results (household monthly/annual/lump-sum need, per-student cost schedule SVG bars, and normalized vehicle-rule comparison table). Uses `education_funding` + `education_vehicle_rules`; no student names, DOBs, emails, schools, account names, notes, or workflow state.
- `src/components/CashflowBridgeTool.tsx` — synthetic Cash Flow Bridge tab: three aggregate-only panels over `cashflow_planning_bridge`, `cash_reserve_analysis`, and `budget_pacing_projection`; no import, no transactions, no merchant/payee/account/household fields, no workflow state.
- `src/components/CompareTool.tsx` — S10 Scenario Compare tab: captures 2-3 current scenario snapshots into an in-memory queue, replays `monte_carlo_decumulation` for each with one deterministic seed, blocks mixed live-CMA/default-CMA source references, surfaces seed + best-effort `cmaVersion` metadata, and renders a success/P50/worst-path diff table plus median-balance SVG overlay. UI-only; no new contract fields, persistence, raw data, workflow state, approvals, release state, or audit trail.
- `src/components/scenario-compare.ts` / `.test.ts` — pure compare gating and display helpers (scenario count, deterministic seed, CMA-source consistency, future additive `cmaVersion` extraction, result seed/cmaVersion mismatch checks, and row deltas).
- `src/components/scenario-io.ts` / `.test.ts` — pure, versioned, PII-free schema-v4 serialize/parse for all current tool inputs (fail-closed `assertNoPII` on save + on the raw input at load); no browser storage.
- `src/components/scenario-presets.ts` / `.test.ts` — three built-in case-study snapshots (accumulator / near-retiree / crisis-stress), each validator-clean and round-trip-safe.
- `src/components/ScenarioIO.tsx` — Save (Blob download) / Load (file input) / preset picker; uses the store's `loadSnapshot`.
- `src/components/scenario-validation.ts` / `.test.ts` — pure scenario request-shape validation (allocation-sums-to-1, unique ids, known-id refs, age ordering `currentAge ≤ retirementAge < horizonAge`); 20 tests. No quant logic.
- `src/components/tool-validation.ts` / `.test.ts` — pure request-shape validation for glide-path, tax, Roth, Roth/IRMAA, sequence-stress (`parseReturns`), RMD, bracket-headroom, Social Security, regime-SWR, correlation (`validateCorrelation` + `parseIdList`), regime-gen (`validateRegimeGen`), portfolio X-ray (`validatePortfolioXray`, reusing `isAllocationBalanced`), FIRE (`validateFire`), risk-metrics (`validateRiskMetrics`), income layering (`validateIncomeLayering`), historical blend (`validateHistoricalBlend`), performance analysis (`validatePerformanceAnalysis`), inherited IRA (`validateInheritedIra`), risk-profile fixed answers (`validateRiskProfileScore`), rebalance (`validateRebalance`), optimize-allocation (`validateOptimizeAllocation`: weight-bound min≤max in [0,1], distinct ≥2-id subset or full universe), build-planning-report (`validateBuildPlanningReport`: ≥1 section, each with a non-empty kind, and Wealth Roadmap replay metadata when that preset is selected), education funding (opaque subject refs, bounded student rows, non-negative money values), and the three cash-flow bridge validators (positive months, non-negative aggregates, valid month-day, no raw transaction-shaped keys). No quant logic.
- `src/components/ResultsPanel.tsx` — Monte Carlo results: success probability + 3 hand-rolled charts (median-balance line/area, terminal percentile bars, regime strip when present). Inline SVG/CSS, no chart lib.
- `src/components/results-viz.ts` / `.test.ts` — pure geometry helpers (seriesGeometry incl. forcedMax, percentileBars, regimeRuns, ageWeightSeries); 20 tests. Presentation math only.
- `src/components/format.ts`, `form-controls.tsx`, `charts.tsx`, `result-shell.tsx` — shared presentational primitives (formatters, form controls, generic LineChart, error/running/empty framing). No logic of substance.
- `src/App.tsx` (26-tab bar + ScenarioIO), `src/main.tsx`, `src/index.css`, `index.html` — shell.
- `scripts/smoke-nexus.mjs` — opt-in live round-trip against nexusmcp.site (PII-free default scenario); not in the gate suite, never in CI.
- `docs/nexus-core-requirements.md` — the original consumer-side spec handed to nexus-core (the first 6 tools, enums, CORS/determinism). Historical: nexus-core now exposes a larger planning surface, while this client intentionally exposes 34 wire tools plus the Roth · IRMAA case contract payload; `src/contract/planning.ts` is the source of truth for this OSS UI.
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
- **UI surface is intentionally narrower than the 34-tool contract** — 22
  one-tool tabs, the `capital_market_assumptions` Monte Carlo control, the
  Education tab for the two education tools, the synthetic Cash Flow Bridge tab for the three cash-flow tools, the **Roth ·
  IRMAA tab** over the composite case contract (v1.1.0), and the S10 Scenario Compare tab over Monte Carlo replay. `solve_goal`,
  `analyze_goals`, `project_cash_flow`, `irmaa_headroom`, and
  `sequence_conversions` are gateway-ready but do not yet have dedicated tabs.
- There is no public Cash Flow OS ingestion workflow. The UI is synthetic and
  derived-monthly-close only; real import/normalization/workflow remains private.
- Live MCP availability is intentionally not a CI gate; use
  `scripts/smoke-nexus.mjs` plus targeted `/mcp/tools/{tool}` checks when a task
  needs runtime certainty. The Roth · IRMAA tab additionally depends on the
  nexus-core composite tool (`analyze_roth_conversion`).

## Next planned work

Open GitHub issue tracking:

- [#15](https://github.com/Protocol-Wealth/pwplan-core/issues/15) — Nexus/PWOS
  planning-surface alignment, including any public-safe Cash Flow OS / Planning
  Bridge contract extraction decisions.
- [#16](https://github.com/Protocol-Wealth/pwplan-core/issues/16) — `-core`
  family visual theming.
- [#17](https://github.com/Protocol-Wealth/pwplan-core/issues/17) — optional
  public-safe planning calculators.

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
  target drift + trades over the shared portfolio. Historical milestone that
  brought the wire contract to 16 tools before later additions.
- **Theming** to the `-core` family visual language — _next up; needs a design
  reference (held for input)._
- **NOTICE patent number** — filed 2026-06-04 as USPTO #64/082,241 (PW-PROV-003
  provisional); 12-month conversion deadline 2027-06-04.
