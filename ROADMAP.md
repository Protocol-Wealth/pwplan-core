# ROADMAP.md

_Ordered; pull the next unchecked item. Re-order as priorities shift; check off
on completion and note the version in CHANGELOG.md._

## Now — open-source pwplan-core

- [x] Expand ScenarioForm: accounts (taxable / traditional / roth), asset classes
      with λ, allocations, guaranteed income (Social Security / pension + COLA).
      Validate allocations sum to 1 per account. _(done 2026-05-29: editors +
      `scenario-validation.ts`; Run gated on validity; 15 tests.)_
- [x] Results visualization: median balance by year (line), terminal value
      distribution (percentile bars), regime path summary when present. Keep the
      bundle lean. _(done 2026-05-29: hand-rolled SVG/CSS charts in ResultsPanel +
      pure `results-viz.ts` helpers; no chart lib; 15 tests.)_
- [x] Glide-path and tax-withdrawal views; wire the existing gateway methods to UI.
      _(done 2026-05-29: tab bar + GlidePathTool/TaxWithdrawalTool; shared portfolio;
      pure `tool-validation.ts`; equity-weight line chart + withdrawals table; 15 new tests.)_
- [x] Integration test against `nexusmcp.site` (or a local `nexus-mcp` gateway);
      cover the ContractMismatchError and PiiTripwireError paths. _(done 2026-05-30:
      offline `planning-gateway.test.ts` mocks fetch and covers both error paths
      plus tool-id/path/header wiring and the pw-api seam, 9 tests; opt-in live
      round-trip in `scripts/smoke-nexus.mjs`, never in CI.)_
- [x] Fill the `NOTICE` patent application number. _(done 2026-06-04: USPTO
      #64/082,241 / PW-PROV-003 filed 2026-06-04 for pwplan-core/pw-planner;
      12-month conversion deadline 2027-06-04.)_

### Out of scope here (private fork only)

- Production compliance — real PII de-identification + books-and-records audit
  log via pwos-core, and the pw-api edge — lives in a **private fork** of this
  repo, not in OSS. This repo keeps only the structural PII tripwire + the
  `auditCall` / `pw-api` seams so the fork stays a low-diff sync. See pwos-core
  for integration guidelines.

## Next

- [x] De-identified scenario persistence: save / load plan inputs as JSON (no PII
      by contract). _(done 2026-05-30: `scenario-io.ts` versioned, fail-closed
      envelope + `ScenarioIO` save/load UI via Blob download + file input, no
      browser storage; refreshed 2026-07-01 to schema v2 so every current tool
      input round-trips and every result slot clears on load; refreshed
      2026-07-05 to schema v3 for the synthetic Cash Flow Bridge inputs; 14
      tests at the v2 milestone.)_
- [x] Built-in case-study presets (accumulator / near-retiree / crisis-stress)
      loadable from the UI. _(done 2026-05-30: `scenario-presets.ts`; 15 tests
      assert each preset passes the real validators and round-trips.)_
- [x] Accessibility pass (keyboard, labels, contrast). _(done 2026-05-30:
      keyboard focus-visible rings restored where the outline was removed, valid
      `aria-current`, deduped `<head>`; labels/role=img already in place; contrast
      tuning — all `stone-400` body/micro-text raised to `stone-500` (≈4.6:1, WCAG AA
      on white) across 9 components.)_
- [x] Contract additive changes: `pathCacheKey?` on `MonteCarloRequest` + a
      capital-market-assumptions tool, folded into v0.1.0 (no bump; engine is
      pre-first-release). _(done 2026-06-01: 6th tool + `pathCacheKey?` in
      contract/gateway/tests at parity with the now-live 6-tool engine; verified
      via `scripts/smoke-nexus.mjs` + a `/mcp/tools` probe; +2 tests.)_
- [x] "Real data, fake clients" UI: a Monte Carlo control that calls
      `capital_market_assumptions` and drops the real `assetClasses` +
      `correlations` onto a de-identified portfolio. _(done 2026-06-01:
      `ScenarioForm` "Load real market assumptions" + provenance + correlation
      matrix; ephemeral store `assumptions` slice; verified end-to-end live.)_
- [x] Roth conversion + Sequence-of-returns-stress tools, wired end to end
      (contract → gateway → UI tabs). _(done 2026-06-01: new `RothConversionTool` + `SequenceStressTool` tabs + validators; engine side nexus-core PR #100,
      merged + deployed; smoke-verified live.)_
- [x] RMD, Tax-bracket-headroom/Roth-fill, Social Security claiming, and
      Regime-conditioned SWR tabs, wired end to end. _(done 2026-06-02: 12 tools
      total, 9 UI tabs; new `RmdTool` / `BracketHeadroomTool` /
      `SocialSecurityTool` / `RegimeSwrTool` + validators; +16 tests. Engine side
      nexus-core PR #101, merged + deployed (rev nexus-core-00041); all six newest
      tools smoke-verified live.)_
