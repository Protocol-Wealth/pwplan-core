# nexus-core MCP — requirements for pwplan-core (consumer-side spec)

_Generated 2026-05-30 from `src/contract/planning.ts` v0.1.0, `src/lib/planning-gateway.ts`, `src/store/scenario.ts`, and the results components. This is what the **pwplan-core thin UI** needs the nexus-core MCP server (nexusmcp.site) to provide to function fully, including all demo capabilities._

> Dependency direction is **consumer-only**: pwplan-core imports nothing from nexus-core except over the wire. The shapes below are a **versioned contract** (`PLANNING_CONTRACT_VERSION = "0.1.0"`). A breaking change to any request/response shape requires a major bump + coordinated release.

> **Scope of contract `0.1.0` (6 tools).** Both former §6 "gaps" — the
> `capital_market_assumptions` tool (§3.6) and the `pathCacheKey?` field on
> `monte_carlo_decumulation` (§3.1) — are now **part of `0.1.0`, not a future
> bump.** The nexus-core engine is pre-first-release, so amending the `0.1.0`
> shape before its first release is not a breaking change; a version bump would
> instead break the client's exact-match version check against an engine that
> ships `0.1.0`. **Build all six tools to this spec and serve
> `"contractVersion": "0.1.0"`.** When the engine is live, any later shape change
> follows the normal semver + coordinated-release rule.

---

## 0. Deployment model & ground rules

- **Client is a browser thin shell.** No backend of its own. It calls the engine over HTTP/JSON.
- **Two backends** selected by `VITE_PLANNING_BACKEND`:
  - `nexus-mcp` (default) → **this is what nexusmcp.site serves.** Public, bring-your-own de-identified / fake-client data. Path convention `POST /mcp/tools/{toolId}`.
  - `pw-api` → private fork only; path convention `POST /v1/planning/{toolId}`. **Not in scope for the public engine** — but keep tool ids identical so the fork is a low-diff sync.
- **PII-free by construction.** The engine must never require or accept identity fields (`name`, `firstName`, `lastName`, `dob`, `dateOfBirth`, `ssn`, `email`, `phone`, `address`). Planning uses **age, not DOB**. The client enforces this with a fail-closed tripwire before dispatch; the engine should also reject identity-shaped keys defensively.
- **Client↔run correlation is out-of-band**, via the opaque `x-pw-subject-ref` header only — never in the payload, never identity-derived. The public engine can ignore it; only pw-api maps it.

---

## 1. Transport & protocol-level requirements (apply to every tool)

| Concern                        | Requirement                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method / format                | `POST`, `Content-Type: application/json`, request + response bodies are JSON.                                                                                                                                                                                                                                                                                 |
| Base URL                       | `https://nexusmcp.site` (client default; overridable via `VITE_PLANNING_GATEWAY_URL`). Must be **HTTPS** (browser, mixed-content).                                                                                                                                                                                                                            |
| Path                           | `POST /mcp/tools/{toolId}` where `{toolId}` is one of the six ids in §3.                                                                                                                                                                                                                                                                                      |
| **CORS (required for demo)**   | Browser-origin calls. Must return `Access-Control-Allow-Origin` for the demo origin(s), allow methods `POST, OPTIONS`, and **allow the custom request headers** `content-type, x-pw-audit-id, x-pw-contract-version, x-pw-subject-ref`. The custom `x-pw-*` headers **trigger a CORS preflight**, so the server **must handle `OPTIONS`** on every tool path. |
| Auth                           | **None on the public demo.** Public endpoints must be callable without credentials. (Auth lives only in pw-api.)                                                                                                                                                                                                                                              |
| Request headers sent by client | `content-type: application/json`; `x-pw-audit-id` (opaque, no-op in OSS — accept & ignore); `x-pw-contract-version: 0.1.0`; `x-pw-subject-ref` (optional, opaque — accept & ignore on public engine).                                                                                                                                                         |
| **Response `contractVersion`** | Every response body **must include** `contractVersion`. The client throws `ContractMismatchError` if it is present and ≠ `"0.1.0"`. So: always echo the version you served.                                                                                                                                                                                   |
| Error responses                | Any non-2xx → client throws `Error("planning gateway {status}: {body text}")`, and the **body text is shown verbatim in the UI error panel**. Return meaningful status + a short human-readable message: `400` bad request-shape, `422` infeasible plan, `429` rate-limited, `5xx` engine error.                                                              |
| **Determinism**                | Requests carry an optional `seed`; responses echo `seedUsed`. **Same payload + same seed ⇒ byte-identical result.** Required for reproducible demos and case-study what-ifs.                                                                                                                                                                                  |
| Latency                        | Target a responsive demo: a 10,000-path Monte Carlo should return within a few seconds. The UI shows a "running" state but has no client-side timeout beyond `fetch` defaults.                                                                                                                                                                                |

