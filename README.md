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
  client to protect; you bring your own de-identified data. The self-host path.
- **pw-api** — Protocol Wealth production. Requests route through authenticated
  pw-api, which holds client context and the pseudonym→identity mapping and
  calls nexus server-to-server. Client planning requests never touch the public
  MCP surface.

Client↔run correlation (required for Reg S-P / Rule 17a-4 books-and-records)
uses an opaque `subjectRef` carried as a transport header, never derived from
identity and never in the math payload. pw-api maps it back to a client behind
auth; pwplan-core and nexus only ever see the token.

## Compliance is a tripwire, not a redactor

Since the contract can't carry PII, `@protocolwealthos/pii-guard` runs
fail-closed: if identity data ever appears in an outbound payload (an upstream
de-identification bug), the call throws instead of silently scrubbing. Every
engine call is appended to the `@protocolwealthos/audit-log` hash chain first.

## Quickstart

```bash
git clone https://github.com/Protocol-Wealth/pwplan-core.git
cd pwplan-core
npm install
cp .env.example .env.local
# VITE_PLANNING_BACKEND=nexus-mcp
# VITE_PLANNING_GATEWAY_URL=https://nexusmcp.site   (or http://localhost:8787)
# VITE_COMPLIANCE_NOOP=1   # local UI dev ONLY; never ship
npm run dev
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
