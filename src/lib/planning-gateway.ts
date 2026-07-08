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
  type SolveGoalRequest,
  type SolveGoalResult,
  type AnalyzeGoalsRequest,
  type AnalyzeGoalsResult,
  type ProjectCashFlowRequest,
  type ProjectCashFlowResult,
  type GlidePathRequest,
  type GlidePathResult,
  type TaxWithdrawalRequest,
  type TaxWithdrawalResult,
  type CorrelationRequest,
  type CorrelationResult,
  type HistoricalBlendRequest,
  type HistoricalBlendResult,
  type RegimeReturnRequest,
  type RegimeReturnResult,
  type CapitalMarketAssumptionsRequest,
  type CapitalMarketAssumptionsResult,
  type IncomeLayeringRequest,
  type IncomeLayeringResult,
  type CashflowPlanningBridgeRequest,
  type CashflowPlanningBridgeResult,
  type CashReserveAnalysisRequest,
  type CashReserveAnalysisResult,
  type BudgetPacingProjectionRequest,
  type BudgetPacingProjectionResult,
  type EducationFundingRequest,
  type EducationFundingResult,
  type EducationVehicleRule,
  type EducationVehicleRulesRequest,
  type EducationVehicleRulesResult,
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
  type PortfolioXrayRequest,
  type PortfolioXrayResult,
  type FireRequest,
  type FireResult,
  type RiskMetricsRequest,
  type RiskMetricsResult,
  type RiskProfileScoreRequest,
  type RiskProfileScoreResult,
  type PerformanceAnalysisRequest,
  type PerformanceAnalysisResult,
  type InheritedIraAnalysisRequest,
  type InheritedIraAnalysisResult,
  type RebalanceRequest,
  type RebalanceResult,
  type OptimizeAllocationRequest,
  type OptimizeAllocationResult,
  type IrmaaHeadroomRequest,
  type IrmaaHeadroomResult,
  type BuildPlanningReportRequest,
  type BuildPlanningReportResult,
  type PlanningToolName,
} from "../contract/planning";
import type {
  AnalyzeRothConversionRequest,
  RothConversionAnalysis,
  SequenceSummary,
} from "../contract/roth-conversion";
import { assertNoPII, auditCall } from "./compliance";

type Backend = "nexus-mcp" | "pw-api";
type EducationVehicleRulesWireResult = Omit<
  EducationVehicleRulesResult,
  "rules"
> & {
  rules: Array<
    Omit<EducationVehicleRule, "referenceNotes"> & { notes: string[] }
  >;
};

function parseBackend(value: unknown): Backend {
  if (value === undefined || value === "") return "nexus-mcp";
  if (value === "nexus-mcp" || value === "pw-api") return value;
  throw new Error(
    `Unsupported VITE_PLANNING_BACKEND "${String(
      value,
    )}". Expected "nexus-mcp" or "pw-api".`,
  );
}

const BACKEND = parseBackend(import.meta.env.VITE_PLANNING_BACKEND);
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

function isOpaqueSubjectRef(value: string): boolean {
  return /^[A-Za-z0-9._:-]{1,80}$/.test(value);
}