---

## 2. MCP-level capabilities

The HTTP client hardcodes the tool ids and does **not** call `tools/list` at runtime — but for MCP correctness and stdio/agent use:

1. **Expose all six as standard MCP tools** (`tools/list` + `tools/call`) with JSON Schemas matching §3. The HTTP gateway maps `/mcp/tools/{id}` → `tools/call`.
2. **Tool ids must match exactly** (these are the wire ids):
   - `monte_carlo_decumulation`
   - `glide_path`
   - `tax_aware_withdrawal`
   - `correlation_matrix`
   - `regime_return_generator`
   - `capital_market_assumptions`
3. _(Desirable)_ A **version handshake** — a `GET` that reports supported contract version(s) — so the UI can warn proactively instead of only after a failed call.
4. _(Desirable)_ A **health endpoint** (`GET /health`) for demo uptime checks.

---

## 3. Tool-by-tool requirements

For each tool: request fields the engine must accept, response fields it must return, semantics, and **which response fields are load-bearing for the UI** (if missing/misshaped, the demo breaks).

### 3.1 `monte_carlo_decumulation` — primary tool

**Request**

```json
{
  "contractVersion": "0.1.0",
  "currentAge": 45,
  "horizonAge": 95,
  "accounts": [
    {
      "type": "traditional",
      "balance": 1200000,
      "allocation": { "us_equity": 0.6, "us_bonds": 0.4 }
    },
    {
      "type": "roth",
      "balance": 300000,
      "allocation": { "us_equity": 0.8, "us_bonds": 0.2 }
    }
  ],
  "assetClasses": [
    {
      "id": "us_equity",
      "label": "US Equity",
      "expectedReturn": 0.07,
      "volatility": 0.16,
      "lambda": 0.35
    },
    {
      "id": "us_bonds",
      "label": "US Bonds",
      "expectedReturn": 0.03,
      "volatility": 0.05,
      "lambda": 0.1
    }
  ],
  "correlations": null,
  "annualSpend": 120000,
  "spendColaRate": 0.025,
  "guaranteedIncome": [
    {
      "label": "Social Security",
      "annualAmount": 42000,
      "startAge": 67,
      "colaRate": 0.02
    }
  ],
  "filingStatus": "married_joint",
  "returnModel": "emf_regime",
  "paths": 10000,
  "seed": null,
  "pathCacheKey": null
}
```

- `correlations` is **optional**: `assetClassId → assetClassId → ρ`, symmetric, diagonal = 1. **When omitted, the engine must estimate it internally** (the contract says "omit to have the engine estimate via the `correlation_matrix` tool"). So the MC tool cannot hard-require a correlation matrix from the client.
- `returnModel` ∈ `multivariate_normal | student_t | block_bootstrap | markov_regime | emf_regime`. **All five must be supported.** `emf_regime` is the differentiated path — it must drive the simulation off the live EMF regime classifier + per-asset `lambda`.
- `lambda` on each asset class is **required when `returnModel = "emf_regime"`**, ignored otherwise.
- `seed` optional; if provided, run is deterministic.
- **`pathCacheKey?: string`** _(part of 0.1.0)_ — optional. A `pathCacheKey` returned by `regime_return_generator` (§3.5), replayed here so the engine reuses the cached EMF paths instead of regenerating them. When **absent**, behave exactly as before (generate fresh). When **present but unknown/expired**, the engine should regenerate rather than error (treat a stale key as a cache miss).

**Response**

```json
{
  "contractVersion": "0.1.0",
  "successProbability": 0.86,
  "terminalValues": {
    "p10": 250000,
    "p25": 900000,
    "p50": 1800000,
    "p75": 3200000,
    "p90": 5400000
  },
  "medianBalanceByYear": [1500000, 1490000, "… one entry per year …"],
  "worstPathTerminal": 0,
  "regimePathSummary": [
    "expansion",
    "expansion",
    "crisis",
    "inflationary",
    "…"
  ],
  "seedUsed": 12345
}
```

