# Changelog

All notable changes to pwplan-core are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); this project adheres to
Semantic Versioning. The planning wire contract is versioned separately as
`PLANNING_CONTRACT_VERSION`.

## [Unreleased]

## [0.1.0] - 2026-05-30

### Added

- Initial open-source scaffold: thin planning UI (React 19, Vite 6, Tailwind v4,
  TypeScript, Zustand).
- Planning wire contract v0.1.0 with five engine tools; PII-free by construction,
  enforced by tests.
- Backend-agnostic planning gateway targeting `nexus-mcp` (open) or `pw-api`
  (private); `ContractMismatchError` on version drift; opaque `subjectRef`
  correlation header.
- Compliance as a fail-closed PII tripwire (`assertNoPII`) plus an audit-log
  hook; pwos-core packages declared as optional peer deps.
- CI with 8 jobs; Apache-2.0 LICENSE and NOTICE (defensive patent posture; OIN
  membership).
- Governance and memory files: CLAUDE.md, CURRENT-STATE.md, ROADMAP.md.
