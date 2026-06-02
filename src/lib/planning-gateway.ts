// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * planning-gateway — backend-agnostic transport to the planning engine.
 *
 * The SAME thin UI targets two backends, selected by VITE_PLANNING_BACKEND:
 *
 *   "nexus-mcp"  Open reference. Browser → nexus-core MCP-over-HTTP gateway
 *                (nexusmcp.site). No client to protect; you bring your own
 *                de-identified data. This is the path anyone can self-host.
 *
 *   "pw-api"     Protocol Wealth production. Browser → pw-api (authenticated),
 *                which holds client context + the subjectRef→identity mapping
 *                and calls nexus server-to-server. Client requests NEVER hit
 *                the public MCP endpoint.
 *
 * In both cases the payload that crosses the wire is PII-free by construction
 * (see contract/planning.ts). assertNoPII is a fail-closed structural tripwire,
 * not the primary mechanism: if identity data ever appears, the call throws.
 *
 * NOTE: in this OSS repo `auditCall` is a no-op seam (it writes nothing). Real
 * books-and-records audit logging is out of scope here; it lives in the private
 * fork that integrates pwos-core. See src/lib/compliance.ts.
 */

import {
  PLANNING_CONTRACT_VERSION,
  PLANNING_TOOLS,
  type MonteCarloRequest,
  type MonteCarloResult,
  type GlidePathRequest,
  type GlidePathResult,
  type TaxWithdrawalRequest,
  type TaxWithdrawalResult,
  type CorrelationRequest,
  type CorrelationResult,
  type RegimeReturnRequest,
  type RegimeReturnResult,
  type CapitalMarketAssumptionsRequest,
  type CapitalMarketAssumptionsResult,
  type RothConversionRequest,
  type RothConversionResult,
  type SequenceOfReturnsStressRequest,
  type SequenceOfReturnsStressResult,
  type RmdRequest,
  type RmdResult,
  type TaxBracketHeadroomRequest,
  type TaxBracketHeadroomResult,
  type SocialSecurityClaimingRequest,
  type SocialSecurityClaimingResult,
  type RegimeConditionedSwrRequest,
  type RegimeConditionedSwrResult,
  type PlanningToolName,
} from "../contract/planning";
import { assertNoPII, auditCall } from "./compliance";

type Backend = "nexus-mcp" | "pw-api";

const BACKEND = (import.meta.env.VITE_PLANNING_BACKEND ??
  "nexus-mcp") as Backend;
// Defaults to the public nexus-core MCP demo endpoint so a fresh clone runs
// against the real engine (bring de-identified / fake-client data) with no env.
const GATEWAY_URL =
  import.meta.env.VITE_PLANNING_GATEWAY_URL ?? "https://nexusmcp.site";

/** Same tool ids, different backend path conventions. */
function toolPath(tool: PlanningToolName): string {
  switch (BACKEND) {
    case "nexus-mcp":
      return `/mcp/tools/${tool}`;
    case "pw-api":
      return `/v1/planning/${tool}`;
  }
}

/** Optional, pseudonymous correlation token. MUST be opaque and MUST NOT be
 *  derived from client identity. Used by pw-api to tie a run to a client for
 *  books-and-records without exposing identity to the planning layer. */
export interface CallOptions {
  subjectRef?: string;
}

export class ContractMismatchError extends Error {
  constructor(expected: string, got: string) {
    super(
      `planning contract mismatch: client expects ${expected}, engine returned ${got}. ` +
        `Pin versions before retrying (see CONTRIBUTING.md § Cross-repo contract).`,
    );
    this.name = "ContractMismatchError";
  }
}

async function callTool<TReq extends { contractVersion: string }, TRes>(
  tool: PlanningToolName,
  payload: TReq,
  opts: CallOptions = {},
): Promise<TRes> {
  // 1. Fail-closed structural tripwire: the contract is PII-free; prove it
  //    before dispatch.
  const safe = assertNoPII(payload);

  // 2. Audit seam (no-op in OSS; real audit-log lives in the private fork).
  const auditId = await auditCall({
    tool,
    contractVersion: payload.contractVersion,
  });

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-pw-audit-id": auditId,
    "x-pw-contract-version": PLANNING_CONTRACT_VERSION,
  };
  if (opts.subjectRef) headers["x-pw-subject-ref"] = opts.subjectRef;

  const res = await fetch(`${GATEWAY_URL}${toolPath(tool)}`, {
    method: "POST",
    headers,
    body: JSON.stringify(safe),
  });

  if (!res.ok) {
    throw new Error(`planning gateway ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as TRes & { contractVersion?: string };
  if (
    data.contractVersion &&
    data.contractVersion !== PLANNING_CONTRACT_VERSION
  ) {
    throw new ContractMismatchError(
      PLANNING_CONTRACT_VERSION,
      data.contractVersion,
    );
  }
  return data;
}

export const planning = {
  monteCarlo: (
    req: Omit<MonteCarloRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<MonteCarloRequest, MonteCarloResult>(
      PLANNING_TOOLS.monteCarlo,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  glidePath: (
    req: Omit<GlidePathRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<GlidePathRequest, GlidePathResult>(
      PLANNING_TOOLS.glidePath,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  taxWithdrawal: (
    req: Omit<TaxWithdrawalRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<TaxWithdrawalRequest, TaxWithdrawalResult>(
      PLANNING_TOOLS.taxWithdrawal,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  correlationMatrix: (
    req: Omit<CorrelationRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<CorrelationRequest, CorrelationResult>(
      PLANNING_TOOLS.correlationMatrix,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  regimeReturnGenerator: (
    req: Omit<RegimeReturnRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<RegimeReturnRequest, RegimeReturnResult>(
      PLANNING_TOOLS.regimeReturnGenerator,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  capitalMarketAssumptions: (
    req: Omit<CapitalMarketAssumptionsRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<CapitalMarketAssumptionsRequest, CapitalMarketAssumptionsResult>(
      PLANNING_TOOLS.capitalMarketAssumptions,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  rothConversion: (
    req: Omit<RothConversionRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<RothConversionRequest, RothConversionResult>(
      PLANNING_TOOLS.rothConversion,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  sequenceOfReturnsStress: (
    req: Omit<SequenceOfReturnsStressRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<SequenceOfReturnsStressRequest, SequenceOfReturnsStressResult>(
      PLANNING_TOOLS.sequenceOfReturnsStress,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  rmd: (req: Omit<RmdRequest, "contractVersion">, opts?: CallOptions) =>
    callTool<RmdRequest, RmdResult>(
      PLANNING_TOOLS.rmd,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  taxBracketHeadroom: (
    req: Omit<TaxBracketHeadroomRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<TaxBracketHeadroomRequest, TaxBracketHeadroomResult>(
      PLANNING_TOOLS.taxBracketHeadroom,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  socialSecurityClaiming: (
    req: Omit<SocialSecurityClaimingRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<SocialSecurityClaimingRequest, SocialSecurityClaimingResult>(
      PLANNING_TOOLS.socialSecurityClaiming,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  regimeConditionedSwr: (
    req: Omit<RegimeConditionedSwrRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<RegimeConditionedSwrRequest, RegimeConditionedSwrResult>(
      PLANNING_TOOLS.regimeConditionedSwr,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),
};

export const ACTIVE_BACKEND = BACKEND;
