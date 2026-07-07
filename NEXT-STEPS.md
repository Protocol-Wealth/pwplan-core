# NEXT-STEPS.md — pwplan-core

A hand-off for new contributors (interns). Read with [`CLAUDE.md`](CLAUDE.md)
(operating rules + invariants), [`README.md`](README.md) (the two-deployment
model), [`CURRENT-STATE.md`](CURRENT-STATE.md) (as-built inventory), and
[`ROADMAP.md`](ROADMAP.md). This file is the **prioritized to-do list**; keep it
current.

_Last updated: 2026-07-07. 33 wire-contract tools, 21 UI tabs (17 one-tool wire
tabs + Education + Cash Flow Bridge + Roth · IRMAA + Scenario Compare), the
Report tab can dispatch the PW Wealth Roadmap preset with replay metadata,
scenario files remain schema v4, and live Nexus was not re-smoked during the
latest UI pass._

## Orient yourself in 5 minutes

- **What this is:** the open-source, regime-adaptive financial planning **thin
  UI** — React 19 / Vite 8 / Tailwind v4 / TypeScript / Zustand. It ships **zero
  quantitative logic of its own**; all the math lives in the `nexus-core` engine.
  It is demo / case-study tooling pointed at the public engine with de-identified
  or fake client data.
- **The contract:** `src/contract/planning.ts` is the single source of truth for
  the wire interface to nexus-core (`PLANNING_CONTRACT_VERSION`). It is **PII-free
  by construction** — no name/DOB/SSN/email/phone/address field may ever appear;
  `planning.test.ts` fails the build if one does. Use age, and only year-of-birth
  when a tax policy requires it; never use date of birth.
- **Module boundaries:** `contract/` (wire types, no logic) · `lib/` (gateway +
  PII tripwire) · `store/` (Zustand) · `components/` (UI + pure validation /
  presentation helpers). Keep them clean.
- **Scope boundary — important for interns:** the **crypto-options overwriting
  suite** (covered calls, skew, term structure, regime tilt) is **NOT here** — it
  lives in `nexus-core` (engine + API/MCP) and is surfaced in the **pw-demo**
  browser app (pwdemo.com). pwplan-core is the _retirement-planning_ UI only. Don't
  add crypto-options or production-compliance code here.
- **Cash Flow OS boundary:** this repo may show a synthetic, public-safe Cash Flow
  OS / Planning Bridge reference, but it must not ingest Monarch files or store
  raw transactions, merchant/payee strings, account nicknames, household records,
  advisor/client notes, approvals, release state, or audit trails. Those belong in
  private PWOS / pw-api / PWPortal.

## Before you commit (keep all five green — mirrors CI)

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Run `npm run format` before committing. Conventional commits. **This repo commits
directly to `main`** (no feature branches) — the exception is any change to the
public privacy / compliance posture, which goes via a review PR + CCO sign-off
(HITL Tier 2; see CLAUDE.md § Compliance).

## Prioritized next tasks (from ROADMAP)

1. **UI tabs for newly gateway-ready Nexus tools.** The TypeScript contract now
   covers 33 Nexus planning tools, but `income_layering`, `historical_blend`,
   `risk_profile_score`, and `performance_analysis` are gateway-only. Add
   focused UI tabs in slice order. The Report tab already dispatches
   `preset: "wealth_roadmap"` with focused/full scope and replay metadata.
2. **Live follow-up** — the synthetic Cash Flow Bridge and Education tabs are
   built against source-truth contracts. Re-check
   `https://nexusmcp.site/mcp/tools` before any live smoke because deployed
   Nexus can lag source. Keep tests mocked/offline. Tracked in
   [#15](https://github.com/Protocol-Wealth/pwplan-core/issues/15).
3. **Theming** to the `-core` family visual language — held for a design reference;
   ask the maintainer for it before starting. Tracked in
   [#16](https://github.com/Protocol-Wealth/pwplan-core/issues/16).
4. **Optional further calculators** inspired by OSS finance apps (dividend income,
   a withdrawal-tax-aware Roth ladder). Net-worth / holdings tracking stays **out
   of scope** (it would require PII / production data). Each new tool follows the
   established pattern: contract type → gateway method → store slice → pure
   validator → UI tab → tests → docs; engine side ships in nexus-core first.
   Tracked in [#17](https://github.com/Protocol-Wealth/pwplan-core/issues/17).
5. **`NOTICE` patent application number** — DONE: filed 2026-06-04 as USPTO
   #64/082,241 (PW-PROV-003 provisional; conversion deadline 2027-06-04).

## Non-negotiable invariants (do not violate — see CLAUDE.md)

Thin shell (no quant/compliance logic here) · PII-free contract · backend-agnostic
gateway (`nexus-mcp` / `pw-api` via `VITE_PLANNING_BACKEND`) · the always-on
`assertNoPII` tripwire · the contract version is a wire contract (bump per semver).

## Reference

- Engine + API/MCP this UI calls: the `nexus-core` repo (live at `nexusmcp.site`).
- Cross-repo contract rules: [`CONTRIBUTING.md`](CONTRIBUTING.md).
