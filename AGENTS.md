# AGENTS.md — pwplan-core

Engineering and regulatory standards for every agent are `~/projects/AGENTS.md`.
Where this file conflicts with that one, that one wins. This file is only what
is specific to this repository. It does not describe what is live.

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

Architecture and the two-deployment model: `README.md`. Cross-repo contract
rules: `CONTRIBUTING.md`.

## Commands

Keep green before every commit (mirrors CI in `.github/workflows/ci.yml`):

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Run `npm run format` before committing. Conventional commits (`feat:`, `fix:`,
`chore:`, `docs:`, `refactor:`, `test:`).

```bash
npm run dev
```

runs the Vite UI. A fresh clone talks to the public nexus-core MCP demo with no
`.env` required.

`CHANGELOG.md` is append-only Keep a Changelog history. Add an entry under
`[Unreleased]` for every notable change; move to a version on release. GitHub
issues are the ordered next steps — re-query them; do not keep a parallel list
in a committed file.

## Boundaries

Load-bearing. Do not violate; if a task seems to require it, stop and surface
the conflict rather than working around it.

1. **Thin shell.** Quant math lives in nexus-core; production compliance lives in
   pwos-core (via the private fork). Never implement Monte Carlo, tax,
   correlation, glide-path, or real PII-de-identification / audit-log logic in
   this repo. The correct move is a PR to the engine or a compliance package,
   plus a contract change here. (Pure request-shape validation and presentation
   math in `src/components/` are fine — they are not quant or compliance logic.)
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
   the private fork via pwos-core). `src/lib/compliance.test.ts` covers it; keep
   it green.
5. **The contract version is a wire contract.** Bump `PLANNING_CONTRACT_VERSION`
   per `CONTRIBUTING.md` semver rules; never loosen `ContractMismatchError` to
   force a release through.

Stack and conventions (match pwos-core / nexus-core):

- React 19, Vite 8, Tailwind v4, TypeScript (strict), Zustand. npm, Node 22.
- ESLint flat config (`eslint.config.js`); Prettier with `semi: true`, double
  quotes, `trailingComma: "all"` (`.prettierrc`).
- Module boundaries: `src/contract/` (wire types, no logic) · `src/lib/`
  (gateway + PII tripwire) · `src/store/` (Zustand) · `src/components/` (UI +
  pure validation / presentation helpers). Keep them clean.
- No browser `localStorage` / `sessionStorage` in app code.
- No heavy dependencies; this repo stays light. Numerical deps belong in
  nexus-core, not here.

### Compliance / RIA guardrails

Protocol Wealth is an SEC-registered RIA. This is a developer tool, not
client-facing advice, but: keep the "software, not investment advice" disclaimer
in `README.md`, `NOTICE`, and the UI; any change that alters what an end client
would see or how advice is framed — **or that changes this repo's public privacy /
compliance posture** — must state the authority the wording rests on in the change
itself, and cite it. Do not add client-facing marketing copy here.

**There is no CCO gate and there never was one in code.** Officer designations
are governance facts recorded in pw-governance and surfaced at
pwos.app/governance; nothing routes to them for approval.

Production PII / audit / pw-api work is out of scope here (private fork +
pwos-core).

### Defensive patent

`NOTICE` cites USPTO provisional application **#64/082,241** (PW-PROV-003, filed
2026-06-04) — the planning-domain member of the `-core` patent family alongside
pwos-core #64/034,215 and nexus-core #64/034,229. 12-month non-provisional / PCT
conversion deadline: **2027-06-04**. Do not alter the number; any change to the
public patent posture is a published legal claim, so the change carries its
authority with it rather than waiting on an approval step.

## Deploy and CI

`.github/workflows/ci.yml` runs seven jobs on Node 22: typecheck, lint,
format-check, test, build, audit, and license-check.

This OSS UI defaults to the public nexus-core MCP demo at `https://nexusmcp.site`
(`VITE_PLANNING_GATEWAY_URL`). `VITE_PLANNING_BACKEND` selects `nexus-mcp` or
the `pw-api` private-fork seam. `.env.example` documents both variables.