function assertEducationSubjectRefs(
  req: Omit<EducationFundingRequest, "contractVersion">,
): void {
  for (const [index, student] of req.students.entries()) {
    if (!isOpaqueSubjectRef(student.subjectRef)) {
      throw new Error(
        `education_funding students.${index}.subjectRef must be an opaque non-identity token.`,
      );
    }
  }
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

  solveGoal: (
    req: Omit<SolveGoalRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<SolveGoalRequest, SolveGoalResult>(
      PLANNING_TOOLS.solveGoal,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  analyzeGoals: (
    req: Omit<AnalyzeGoalsRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<AnalyzeGoalsRequest, AnalyzeGoalsResult>(
      PLANNING_TOOLS.analyzeGoals,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  projectCashFlow: (
    req: Omit<ProjectCashFlowRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<ProjectCashFlowRequest, ProjectCashFlowResult>(
      PLANNING_TOOLS.projectCashFlow,
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

  historicalBlend: (
    req: Omit<HistoricalBlendRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<HistoricalBlendRequest, HistoricalBlendResult>(
      PLANNING_TOOLS.historicalBlend,
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

  cashflowPlanningBridge: (
    req: Omit<CashflowPlanningBridgeRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<CashflowPlanningBridgeRequest, CashflowPlanningBridgeResult>(
      PLANNING_TOOLS.cashflowPlanningBridge,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  cashReserveAnalysis: (
    req: Omit<CashReserveAnalysisRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<CashReserveAnalysisRequest, CashReserveAnalysisResult>(
      PLANNING_TOOLS.cashReserveAnalysis,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  budgetPacingProjection: (
    req: Omit<BudgetPacingProjectionRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<BudgetPacingProjectionRequest, BudgetPacingProjectionResult>(
      PLANNING_TOOLS.budgetPacingProjection,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  educationFunding: (
    req: Omit<EducationFundingRequest, "contractVersion">,
    opts?: CallOptions,
  ) => {
    assertEducationSubjectRefs(req);
    return callTool<EducationFundingRequest, EducationFundingResult>(
      PLANNING_TOOLS.educationFunding,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    );
  },

  educationVehicleRules: async (
    req: Omit<EducationVehicleRulesRequest, "contractVersion"> = {},
    opts?: CallOptions,
  ): Promise<EducationVehicleRulesResult> => {
    const result = await callTool<
      EducationVehicleRulesRequest,
      EducationVehicleRulesWireResult
    >(
      PLANNING_TOOLS.educationVehicleRules,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    );
    return {
      ...result,
      rules: result.rules.map(({ notes, ...rule }) => ({
        ...rule,
        referenceNotes: notes,
      })),
    };
  },

  incomeLayering: (
    req: Omit<IncomeLayeringRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<IncomeLayeringRequest, IncomeLayeringResult>(
      PLANNING_TOOLS.incomeLayering,
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

  portfolioXray: (
    req: Omit<PortfolioXrayRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<PortfolioXrayRequest, PortfolioXrayResult>(
      PLANNING_TOOLS.portfolioXray,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  fire: (req: Omit<FireRequest, "contractVersion">, opts?: CallOptions) =>
    callTool<FireRequest, FireResult>(
      PLANNING_TOOLS.fire,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  riskMetrics: (
    req: Omit<RiskMetricsRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<RiskMetricsRequest, RiskMetricsResult>(
      PLANNING_TOOLS.riskMetrics,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  riskProfileScore: (
    req: Omit<RiskProfileScoreRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<RiskProfileScoreRequest, RiskProfileScoreResult>(
      PLANNING_TOOLS.riskProfileScore,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  performanceAnalysis: (
    req: Omit<PerformanceAnalysisRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<PerformanceAnalysisRequest, PerformanceAnalysisResult>(
      PLANNING_TOOLS.performanceAnalysis,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  inheritedIraAnalysis: (
    req: Omit<InheritedIraAnalysisRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<InheritedIraAnalysisRequest, InheritedIraAnalysisResult>(
      PLANNING_TOOLS.inheritedIraAnalysis,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  rebalance: (
    req: Omit<RebalanceRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<RebalanceRequest, RebalanceResult>(
      PLANNING_TOOLS.rebalance,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  optimizeAllocation: (
    req: Omit<OptimizeAllocationRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<OptimizeAllocationRequest, OptimizeAllocationResult>(
      PLANNING_TOOLS.optimizeAllocation,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  irmaaHeadroom: (
    req: Omit<IrmaaHeadroomRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<IrmaaHeadroomRequest, IrmaaHeadroomResult>(
      PLANNING_TOOLS.irmaaHeadroom,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  analyzeRothConversion: (
    req: AnalyzeRothConversionRequest,
    opts?: CallOptions,
  ) =>
    callTool<
      AnalyzeRothConversionRequest & { contractVersion: string },
      RothConversionAnalysis
    >(
      PLANNING_TOOLS.analyzeRothConversion,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  sequenceConversions: (
    req: AnalyzeRothConversionRequest,
    opts?: CallOptions,
  ) =>
    callTool<
      AnalyzeRothConversionRequest & { contractVersion: string },
      SequenceSummary & { contractVersion?: string }
    >(
      PLANNING_TOOLS.sequenceConversions,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),

  buildPlanningReport: (
    req: Omit<BuildPlanningReportRequest, "contractVersion">,
    opts?: CallOptions,
  ) =>
    callTool<BuildPlanningReportRequest, BuildPlanningReportResult>(
      PLANNING_TOOLS.buildPlanningReport,
      { ...req, contractVersion: PLANNING_CONTRACT_VERSION },
      opts,
    ),
};

/**
 * Composite Roth-conversion + IRMAA analysis. Uses the same PII-free,
 * envelope-versioned transport as the per-tool calls, but the body carries a
 * PlanningContract under `contract` (the case contract, v1.1.0) rather than a
 * flat per-tool request. The engine fills reference tax/IRMAA tables when none
 * are injected; the result's `snapshot` records which were used.
 */
export async function analyzeRothConversion(
  req: AnalyzeRothConversionRequest,
  opts: CallOptions = {},
): Promise<RothConversionAnalysis> {
  return planning.analyzeRothConversion(req, opts);
}

export const ACTIVE_BACKEND = BACKEND;