- [x] Standalone `correlation_matrix` / `regime_return_generator` UI tabs.
      _(done 2026-06-02: `CorrelationTool` + `RegimeReturnTool` tabs + shared
      `MatrixTable` (extracted from ScenarioForm); the Regime-paths tab surfaces
      the `pathCacheKey` for replay in a Monte Carlo run; +11 tests; both
      smoke-verified live. All 12 contract tools are now surfaced.)_
- [x] Regime-aware Portfolio X-ray tab. _(done 2026-06-02: `PortfolioXrayTool`
      analyzes the shared Monte Carlo portfolio → live regime + severity-coded
      findings (concentration, tax-location, growth posture, regime sensitivity) +
      metrics; engine side nexus-core #116. 13th tool, 12 UI tabs; +6 tests.)_
- [x] FIRE/Coast, risk-metrics, and rebalance-to-target tabs. _(done 2026-06-02:
      `FireTool` / `RiskMetricsTool` / `RebalanceTool`; engine side nexus-core
      #117. Historical milestone that brought the wire contract to 16 tools
      before later additions; +16 tests at the time.)_
- [x] Roth · IRMAA composite-planner tab. _(done 2026-06-03: `RothIrmaaPlannerTool` + the case contract `src/contract/roth-conversion.ts`
      (now `PLANNING_CASE_CONTRACT_VERSION = 1.1.0`, mirror of
      `@protocolwealthos/planning-contract`) + `analyzeRothConversion` + `validateRothIrmaa`;
      per-year per-ceiling sizing (fill-to-22 / fill-to-24 / just-under-IRMAA), cliff
      cost, fed+state tax, NIIT/LTCG deltas, breakeven, do-nothing RMD drag, with the
      projected-IRMAA-with-buffer assumption shown as a fiduciary disclosure. 16th UI
      tab; +12 tests. Engine side nexus-core `analyze_roth_conversion`; the tab works
      once that deploys.)_
- [ ] [#16](https://github.com/Protocol-Wealth/pwplan-core/issues/16) Theming
      to match the `-core` family visual language (needs a design reference —
      held for input).
- [ ] Optional further calculators inspired by OSS finance apps (dividend income,
      withdrawal-tax-aware Roth ladder) — tracked in
      [#17](https://github.com/Protocol-Wealth/pwplan-core/issues/17). Net-worth
      / holdings tracking stays OUT of scope (PII/production).
- [x] [#15](https://github.com/Protocol-Wealth/pwplan-core/issues/15) Add the
      public-safe Cash Flow OS / Planning Bridge contract + gateway extraction.
      _(done 2026-07-05: `cashflow_planning_bridge`, `cash_reserve_analysis`,
      and `budget_pacing_projection` request/result types, `PLANNING_TOOLS` ids,
      gateway methods, exact dispatch tests, and PII/raw-field contract tests.
      No UI, no Monarch CSV upload, no raw transaction storage, no
      merchant/payee/account/household fields, no notes, approvals, release
      state, or audit trails.)_
- [x] [#15](https://github.com/Protocol-Wealth/pwplan-core/issues/15) Build the
      synthetic Cash Flow OS / Planning Bridge UI. _(done 2026-07-05:
      `CashflowBridgeTool` tab over demo monthly-close aggregates, plus schema-v3
      scenario round-trip and validators. No CSV upload, raw transaction storage,
      merchant/payee/account/household fields, approvals, release state, audit
      trail, or private workflow state. Live `nexusmcp.site` had not caught up to
      the three cash-flow bridge tools during this pass, so tests stay mocked.)_
- [x] Reconcile the public-safe planning contract to current nexus-core source.
      _(done 2026-07-07: 27 wire-contract tool ids and typed gateway methods,
      adding `solve_goal`, `analyze_goals`, `project_cash_flow`,
      `irmaa_headroom`, `analyze_roth_conversion`, and `sequence_conversions`;
      no new UI tabs, persistence, raw ingestion, advisor workflow state,
      approvals, release state, audit trail, or identity fields.)_
- [x] S1 education funding consumer slice.
      _(done 2026-07-07: `education_funding` and `education_vehicle_rules`
      contract/gateway methods, schema-v4 scenario round-trip, built-in preset
      coverage, validators, and an Education tab with opaque student refs,
      savings-need results, cost-schedule SVG bars, and vehicle-rule table.
      29 wire-contract tools, 20 UI tabs at that milestone; no student identity fields, raw
      ingestion, advisor workflow state, approvals, release state, persistence,
      or audit trail.)_
- [x] S10 scenario compare UI slice.
      _(done 2026-07-07: UI-only Compare tab over existing Monte Carlo replay.
      The store holds 2-3 in-memory scenario snapshots and one deterministic
      seed; the tab blocks mixed live-CMA/default-CMA sources, runs each
      scenario through the same `monte_carlo_decumulation` request shape, and
      renders a success/P50/worst-path diff table plus median-balance SVG
      overlay. No contract change, new quant logic, persistence, identity
      fields, raw ingestion, advisor workflow state, approvals, release state,
      or audit trail. 29 wire-contract tools, 21 UI tabs.)_
- [x] Reconcile pwplan-core contract/gateway to the current 33-tool Nexus
      planning surface.
      _(done 2026-07-07: added `income_layering`, `historical_blend`,
      `risk_profile_score`, and `performance_analysis`; added S8
      project-cash-flow bucket fields, state/residency tax-withdrawal fields,
      and Wealth Roadmap preset/scope/metadata fields on
      `build_planning_report`. Contract/gateway-only; no UI tabs, persistence,
      raw ingestion, identity fields, advisor workflow state, approvals,
      request-side release state, or audit trail. 33 wire-contract tools, 21 UI
      tabs.)_
- [x] Add PW Wealth Roadmap controls to the Report tab.
      _(done 2026-07-07: the existing `BuildPlanningReportTool` can dispatch
      custom sections or `preset: "wealth_roadmap"` with focused/full scope and
      replay metadata, and renders scope/benefit text, release-block state,
      metadata stamps, and disclaimers returned by the engine. Scenario JSON
      remains schema-v4 and defaults older report snapshots. No new quant logic,
      persistence, raw ingestion, identity fields, advisor workflow state,
      approvals, audit trail, or private release workflow.)_
- [x] S5 risk profile UI slice.
      _(done 2026-07-07: added `RiskProfileTool` over `risk_profile_score`,
      fixed-question/answer-id validation, schema-v4 scenario defaults,
      suggested-weight and band rendering, and a local handoff that loads the
      scored profile into Optimize Allocation while clearing stale explicit
      optimizer objectives. No advisor override, notes, suitability workflow
      state, persistence, identity fields, approvals, audit trail, or private
      compliance workflow. 33 wire-contract tools, 22 UI tabs.)_
- [x] S2 income layering UI slice.
      _(done 2026-07-07: added `IncomeLayeringTool` over `income_layering`,
      using shared Monte Carlo account buckets plus de-identified earned-income,
      Social Security, pension/annuity, tax-year, state, and optional survivor
      assumptions. Results render rollups, a stacked after-tax income timeline,
      source totals, assumptions, and disclaimer. Scenario JSON remains
      schema-v4 and defaults older snapshots. No client identity, account names,
      raw holdings, notes, advisor workflow state, approvals, release state,
      persistence, audit trail, or private compliance workflow. 33 wire-contract
      tools, 23 UI tabs.)_
- [x] S3 historical blend UI slice.
      _(done 2026-07-07: added `HistoricalBlendTool` over `historical_blend`,
      using asset-class ids, weights, lookback, optional as-of date, rebalance
      frequency, and initial value only. Results render growth of initial value,
      recent calendar-year bars, trailing-return table, annualized stats,
      assumptions, and disclaimer. Scenario JSON remains schema-v4 and defaults
      older snapshots. No client identity, account names, holdings, provider
      ingestion, notes, advisor workflow state, approvals, release state,
      persistence, audit trail, or private compliance workflow. 33 wire-contract
      tools, 24 UI tabs.)_
- [x] S4 performance-analysis UI slice.
      _(done 2026-07-07: added `PerformanceAnalysisTool` over
      `performance_analysis`, using only numeric TWR periods, MWR cash-flow
      rows, terminal value/time, fee-drag return series, benchmark return
      series, and periods-per-year. Results render TWR, MWR, fee drag,
      benchmark-relative figures, assumptions, and disclaimer. Scenario JSON
      remains schema-v4 and defaults older snapshots. No symbols, client
      identity, account names, holdings, raw transactions, notes, advisor
      workflow state, approvals, release state, persistence, audit trail, or
      private compliance workflow. 33 wire-contract tools, 25 UI tabs.)_
- [x] S11 inherited IRA + S12 LTC contract reconciliation.
      _(done 2026-07-07: added `inherited_ira_analysis` contract/gateway
      coverage and an `InheritedIraTool` tab using only numeric/de-identified
      inherited balance, income, filing-status, tax-year, age, beneficiary-type,
      and rate assumptions. Also added additive `ltcShock` contract fields for
      `monte_carlo_decumulation` and `project_cash_flow`, matching nexus-core
      S12 v1 where LTC stress is modeled separately from dynamic guardrails.
      Scenario JSON remains schema-v4 and defaults older snapshots. No names,
      account numbers, raw holdings, diagnosis/provider/policy/claim data,
      notes, advisor workflow state, approvals, release state, persistence,
      audit trail, or private compliance workflow. 34 wire-contract tools, 26 UI
      tabs.)_

## Dependency on other repos (track, do not build here)

- **nexus-core:** server side of contract v0.1.0. New tools land there first
  (engine + tool), then get a matching pwplan-core contract type + gateway method
  (+ optional UI tab). `src/contract/planning.ts` is this repo's current client
  inventory; smoke-check `nexusmcp.site` when a task needs live runtime certainty.
- **pwos-core:** PII-guard + audit-log packages — consumed by the private fork,
  not by this OSS repo.

## Deferred — private side (not this repo)

- pw-api backend path and pwos.app/plan + /chat integration. Decide separate
  private pw-plan repo vs. pw-api module later.
- Real Cash Flow OS production work: Monarch CSV upload/preview, raw import row
  preservation, transaction normalization/classification, household/advisor rules,
  monthly close records, action items, document requests, advisor approval,
  client release, and books-and-records audit trail.
