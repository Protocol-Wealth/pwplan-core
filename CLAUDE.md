# CLAUDE.md — pwplan-core

Operating instructions for Claude Code in this repository. Read this in full at
the start of every session, then read `CURRENT-STATE.md` and `ROADMAP.md` before
touching anything.

## What this repo is

pwplan-core is the open-source, regime-adaptive financial planning **thin UI**;
the third member of the `-core` family with pwos-core and nexus-core. Apache-2.0
with a defensive patent posture. It ships **zero quantitative logic of its own**,
and only a lightweight structural PII tripwire — no production compliance stack.

It is **demo / case-study tooling**: pointed at the public nexus-core engine with
de-identified or fake client data. Production compliance (real PII
de-identification, books-and-records audit logging, pw-api integration) is **out
of scope** and lives only in a **private fork** that syncs into pw-api and
integrates pwos-core. Do not bring that machinery into this repo.

## Non-negotiable invariants

Load-bearing. Do not violate; if a task seems to require it, stop and surface
the conflict rather than working around it.

1. **Thin shell.** Quant math lives in nexus-core; production compliance lives in
   pwos-core (via the private fork). Never implement Monte Carlo, tax,
   correlation, glide-path, or real PII-de-identification / audit-log logic in
   this repo. The correct move is a PR to the engine or a compliance package,
   plus a contract change here. (Pure request-shape validation and presentation
   math in `components/` are fine — they are not quant or compliance logic.)
2. **PII-free contract by construction.** `src/contract/planning.ts` must never
   declare a field carrying identity (name, dob, dateOfBirth, ssn, email, phone,
   address). Age, not DOB. `src/contract/planning.test.ts` enforces this; keep it
   green. Client-to-run correlation uses the opaque `subjectRef` transport header
   only, never an identity-derived value, never in the payload.
3. **Backend-agnostic gateway.** `src/lib/planning-gateway.ts` targets
   `nexus-mcp` (open, the only backend this repo uses) or `pw-api` (private-fork
   seam) via `VITE_PLANNING_BACKEND`. Do not hardcode a backend or bypass the
   gateway. Keep the `pw-api` seam intact so the private fork stays a low-diff
   sync — but never add code here that actually depends on pw-api.
4. **PII tripwire stays a structural, always-on, dep-free guard.** `assertNoPII`
   (`src/lib/compliance.ts`) throws on any identity-shaped key in the dispatch
   path; never downgrade it to silent redaction, gate it behind a flag, add a
   dependency to it, or bypass it (or the `auditCall` no-op seam) in the gateway.
   It is NOT the production compliance stack — that is out of scope (it lives in
   the private fork via pwos-core). `compliance.test.ts` covers it; keep it green.
5. **The contract version is a wire contract.** Bump `PLANNING_CONTRACT_VERSION`
   per CONTRIBUTING.md semver rules; never loosen `ContractMismatchError` to force
   a release through.

## Stack and conventions (match pwos-core / nexus-core)

- React 19, Vite 8, Tailwind v4, TypeScript (strict), Zustand. npm, Node 22.
- ESLint flat config; Prettier with `semi: true`, double quotes, `trailingComma:
"all"`. Run `npm run format` before committing.
- Module boundaries: `contract/` (wire types, no logic) · `lib/` (gateway +
  PII tripwire) · `store/` (Zustand) · `components/` (UI + pure validation /
  presentation helpers). Keep them clean.
- No browser `localStorage` / `sessionStorage` in app code.
- No heavy dependencies; this repo stays light. Numerical deps belong in
  nexus-core, not here.

## Memory discipline (REQUIRED)

You are stateless across sessions. These three files are your memory; keep them
current or the next session starts blind.

- **CURRENT-STATE.md** — snapshot of what exists right now (as-built
  architecture, file inventory, wired vs stubbed, known gaps). Read first;
  maintain it after meaningful progress.
- **CHANGELOG.md** — append-only history, Keep a Changelog format. Add an entry
  under `[Unreleased]` for every notable change; move to a version on release.
- **ROADMAP.md** — ordered next steps. Pull the next task from here; check items
  off and re-order as priorities shift.

GitHub issues track outstanding and future work. Current open lanes are #15
(Nexus/PWOS planning-surface alignment), #16 (`-core` visual theming), and #17
(optional public-safe calculators). Keep ROADMAP/NEXT-STEPS and issue state in
sync when opening, completing, or deferring work.

Session protocol: (1) read CURRENT-STATE.md + ROADMAP.md and check open GitHub
issues; (2) do the work; (3) run the full check suite; (4) update CHANGELOG.md
and, if state changed, CURRENT-STATE.md plus issue references; (5) commit.

## Before every commit

Run and keep green (mirrors the 7 CI jobs):

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).

## Compliance / RIA guardrails

Protocol Wealth is an SEC-registered RIA. This is a developer tool, not
client-facing advice, but: keep the "software, not investment advice" disclaimer
in README, NOTICE, and the UI; any change that alters what an end client would
see or how advice is framed — **or that changes this repo's public privacy /
compliance posture** — is HITL Tier 2 and requires CCO (Adam) review before
publication; do not add client-facing marketing copy in this repo. Production
PII / audit / pw-api work is out of scope here (private fork + pwos-core).

## Defensive patent

`NOTICE` cites USPTO provisional application **#64/082,241** (PW-PROV-003, filed
2026-06-04) — the planning-domain member of the `-core` patent family alongside
pwos-core #64/034,215 and nexus-core #64/034,229. 12-month non-provisional / PCT
conversion deadline: **2027-06-04**. Do not alter the number; any change to the
public patent posture is HITL Tier 2 (CCO review before publication).

## Pointers

- Architecture and the two-deployment model: `README.md`
- Cross-repo contract rules: `CONTRIBUTING.md`
- What exists now: `CURRENT-STATE.md`
- What is next: `ROADMAP.md`