- **`successProbability`** (0..1) — headline metric, rendered as a percentage. _Load-bearing._
- **`terminalValues`** — percentile → value map. Keys are parsed by digits and sorted numerically (`p10` before `p90`); any percentile set works but `p10/p25/p50/p75/p90` is the expected demo set. Rendered as bars. _Load-bearing._
- **`medianBalanceByYear`** — number[]; **length must equal `horizonAge − currentAge`**. Rendered as the line/area chart (y-domain always includes 0). _Load-bearing._
- `worstPathTerminal` — worst sequence-of-returns terminal value (displayed numerically).
- **`regimePathSummary`** — `Regime[]`, **populate for regime-aware models** (`emf_regime`, `markov_regime`). Collapsed into a colored run-length strip. Optional but it's the visual headline of the demo. Each value ∈ `expansion | inflationary | deflationary | stagflation | crisis`.
- `seedUsed` — the seed actually used (echo input or report the generated one).

### 3.2 `glide_path`

**Request**

```json
{
  "contractVersion": "0.1.0",
  "currentAge": 45,
  "retirementAge": 65,
  "horizonAge": 95,
  "startEquityWeight": 0.7,
  "endEquityWeight": 0.3,
  "shape": "linear"
}
```

- `shape` ∈ `linear | to_through | rising_equity`. All three must be supported.
- Equity weights are decimals in `[0,1]`.

**Response**

```json
{
  "contractVersion": "0.1.0",
  "equityWeightByAge": { "45": 0.7, "46": 0.69, "…": "…", "95": 0.3 }
}
```

- **`equityWeightByAge`** — `age → equity weight` map; weights in `[0,1]`. Rendered as a line chart on a **fixed 0..1 axis**. Should span `currentAge → horizonAge`. _Load-bearing._

### 3.3 `tax_aware_withdrawal`

**Request**

```json
{
  "contractVersion": "0.1.0",
  "year": 2026,
  "filingStatus": "married_joint",
  "accounts": ["… same shared portfolio shape as Monte Carlo …"],
  "grossNeed": 120000,
  "age": 65,
  "otherTaxableIncome": 0
}
```

- `year` drives the tax-bracket table lookup. `age` drives RMD determination. `accounts` is the **same `Account[]` shape** (shared portfolio).

**Response**

```json
{
  "contractVersion": "0.1.0",
  "withdrawals": [
    { "type": "taxable", "gross": 40000, "tax": 4000 },
    { "type": "traditional", "gross": 70000, "tax": 12000 },
    { "type": "roth", "gross": 10000, "tax": 0 }
  ],
  "totalTax": 16000,
  "effectiveRate": 0.133,
  "rmdSatisfied": true
}
```

- **`withdrawals`** — ordered plan, one row per `AccountType` drawn (`{type, gross, tax}`). Rendered as a table. _Load-bearing._
- **`totalTax`**, **`effectiveRate`** (0..1), **`rmdSatisfied`** (bool, shown as an indicator). _Load-bearing._

### 3.4 `correlation_matrix`

**Request**

```json
{
  "contractVersion": "0.1.0",
  "assetClassIds": ["us_equity", "us_bonds"],
  "lookbackDays": 1260,
  "shrinkage": true
}
```

- `lookbackDays` = covariance estimation window (trading days). `shrinkage` toggles the Ledoit-Wolf estimator.

**Response**

```json
{
  "contractVersion": "0.1.0",
  "matrix": {
    "us_equity": { "us_equity": 1, "us_bonds": 0.2 },
    "us_bonds": { "us_equity": 0.2, "us_bonds": 1 }
  },
  "asOf": "2026-05-29"
}
```

- `matrix` symmetric, diagonal = 1. `asOf` ISO date (data provenance).
- **Not yet surfaced in the UI**, but the engine must implement it because `monte_carlo_decumulation` relies on the same estimation when `correlations` is omitted. Returning `asOf` lets the UI show real-data provenance in future.

### 3.5 `regime_return_generator` (EMF-wired)

**Request**

