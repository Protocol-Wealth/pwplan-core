# Contributing to pwplan-core

## Ground rules

- pwplan-core is a **thin shell**. Quantitative logic belongs in nexus-core;
  compliance logic belongs in pwos-core. PRs that move math or PII handling
  into this repo will be declined. The right move is usually a PR to the
  engine or a compliance package, plus a contract bump here.
- All checks in `.github/workflows/ci.yml` must be green.

## Cross-repo contract

`src/contract/planning.ts` is a shared interface with nexus-core. It is the
single most fragile surface in this repo.

1. Any change to a request/response shape is a contract change.
2. Bump `PLANNING_CONTRACT_VERSION`:
   - **patch** — additive, backward-compatible (new optional field);
   - **minor** — additive, new tool or new required field with a default;
   - **major** — breaking (renamed/removed field, changed type).
3. A minor or major bump requires a coordinated nexus-core release. Link the
   nexus-core PR in your pw-planner PR description.
4. The client refuses to run against a mismatched engine version by design.
   Do not "loosen" the check to make a release work.

## Compliance scope

This OSS repo is demo / case-study tooling; full production compliance is **out
of scope** here (it lives in a private fork that integrates pwos-core and syncs
into pw-api). What this repo DOES enforce:

- The engine contract is **PII-free by construction**. Never add a field that
  could carry identity (name, DOB, SSN, email, phone, address). `planning.test.ts`
  enforces this and will fail your PR. Use derived variables (age, not DOB).
- `assertNoPII` in `src/lib/compliance.ts` is a small, always-on, dependency-free
  structural tripwire over the dispatch path. Never weaken it to a redactor or
  gate it behind a flag; never bypass it (or the `auditCall` seam) in
  `src/lib/planning-gateway.ts`. It is covered by `compliance.test.ts`.
- Client↔run correlation uses an opaque `subjectRef` header, never an
  identity-derived value and never in the payload.
- Do not add real PII de-identification, audit-log persistence, or pw-api wiring
  here — those belong to the private fork. See the pwos-core repo for guidelines.
- Client-facing changes are gated. Anything that alters what an end client sees
  or how advice is framed requires CCO review before merge.

## Local dev

```bash
npm install
npm run dev   # runs against https://nexusmcp.site by default; fake-client data only
npm run typecheck && npm run lint && npm run format:check && npm test
```
