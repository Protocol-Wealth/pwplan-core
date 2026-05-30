# Changelog

All notable changes to pwplan-core are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); this project adheres to
Semantic Versioning. The planning wire contract is versioned separately as
`PLANNING_CONTRACT_VERSION`.

## [Unreleased]

### Added

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
