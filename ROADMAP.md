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
- [ ] Fill the `NOTICE` patent application number (supplied by maintainer).

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
- [ ] Theming to match the `-core` family visual language.
- [ ] Contract additive changes: `pathCacheKey?` on `MonteCarloRequest` + a
      capital-market-assumptions tool, folded into v0.1.0 (no bump; engine is
      pre-first-release). Coordinate with the nexus-core server build.

## Dependency on other repos (track, do not build here)

- **nexus-core:** implement the server side of contract v0.1.0 (the 5 planning
  MCP tools) at nexusmcp.site so the open demo has a live engine.
- **pwos-core:** PII-guard + audit-log packages — consumed by the private fork,
  not by this OSS repo.

## Deferred — private side (not this repo)

- pw-api backend path and pwos.app/plan + /chat integration. Decide separate
  private pw-plan repo vs. pw-api module later.
