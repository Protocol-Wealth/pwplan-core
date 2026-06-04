# NEXT-STEPS.md — pwplan-core

A hand-off for new contributors (interns). Read with [`CLAUDE.md`](CLAUDE.md)
(operating rules + invariants), [`README.md`](README.md) (the two-deployment
model), [`CURRENT-STATE.md`](CURRENT-STATE.md) (as-built inventory), and
[`ROADMAP.md`](ROADMAP.md). This file is the **prioritized to-do list**; keep it
current.

_Last updated: 2026-06-02. 16 contract tools, 15 UI tabs, 173 tests green._

## Orient yourself in 5 minutes

- **What this is:** the open-source, regime-adaptive financial planning **thin
  UI** — React 19 / Vite 6 / Tailwind v4 / TypeScript / Zustand. It ships **zero
  quantitative logic of its own**; all the math lives in the `nexus-core` engine.
  It is demo / case-study tooling pointed at the public engine with de-identified
  or fake client data.
- **The contract:** `src/contract/planning.ts` is the single source of truth for
  the wire interface to nexus-core (`PLANNING_CONTRACT_VERSION`). It is **PII-free
  by construction** — no name/DOB/SSN/email/phone/address field may ever appear;
  `planning.test.ts` fails the build if one does. Use age, never date of birth.
- **Module boundaries:** `contract/` (wire types, no logic) · `lib/` (gateway +
  PII tripwire) · `store/` (Zustand) · `components/` (UI + pure validation /
  presentation helpers). Keep them clean.
- **Scope boundary — important for interns:** the **crypto-options overwriting
  suite** (covered calls, skew, term structure, regime tilt) is **NOT here** — it
  lives in `nexus-core` (engine + API/MCP) and is surfaced in the **pw-demo**
  browser app (pwdemo.com). pwplan-core is the _retirement-planning_ UI only. Don't
  add crypto-options or production-compliance code here.

## Before you commit (keep all five green — mirrors CI)

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Run `npm run format` before committing. Conventional commits. **This repo commits
directly to `main`** (no feature branches) — the exception is any change to the
public privacy / compliance posture, which goes via a review PR + CCO sign-off
(HITL Tier 2; see CLAUDE.md § Compliance).

## Prioritized next tasks (from ROADMAP)

1. **Theming** to the `-core` family visual language — held for a design reference;
   ask the maintainer for it before starting.
2. **Optional further calculators** inspired by OSS finance apps (dividend income,
   a withdrawal-tax-aware Roth ladder). Net-worth / holdings tracking stays **out
   of scope** (it would require PII / production data). Each new tool follows the
   established pattern: contract type → gateway method → store slice → pure
   validator → UI tab → tests → docs; engine side ships in nexus-core first.
3. **`NOTICE` patent application number** — DONE: filed 2026-06-04 as USPTO
   #64/082,241 (PW-PROV-003 provisional; conversion deadline 2027-06-04).

## Non-negotiable invariants (do not violate — see CLAUDE.md)

Thin shell (no quant/compliance logic here) · PII-free contract · backend-agnostic
gateway (`nexus-mcp` / `pw-api` via `VITE_PLANNING_BACKEND`) · the always-on
`assertNoPII` tripwire · the contract version is a wire contract (bump per semver).

## Reference

- Engine + API/MCP this UI calls: the `nexus-core` repo (live at `nexusmcp.site`).
- Cross-repo contract rules: [`CONTRIBUTING.md`](CONTRIBUTING.md).
