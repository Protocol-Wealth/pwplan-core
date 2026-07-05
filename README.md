# pwplan-core

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Patent Pending](https://img.shields.io/badge/Patent-Pending-orange.svg)](https://patentcenter.uspto.gov/applications/64082241)
[![OIN Member](https://img.shields.io/badge/OIN-Member-green.svg)](https://openinventionnetwork.com)
[![GitHub stars](https://img.shields.io/github/stars/Protocol-Wealth/pwplan-core?style=social)](https://github.com/Protocol-Wealth/pwplan-core/stargazers)

**Open-source, regime-adaptive financial planning — a privacy-first thin UI.**
The third member of the `-core` family alongside
[`pwos-core`](https://github.com/Protocol-Wealth) and
[`nexus-core`](https://github.com/Protocol-Wealth). Anyone can self-host it; it
ships zero quantitative or compliance logic of its own.

> Software, not investment advice. Outputs are projections, not guarantees.
> Not affiliated with, and does not endorse, any third-party tool.

## The idea: a thin UI that never sees identity

pwplan-core takes in **de-identified planning variables** (age, not date of
birth; no name), processes and analyzes them, and renders results. The engine
contract is **PII-free by construction** — see
[`src/contract/planning.ts`](src/contract/planning.ts). There is no field for a
name, DOB, SSN, email, or address anywhere, and `planning.test.ts` fails the
build if one is ever added.

That single invariant is what lets the same UI safely target two backends.

## Two deployments, one UI

Selected by `VITE_PLANNING_BACKEND`:

```
OPEN REFERENCE (anyone)                   PW PRODUCTION (private)
  VITE_PLANNING_BACKEND=nexus-mcp           VITE_PLANNING_BACKEND=pw-api
+---------------------------+             +---------------------------+
|  pwplan-core (thin UI)    |             |  pwplan-core UI pattern   |
|                           |             |  → pwos.app/plan, /chat   |
+-------------+-------------+             +-------------+-------------+
              | de-identified                          | de-id + opaque
              | planning vars                          | subjectRef (auth)
              v                                        v
+---------------------------+             +---------------------------+
|  nexus-core MCP           |             |  pw-api  (private)        |
|  (nexusmcp.site)          |             |  client context +         |
|  public quant surface     |             |  subjectRef→identity map  |
+---------------------------+             +-------------+-------------+
                                                        | server-to-server
                                                        v
                                          +---------------------------+
                                          |  nexus-core (internal)    |
                                          |  client request NEVER     |
                                          |  hits the public endpoint |
                                          +---------------------------+
```

- **nexus-mcp** — browser talks directly to the nexus-core MCP gateway. No
  client to protect; you bring your own de-identified data. The self-host /
  demo path, and all this OSS repo ever uses.
- **pw-api** — Protocol Wealth production, implemented in a **private fork** of
  this repo (not this codebase). Requests route through authenticated pw-api,
  which holds client context and the pseudonym→identity mapping and calls nexus
  server-to-server. Shown here only to explain why the gateway is
  backend-agnostic; the open build never targets it.

Client↔run correlation uses an opaque `subjectRef` carried as a transport
header, never derived from identity and never in the math payload. In the open
demo it is just an optional token; in the private fork, pw-api maps it back to a
client behind auth (for Reg S-P / Rule 17a-4 books-and-records). pwplan-core and
nexus only ever see the token, never an identity.

## Compliance scope (read this)

**This open-source repo is demo / case-study tooling.** It is built to be pointed
at the public nexus-core engine with **de-identified or fully fake client data**:
enter ages, balances, and allocations — never names, DOB, SSNs, emails, phones, or
addresses. Two things keep that safe:

- **PII-free contract by construction** — there is no field anywhere in
  [`src/contract/planning.ts`](src/contract/planning.ts) that can carry identity;
  `planning.test.ts` fails the build if one is added.
- **A structural tripwire** — `assertNoPII`
  ([`src/lib/compliance.ts`](src/lib/compliance.ts)) is a small, always-on,
  dependency-free guard that throws if an identity-shaped key ever reaches the
  dispatch path. It never redacts, transforms, or stores anything.

**Out of scope for this repo:** real PII de-identification, books-and-records
audit logging, and any pw-api integration. Those belong to a **private fork**
that syncs into pw-api and integrates the pwos-core compliance packages. If you
are wiring this into a regulated production environment, that is a separate
exercise — follow the [`pwos-core`](https://github.com/Protocol-Wealth)
guidelines; this repo intentionally ships none of it. The `pw-api` value of
`VITE_PLANNING_BACKEND` exists only so that private fork stays a low-diff sync;
this OSS build never reaches pw-api.

### Cash Flow OS and Planning Bridge boundary

The current product direction is **PW Cash Flow OS + PW Planning Lab + PW
Retirement Income Lab**. In that architecture, this repo stays the public-safe
reference shell:

- OK here: synthetic workflows, de-identified contracts, demo-only rule traces,
  monthly-close examples, and a Planning Bridge view that shows how derived
  monthly cash-flow values can feed planning assumptions.
- Not OK here: Monarch CSV upload, raw import rows, merchant/payee strings,
  account nicknames, household records, advisor/client notes, document requests,
  approval state, release state, audit trails, or any real client collaboration
  workflow.

Real ingestion, household-specific rule processing, advisor approval, client
release, and compliance trail belong in private PWOS / pw-api / PWPortal. Nexus
should receive only de-identified planning inputs and derived numbers, never raw
household transactions.

## Quickstart

```bash
git clone https://github.com/Protocol-Wealth/pwplan-core.git
cd pwplan-core
npm install
npm run dev
# Runs against the public nexus-core MCP demo (https://nexusmcp.site) out of the
# box — no .env needed. Bring de-identified / fake-client data only.
# To point elsewhere: cp .env.example .env.local and set VITE_PLANNING_GATEWAY_URL.
```

## Engine contract

`PLANNING_CONTRACT_VERSION` is the wire contract both pwplan-core and the engine
pin. Breaking changes are a major bump and a coordinated release. The client
throws `ContractMismatchError` on drift.

The wire contract covers **21 planning tools**. Eighteen are surfaced in the UI —
seventeen as tabs plus the `capital_market_assumptions` control inside the Monte
Carlo tab. The three Cash Flow OS planning bridge tools are contract/gateway-only
today; they are reserved for a future synthetic demo UI and accept derived
monthly-close aggregates only. The Roth · IRMAA tab uses a separate case contract
(`PLANNING_CASE_CONTRACT_VERSION`) because it mirrors the canonical
Roth-conversion planning schema.

| Tool                         | Purpose                                               | UI         |
| ---------------------------- | ----------------------------------------------------- | ---------- |
| `monte_carlo_decumulation`   | Path simulation with tax-aware spend-down             | tab        |
| `glide_path`                 | Target equity weight by age                           | tab        |
| `tax_aware_withdrawal`       | Per-year withdrawal ordering + RMD                    | tab        |
| `roth_conversion`            | Convert-now vs. leave-pre-tax after-tax comparison    | tab        |
| `sequence_of_returns_stress` | Ordering effect on a fixed return set                 | tab        |
| `rmd`                        | Required minimum distribution (Uniform Lifetime)      | tab        |
| `tax_bracket_headroom`       | Marginal bracket + room to the next rate (Roth-fill)  | tab        |
| `social_security_claiming`   | Benefit by claim age 62–70 + breakeven ages           | tab        |
| `regime_conditioned_swr`     | Base SWR adjusted for the live macro regime           | tab        |
| `correlation_matrix`         | Real-data return correlations (shrinkage optional)    | tab        |
| `regime_return_generator`    | Live regime + transition matrix + path cache key      | tab        |
| `portfolio_xray`             | Regime-aware structural diagnostics + findings        | tab        |
| `fire`                       | FIRE / Coast-FIRE number + years to independence      | tab        |
| `risk_metrics`               | Sharpe / Sortino / drawdown / VaR for a return series | tab        |
| `rebalance`                  | Drift + self-financing trades to target weights       | tab        |
| `optimize_allocation`        | Mean-variance allocation over engine-sourced data     | tab        |
| `build_planning_report`      | Assemble de-identified planning sections into report  | tab        |
| `capital_market_assumptions` | Real returns / vols / λ / correlations                | MC control |
| `cashflow_planning_bridge`   | Monthly-close aggregates → planning assumptions       | gateway    |
| `cash_reserve_analysis`      | Reserve target / coverage / funding status            | gateway    |
| `budget_pacing_projection`   | Month-end budget pace from aggregate spending         | gateway    |

## Stack

React 19 · Vite 8 · Tailwind v4 · TypeScript · Zustand. nexus gateway / pw-api
on GCP Cloud Run; Cloudflare at the edge.

## Working with Claude Code

This repo is built primarily by Claude Code. Governance lives in
[`CLAUDE.md`](CLAUDE.md) (operating rules and invariants) and three memory files
the agent maintains as it works: [`CURRENT-STATE.md`](CURRENT-STATE.md) (what
exists now), [`CHANGELOG.md`](CHANGELOG.md) (history), and
[`ROADMAP.md`](ROADMAP.md) (what is next). These are committed on purpose; they
are how a stateless CLI keeps continuity across sessions. Start a session by
reading CLAUDE.md.

## Current Tracking

Open build and alignment work is tracked in GitHub issues:

- [#15](https://github.com/Protocol-Wealth/pwplan-core/issues/15) — Nexus/PWOS
  planning surface alignment, including any public-safe Cash Flow OS / Planning
  Bridge contract extraction decisions.
- [#16](https://github.com/Protocol-Wealth/pwplan-core/issues/16) — `-core`
  family visual theming.
- [#17](https://github.com/Protocol-Wealth/pwplan-core/issues/17) — optional
  public-safe planning calculators.

## Patent & IP

**Patent Pending** — USPTO Application #64/082,241 (PW-PROV-003)
"Privacy-by-Construction Financial Planning System with PII-Free Compute Plane,
Opaque Subject References, and Regime-Adaptive Projection for Regulated Financial
Advisory Services"

- [Patent disclosure](https://protocolwealthllc.com/patent) · [USPTO Patent Center](https://patentcenter.uspto.gov/applications/64082241) · [Figure 1 — system drawing (PDF)](docs/PW-PROV-003-FIG1.pdf)
- Applicant: Protocol Wealth, LLC
- Inventor: Nicholas Rygiel
- Filed: June 4, 2026
- Status: Patent Pending (provisional; 12-month conversion deadline 2027-06-04)

The architecture relied on by this project — a privacy-by-construction
financial-planning system in which the planning compute plane never receives PII
by construction (opaque subject references and non-identifying derived
attributes), with regime-adaptive projection, separating a public PII-free
compute plane from a firm-side production plane — is filed **defensively** under
Apache-2.0. The Apache-2.0 patent grant (Section 3) confers an automatic,
perpetual, royalty-free patent license to all users, with a retaliation clause
that terminates that grant for any party initiating patent litigation over the
Work.

**Open Invention Network (OIN) Member** — Protocol Wealth LLC is a member of the
Open Invention Network (OIN). See [NOTICE](NOTICE) for the full posture.

## License

Apache-2.0 with a defensive patent posture. See [LICENSE](LICENSE) and
[NOTICE](NOTICE). Protocol Wealth LLC is a member of the Open Invention Network
(OIN). Leverage it freely alongside pwos-core and nexus-core.
