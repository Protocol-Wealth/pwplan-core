# Changelog

All notable changes to pwplan-core are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); this project adheres to
Semantic Versioning. The planning wire contract is versioned separately as
`PLANNING_CONTRACT_VERSION`.

## [Unreleased]

### Changed

- **Repositioned as demo / case-study tooling.** This OSS repo now runs against
  the public nexus-core MCP engine (`https://nexusmcp.site` by default — a fresh
  clone needs no `.env`) with de-identified / fake client data, and no longer
  carries the production compliance stack.
  - `src/lib/compliance.ts` rewritten: `assertNoPII` is now a small, always-on,
    **dependency-free structural tripwire** (`findIdentityKey` walks the payload
    and throws on any identity-shaped key) instead of a stub gated behind
    `VITE_COMPLIANCE_NOOP`. `auditCall` is an explicit no-op seam (writes
    nothing). Added `compliance.test.ts` (9 tests).
  - Removed the `@protocolwealthos/pii-guard` + `@protocolwealthos/audit-log`
    peer deps, the `VITE_COMPLIANCE_NOOP` flag, and the `compliance-present` CI
    job (CI is now 7 jobs). The `pw-api` gateway seam and `auditCall` seam are
    kept so the private production fork stays a low-diff sync.
  - Default `VITE_PLANNING_GATEWAY_URL` is now `https://nexusmcp.site`.
  - Docs (README, CONTRIBUTING, CLAUDE.md, NOTICE) reframed: production PII
    de-identification, audit logging, and pw-api integration are **out of scope**
    here and live only in a private fork integrating pwos-core. Invariant #4
    reworded from "fail-closed compliance tripwire" to "structural, always-on,
    dep-free PII tripwire".

### Added

- Glide-path and tax-withdrawal tools, wiring the existing
  `planning.glidePath` / `planning.taxWithdrawal` gateway methods to the UI. A
  tab bar in `App.tsx` switches between Monte Carlo, Glide path, and Tax
  withdrawal; each tool keeps its own input + result slot in the store, and
  accounts are a single shared portfolio (the contract shares `Account[]`).
  - `GlidePathTool.tsx` — form (ages, start/end equity weight, shape) + an
    equity-weight-by-age line chart on a fixed 0–1 axis.
  - `TaxWithdrawalTool.tsx` — form (year, age, gross need, other income, filing
    status) over the shared portfolio + a withdrawals-by-account table with
    total tax, effective rate, and an RMD-satisfied indicator.
  - `tool-validation.ts` — pure request-shape validation (`validateGlidePath`,
    `validateTaxWithdrawal`); no quant logic. 10 unit tests.
  - `results-viz.ts` gains `ageWeightSeries` (sort age→weight map) and a
    `forcedMax` option on `seriesGeometry` (fixed-top Y domain). 5 unit tests.
- Shared, extracted presentational modules to keep the three tools DRY:
  `format.ts` (currency/pct), `form-controls.tsx` (Field/NumberInput/Select/
  Card/IssueList/RunButton/…), `charts.tsx` (`ChartHeading` + generic
  `LineChart`), `result-shell.tsx` (error/running/empty framing). `ScenarioForm`
  and `ResultsPanel` were refactored onto these with no behavior change.
- Results visualization in `ResultsPanel`: a median-balance-by-year line/area
  chart (age-labelled, peak annotated), a terminal-value percentile bar chart
  (worst-path footnote), and a regime-path strip with a legend when the engine
  returns `regimePathSummary`. All hand-rolled inline SVG/CSS — no chart library;
  the whole Unreleased block keeps the bundle lean (~225 kB / ~69 kB gzip, no new
  deps). Charts carry `role="img"` + `aria-label`/`title` for screen readers.
- `results-viz.ts` — pure, dependency-free geometry helpers (`seriesGeometry`,
  `percentileBars`, `regimeRuns`) that map an engine result to SVG/CSS
  coordinates. Presentation math only; no quant logic (thin-shell intact).
- `results-viz.test.ts` — 15 unit tests (SVG y-inversion, 0-based vs negative
  domain, single-point centering, flat-series safety, percentile ordering /
  normalization / zero + decimal-key + key-filtering, regime run-collapsing /
  single-regime / length).
- ScenarioForm now collects the full `MonteCarloRequest` shape: asset classes
  (id, label, expected return, volatility, λ), accounts (taxable / traditional /
  roth) with per-asset-class allocation weights, guaranteed income (Social
  Security / pension, amount, start age, COLA), and filing status.
- `scenario-validation.ts` — pure, UI-side request-shape validation
  (`validateScenario`, `isAllocationBalanced`, `allocationSum`,
  `duplicateAssetClassIds`). Enforces "allocation weights sum to 1 per account"
  (within a 1e-6 float tolerance), non-empty asset classes/accounts, unique
  non-blank asset-class ids, and no allocation to an unknown asset class. The Run
  button is disabled with inline reasons until the scenario is valid. This is
  form-shape validation only — no quant logic (thin-shell invariant intact).
- `scenario-validation.test.ts` — 15 unit tests, including float-tolerance
  band boundaries (just inside / just outside, both sides) and the zero-weight
  stale-key exemption.
- `store/scenario.ts` seeds `DEFAULT_INPUTS` with a valid, balanced two-account /
  two-asset-class scenario so the form is runnable out of the box.

### Fixed

- Asset-class id whitespace mismatch: `updateAssetClass` now stores and re-keys
  allocations with the trimmed id, matching how validation normalizes ids. A
  padded id (e.g. `" us_equity "`) no longer produces a spurious "unknown asset
  class" error that left the Run button stuck disabled. (Found via adversarial
  multi-agent review of this change.)

## [0.1.0] - 2026-05-30

### Added

- Initial open-source scaffold: thin planning UI (React 19, Vite 6, Tailwind v4,
  TypeScript, Zustand).
- Planning wire contract v0.1.0 with five engine tools; PII-free by construction,
  enforced by tests.
- Backend-agnostic planning gateway targeting `nexus-mcp` (open) or `pw-api`
  (private); `ContractMismatchError` on version drift; opaque `subjectRef`
  correlation header.
- Compliance as a fail-closed PII tripwire (`assertNoPII`) plus an audit-log
  hook; pwos-core packages declared as optional peer deps.
- CI with 8 jobs; Apache-2.0 LICENSE and NOTICE (defensive patent posture; OIN
  membership).
- Governance and memory files: CLAUDE.md, CURRENT-STATE.md, ROADMAP.md.
