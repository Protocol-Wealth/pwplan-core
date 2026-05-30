# NEXT-PROMPT.md

**What this is:** the prompt to start the _next_ pwplan-core session — to be run
**once nexus-core has finished building the 6-tool MCP server at contract
`0.1.0`** (the spec in [`docs/nexus-core-requirements.md`](docs/nexus-core-requirements.md)).
Until the engine is live, there is nothing here to do; the client-side types for
the two `0.1.0` additions are deliberately not written yet so client and engine
land at `0.1.0` together.

**Trigger:** nexus-core signals its planning server is live at `nexusmcp.site`
serving `"contractVersion": "0.1.0"` for all six tools.

**How to use:** copy the fenced block below into a fresh Claude Code session in
this repo.

---

```
Read CLAUDE.md, then CURRENT-STATE.md and ROADMAP.md, and the memory files
(especially next-contract-additive-changes.md). Confirm the five invariants back
to me.

Context: nexus-core has now built the planning MCP server to contract 0.1.0 — the
6-tool spec in docs/nexus-core-requirements.md. pwplan-core's contract types do
NOT yet include the two 0.1.0 additions; this session adds them so the client
matches the live engine, all at 0.1.0. Keep PLANNING_CONTRACT_VERSION = "0.1.0"
and invariant #5 intact — do NOT bump the version (the engine serves 0.1.0 and
the client's ContractMismatchError is an exact-match check).

Step 1 — confirm the engine is actually live before coding against it:
  node scripts/smoke-nexus.mjs
It POSTs the default PII-free scenario to monte_carlo_decumulation at
nexusmcp.site and checks the load-bearing response fields. If it fails (engine
down, CORS, wrong shape, or a contractVersion other than "0.1.0"), STOP and
report it — that's an engine-side bug to flag, not something to work around in the
client.

Step 2 — add the client side of the two 0.1.0 additions. Exact shapes are in
docs/nexus-core-requirements.md §3.1 and §3.6:
  a) src/contract/planning.ts:
     - add optional `pathCacheKey?: string` to MonteCarloRequest.
     - add the 6th tool's types:
         CapitalMarketAssumptionsRequest { contractVersion: typeof PLANNING_CONTRACT_VERSION; assetClassIds?: string[]; asOf?: string }
         CapitalMarketAssumptionsResult  { contractVersion: string; assetClasses: AssetClass[]; correlations: Record<string, Record<string, number>>; asOf: string }
     - add `capitalMarketAssumptions: "capital_market_assumptions"` to PLANNING_TOOLS.
       (assetClasses + correlations in the result are drop-in for a MonteCarloRequest.)
  b) src/lib/planning-gateway.ts: add planning.capitalMarketAssumptions(req, opts?)
     using the same callTool pattern as the other methods.
  c) src/lib/planning-gateway.test.ts: extend coverage — add the 6th tool to the
     "maps each tool to its exact contract tool id" test, plus a CMA dispatch test.
  Keep it PII-free (planning.test.ts enforces this) and thin-shell — no quant
  logic; the engine computes, the client only shapes/validates/renders.

Step 3 — gates + docs:
  Run each gate as its own command (the tool channel is flaky when chained):
  npm run typecheck ; npm run lint ; npm run format:check ; npm test ; npm run build
  Keep all green. NEVER commit on a nonzero gate rc. Update CHANGELOG.md
  [Unreleased] and CURRENT-STATE.md with the real test count copied from a fresh
  run (never from memory). Commit directly to main (ordinary work — no
  posture/CCO gate). Verify each commit with `git log -1` + a clean
  `git status --porcelain`.

Step 4 — optional follow-on (ASK me before building): surface the "real data,
fake clients" flow in the UI — a control that calls capital_market_assumptions
and drops the returned assetClasses + correlations into the Monte Carlo inputs.
This is a new feature; confirm scope first.

After this lands, the only open ROADMAP items are theming (needs a design
reference) and the NOTICE patent number (blocked on the maintainer).
```

---

_When this task is complete, delete this file (or replace its body with the next
hand-off) and drop the pointer from CURRENT-STATE.md / the memory index._
