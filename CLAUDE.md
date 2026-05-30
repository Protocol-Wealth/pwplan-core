# CLAUDE.md — pwplan-core

Operating instructions for Claude Code in this repository. Read this in full at
the start of every session, then read `CURRENT-STATE.md` and `ROADMAP.md` before
touching anything.

## What this repo is

pwplan-core is the open-source, regime-adaptive financial planning **thin UI**;
the third member of the `-core` family with pwos-core and nexus-core. Apache-2.0
with a defensive patent posture. It ships **zero quantitative logic and zero
compliance logic of its own**.

## Non-negotiable invariants

Load-bearing. Do not violate; if a task seems to require it, stop and surface
the conflict rather than working around it.

1. **Thin shell.** Quant math lives in nexus-core; compliance lives in the
   pwos-core packages. Never implement Monte Carlo, tax, correlation, glide-path,
   PII, or audit logic in this repo. The correct move is a PR to the engine or a
   compliance package, plus a contract change here.
2. **PII-free contract by construction.** `src/contract/planning.ts` must never
   declare a field carrying identity (name, dob, dateOfBirth, ssn, email, phone,
   address). Age, not DOB. `src/contract/planning.test.ts` enforces this; keep it
   green. Client-to-run correlation uses the opaque `subjectRef` transport header
   only, never an identity-derived value, never in the payload.
3. **Backend-agnostic gateway.** `src/lib/planning-gateway.ts` targets
   `nexus-mcp` (open) or `pw-api` (private) via `VITE_PLANNING_BACKEND`. Do not
   hardcode a backend or bypass the gateway.
4. **Compliance is a fail-closed tripwire.** `assertNoPII` throws on identity
   leakage; never downgrade it to silent redaction, and never bypass it or
   `auditCall` in the dispatch path.
5. **The contract version is a wire contract.** Bump `PLANNING_CONTRACT_VERSION`
   per CONTRIBUTING.md semver rules; never loosen `ContractMismatchError` to force
   a release through.

## Stack and conventions (match pwos-core / nexus-core)

- React 19, Vite 6, Tailwind v4, TypeScript (strict), Zustand. npm, Node 22.
- ESLint flat config; Prettier with `semi: true`, double quotes, `trailingComma:
"all"`. Run `npm run format` before committing.
- Module boundaries: `contract/` (wire types, no logic) · `lib/` (gateway +
  compliance adapters) · `store/` (Zustand) · `components/` (UI). Keep them clean.
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

Session protocol: (1) read CURRENT-STATE.md + ROADMAP.md; (2) do the work;
(3) run the full check suite; (4) update CHANGELOG.md and, if state changed,
CURRENT-STATE.md; (5) commit.

## Before every commit

Run and keep green (mirrors the 8 CI jobs):

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
Never commit `VITE_COMPLIANCE_NOOP=1` in any `.env*` file; the
`compliance-present` CI job fails the build.

## Compliance / RIA guardrails

Protocol Wealth is an SEC-registered RIA. This is a developer tool, not
client-facing advice, but: keep the "software, not investment advice" disclaimer
in README, NOTICE, and the UI; any change that alters what an end client would
see or how advice is framed is HITL Tier 2 and requires CCO (Adam) review before
publication; do not add client-facing marketing copy in this repo.

## Defensive patent

`NOTICE` carries `<PATENT_APP_NO>` as a TODO. Do not invent a number; leave the
placeholder until the verified application number is supplied by the maintainer.

## Pointers

- Architecture and the two-deployment model: `README.md`
- Cross-repo contract rules: `CONTRIBUTING.md`
- What exists now: `CURRENT-STATE.md`
- What is next: `ROADMAP.md`
