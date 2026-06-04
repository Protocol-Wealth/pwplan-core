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
      browser storage; 13 tests.)_
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
      #117. 16 contract tools, 15 UI tabs; +16 tests.)_
- [x] Roth · IRMAA composite-planner tab. _(done 2026-06-03: `RothIrmaaPlannerTool` + the case contract `src/contract/roth-conversion.ts`
      (`PLANNING_CASE_CONTRACT_VERSION = 1.0.0`, mirror of
      `@protocolwealthos/planning-contract`) + `analyzeRothConversion` + `validateRothIrmaa`;
      per-year per-ceiling sizing (fill-to-22 / fill-to-24 / just-under-IRMAA), cliff
      cost, fed+state tax, NIIT/LTCG deltas, breakeven, do-nothing RMD drag, with the
      projected-IRMAA-with-buffer assumption shown as a fiduciary disclosure. 16th UI
      tab; +12 tests. Engine side nexus-core `analyze_roth_conversion`; the tab works
      once that deploys.)_
- [ ] Theming to match the `-core` family visual language (needs a design
      reference — held for input).
- [ ] Optional further calculators inspired by OSS finance apps (dividend income,
      withdrawal-tax-aware Roth ladder) — see the feature-ideas memo.
      Net-worth/holdings tracking stays OUT of scope (PII/production).

## Dependency on other repos (track, do not build here)

- **nexus-core:** server side of contract v0.1.0 — **done + live** at
  nexusmcp.site (12 planning MCP tools, rev nexus-core-00041). New tools land
  there first (engine + tool), then get a matching pwplan-core contract type +
  gateway method (+ optional UI tab).
- **pwos-core:** PII-guard + audit-log packages — consumed by the private fork,
  not by this OSS repo.

## Deferred — private side (not this repo)

- pw-api backend path and pwos.app/plan + /chat integration. Decide separate
  private pw-plan repo vs. pw-api module later.
