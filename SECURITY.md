# Security Policy

## Reporting a Vulnerability

**Do not open public GitHub issues for security vulnerabilities.**

Email **security@protocolwealthllc.com** with:

- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Any proof-of-concept code (if applicable)

We will:

1. Acknowledge your report within **48 hours**
2. Confirm the issue and determine severity within **5 business days**
3. Release a patch and public advisory within **30 days** (faster for critical issues)
4. Credit you in the advisory unless you prefer to remain anonymous

## Supported Versions

| Version        | Supported             |
| -------------- | --------------------- |
| main branch    | ✅ Active development |
| latest release | ✅ Security patches   |
| older releases | ❌ Please upgrade     |

## Scope

pwplan-core is a thin planning **UI shell** with a structural PII tripwire; it
ships no quantitative logic and no production compliance stack (those live in
nexus-core and in a private fork that integrates pwos-core). Reports most
relevant to this repo:

**In scope:**

- Bypasses of the structural PII tripwire (`assertNoPII` in `src/lib/compliance.ts`)
  — any path that lets an identity-shaped key reach the planning compute plane
- Leaks of identity into the planning contract (`src/contract/planning.ts`) or
  the gateway dispatch path (`src/lib/planning-gateway.ts`) — the PII-free-by-
  construction invariant is the core security property of this repo
- Contract-version / `ContractMismatchError` validation bypasses
- Cross-site scripting or injection in the React UI
- Supply chain attacks (dependency vulnerabilities)

**Out of scope:**

- Issues in third-party dependencies (report upstream)
- Issues in the nexus-core planning **engine** (report to that repo) — this repo
  is a network client of the engine and ships none of its code
- The production compliance stack (real PII de-identification, books-and-records
  audit logging, pw-api integration) — out of scope here; it lives in a private
  fork
- Social engineering
- Physical security
- DDoS against Protocol Wealth infrastructure

## Bug Bounty

We do not currently operate a paid bug bounty program. We will credit reporters
in security advisories.

## PGP

Public key for sensitive reports available on request.
