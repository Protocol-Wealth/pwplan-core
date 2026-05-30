# pwplan-core

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

| Tool                       | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| `monte_carlo_decumulation` | Path simulation with tax-aware spend-down  |
| `tax_aware_withdrawal`     | Per-year withdrawal ordering + RMD         |
| `glide_path`               | Target equity weight by age                |
| `correlation_matrix`       | Covariance estimation (shrinkage optional) |
| `regime_return_generator`  | EMF regime classification → return paths   |

## Stack

React 19 · Vite 6 · Tailwind v4 · TypeScript · Zustand. nexus gateway / pw-api
on GCP Cloud Run; Cloudflare at the edge.

## Working with Claude Code

This repo is built primarily by Claude Code. Governance lives in
[`CLAUDE.md`](CLAUDE.md) (operating rules and invariants) and three memory files
the agent maintains as it works: [`CURRENT-STATE.md`](CURRENT-STATE.md) (what
exists now), [`CHANGELOG.md`](CHANGELOG.md) (history), and
[`ROADMAP.md`](ROADMAP.md) (what is next). These are committed on purpose; they
are how a stateless CLI keeps continuity across sessions. Start a session by
reading CLAUDE.md.

## License

Apache-2.0 with a defensive patent posture. See [LICENSE](LICENSE) and
[NOTICE](NOTICE). Protocol Wealth is a member of the Open Invention Network.
Leverage it freely alongside pwos-core and nexus-core.