```json
{
  "contractVersion": "0.1.0",
  "assetClasses": ["… AssetClass[] with lambda required on each …"],
  "horizonYears": 50,
  "paths": 10000,
  "seed": null
}
```

**Response**

```json
{
  "contractVersion": "0.1.0",
  "currentRegime": "expansion",
  "transitionMatrix": {
    "expansion": {
      "expansion": 0.8,
      "inflationary": 0.08,
      "deflationary": 0.04,
      "stagflation": 0.04,
      "crisis": 0.04
    },
    "inflationary": { "…": "…" },
    "deflationary": { "…": "…" },
    "stagflation": { "…": "…" },
    "crisis": { "…": "…" }
  },
  "pathCacheKey": "emf-2026-05-30-abc123"
}
```

- **`currentRegime`** + **`transitionMatrix`** (full 5×5 over all `Regime` values, rows sum to 1) come from the **live EMF classifier** — this is the headline differentiator; demos should be able to show "we are currently in X, here is the transition structure."
- `pathCacheKey` — opaque reference to an engine-side path cache. The client passes it back to `monte_carlo_decumulation` via the **`pathCacheKey?` request field (§3.1)** to reuse the generated EMF paths. Make it engine-meaningful and reasonably stable; the client treats it as an opaque token.

### 3.6 `capital_market_assumptions` — "real data, fake clients" (part of 0.1.0)

The headline demo capability: source **real** capital-market assumptions (returns, vols, λ, correlations) from the engine, then run them against **fake/de-identified portfolios**. The response is designed to be **drop-in** for a `monte_carlo_decumulation` request — its `assetClasses` and `correlations` slot directly into the MC payload (§3.1).

**Request**

```json
{
  "contractVersion": "0.1.0",
  "assetClassIds": ["us_equity", "us_bonds"],
  "asOf": null
}
```

- `assetClassIds?: string[]` — **optional** filter. Omit (or `null`) ⇒ return the engine's full default asset universe. When provided, return exactly those ids (and `400` if an id is unknown).
- `asOf?: string` — **optional** ISO date. Omit (or `null`) ⇒ latest available assumptions. When provided, return the assumptions as of that date (or the most recent on/before it).

**Response**

```json
{
  "contractVersion": "0.1.0",
  "assetClasses": [
    {
      "id": "us_equity",
      "label": "US Equity",
      "expectedReturn": 0.068,
      "volatility": 0.162,
      "lambda": 0.34
    },
    {
      "id": "us_bonds",
      "label": "US Bonds",
      "expectedReturn": 0.041,
      "volatility": 0.058,
      "lambda": 0.11
    }
  ],
  "correlations": {
    "us_equity": { "us_equity": 1, "us_bonds": -0.15 },
    "us_bonds": { "us_equity": -0.15, "us_bonds": 1 }
  },
  "asOf": "2026-05-29"
}
```

- **`assetClasses`** — `AssetClass[]` with **real** `expectedReturn` / `volatility` / `lambda`. Populate `lambda` on every entry so the result is immediately usable with `returnModel: "emf_regime"` downstream. _Load-bearing._
- **`correlations`** — **same shape as `MonteCarloRequest.correlations`** (`Record<id, Record<id, number>>`, symmetric, diagonal = 1), so the client can pass it straight through. _Load-bearing._
- **`asOf`** — ISO date of the assumptions, for provenance ("real assumptions as of {date}"). _Load-bearing._
- Demo flow: client calls `capital_market_assumptions` → drops `assetClasses` + `correlations` into a `monte_carlo_decumulation` request with a fake portfolio → renders real-data results.

---

## 4. Shared data model the engine must agree on

**Enums (exact string values):**

- `Currency`: `USD` (display + tax tables; math is currency-agnostic).
- `AccountType`: `taxable | traditional | roth`.
- `FilingStatus`: `single | married_joint | married_separate | head_of_household`.
- `Regime`: `expansion | inflationary | deflationary | stagflation | crisis`.
- `ReturnModel`: `multivariate_normal | student_t | block_bootstrap | markov_regime | emf_regime`.

**Objects:**

- `AssetClass`: `{ id: string, label: string, expectedReturn: number (annualized decimal), volatility: number (annualized stdev decimal), lambda?: number (EMF decay; required for emf_regime) }`.
- `Account`: `{ type: AccountType, balance: number, allocation: Record<assetClassId, weight> }` — **weights must sum to 1 within each account**.
- `GuaranteedIncome`: `{ label: string, annualAmount: number, startAge: number, colaRate: number (decimal) }`.

