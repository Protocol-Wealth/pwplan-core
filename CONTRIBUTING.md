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

## Compliance

- The engine contract is **PII-free by construction**. Never add a field that
  could carry identity (name, DOB, SSN, email, phone, address). `planning.test.ts`
  enforces this and will fail your PR. Use derived variables (age, not DOB).
- Client↔run correlation uses an opaque `subjectRef` header set by pw-api, never
  an identity-derived value and never in the payload.

- Never bypass `redactOutbound` or `auditCall` in `src/lib/nexus-client.ts`.
- `VITE_COMPLIANCE_NOOP=1` is for local UI development only. The
  `compliance-present` CI job fails any build that ships with it enabled.
- Client-facing changes are gated. Anything that alters what an end client
  sees or how advice is framed requires CCO review before merge.

## Local dev

```bash
npm install
cp .env.example .env.local   # set VITE_COMPLIANCE_NOOP=1 for UI-only work
npm run dev
npm run typecheck && npm run lint && npm run format:check && npm test
```
