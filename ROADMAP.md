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
- [ ] Wire `@protocolwealthos/pii-guard` + `@protocolwealthos/audit-log` once
      published; replace the commented stubs in `compliance.ts`; flip the default
      away from no-op.
- [ ] Integration test against a local `nexus-mcp` gateway; cover the
      ContractMismatchError and PiiTripwireError paths.
- [ ] Glide-path and tax-withdrawal views; wire the existing gateway methods to UI.
- [ ] Fill the `NOTICE` patent application number (supplied by maintainer).

## Next

- [ ] De-identified scenario persistence: save / load plan inputs as JSON (no PII
      by contract).
- [ ] Accessibility pass (keyboard, labels, contrast).
- [ ] Theming to match the `-core` family visual language.

## Dependency on other repos (track, do not build here)

- **nexus-core:** implement the server side of contract v0.1.0 (the 5 planning
  MCP tools). pwplan-core is inert until this exists.
- **pwos-core:** publish the pii-guard + audit-log packages.

## Deferred — private side (not this repo)

- pw-api backend path and pwos.app/plan + /chat integration. Decide separate
  private pw-plan repo vs. pw-api module later.