**Asset ids are user-defined strings** (e.g. `us_equity`). The engine **must not hardcode a fixed asset universe** — it must accept arbitrary ids with the per-asset params supplied. (See §5 for the "real data" mode.)

**Request-shape rules the client already enforces** (engine should also validate and return `400` on violation): allocations sum to 1 per account; asset-class ids unique; account allocations reference only declared asset-class ids; `currentAge < retirementAge ≤ horizonAge` (glide path) and sensible age/range bounds.

---

## 5. Demo capabilities ("everything needed to fully function with all demo capabilities")

1. **Public, unauthenticated, CORS-enabled access** to all six tools from the browser (see §1). This is the single hardest requirement and the one most likely to be missed.
2. **The out-of-box default scenario must produce a good-looking result.** A fresh clone with no `.env` posts exactly the §3.1 payload (the UI's seeded defaults: ages 45/65/95, `married_joint`, spend \$120k @ 2.5% COLA, `us_equity`/`us_bonds` as specified, traditional \$1.2M + roth \$300k, Social Security \$42k @ 67, `emf_regime`, 10k paths). The engine should return a non-degenerate, plausible result for this exact payload.
3. **"Real data, fake clients" mode** — delivered by the **`capital_market_assumptions` tool (§3.6)**, now part of 0.1.0. It returns a real asset universe (`AssetClass[]` with returns/vols/λ) + a correlation matrix + an `asOf` date; the client drops those into a `monte_carlo_decumulation` request with a fake portfolio. This is what lets demos say "these are real return assumptions as of {date}."
4. **Reproducibility for what-ifs.** `seed → seedUsed`, deterministic. Case-study variations re-run with tweaked inputs; each call is stateless (except the optional path cache).
5. **Regime realism.** `emf_regime` MC runs return a populated `regimePathSummary`; `regime_return_generator` returns a live `currentRegime` + `transitionMatrix`. These drive the differentiated visuals.
6. **Preset / library scenarios** _(desirable)_. Server-provided example scenarios (e.g. "accumulator", "near-retiree", "crisis stress") as a tool or static JSON, so demos can showcase variations without hand-building each.
7. **Helpful error bodies.** Because error text renders directly in the UI, return short, human-readable messages (e.g. `"allocation for traditional account sums to 0.95, must sum to 1"`).

---

## 6. Cross-cutting engine behaviors (not separate tools)

1. **`correlation_matrix` must back MC's auto-estimation.** `monte_carlo_decumulation` estimates correlations when the client omits them — so the engine's MC path must internally use the same estimator the `correlation_matrix` tool exposes (consistent numbers whether the client asks for the matrix directly or lets MC estimate).
2. **`pathCacheKey` round-trip.** `regime_return_generator` mints a `pathCacheKey` (§3.5); `monte_carlo_decumulation` accepts it back (§3.1) to reuse cached EMF paths. A stale/unknown key is a cache miss (regenerate), never an error.
3. **CMA ↔ MC drop-in.** `capital_market_assumptions` (§3.6) returns `assetClasses` + `correlations` in exactly the shapes `monte_carlo_decumulation` consumes, so the client can pass them straight through.
4. _(Desirable, not consumed yet)_ Expose `tools/list`, a `GET /health`, and a version-handshake `GET` (§2.3–2.4) for robustness and proactive mismatch warnings.

> **Resolved:** the two former gaps here — `pathCacheKey` on `MonteCarloRequest` and the capital-market-assumptions tool — are folded into contract `0.1.0` (see the scope note at the top and §3.1 / §3.6). They are no longer "future" work.

---

## 7. Explicitly NOT required of the public engine

- **No authentication, no client identity, no PII.** The engine must function on de-identified data and should reject identity-shaped keys.
- **No books-and-records / audit logging.** `x-pw-audit-id` is a no-op header here; real audit logging lives in pw-api + pwos-core (private fork). Accept and ignore it.
- **No `subjectRef` resolution.** `x-pw-subject-ref` is opaque and only meaningful to pw-api. The public engine accepts and ignores it.
- **No `pw-api` path** (`/v1/planning/*`) — that's the private fork's concern; just don't change tool ids.
