// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * planning-gateway tests — exercise the full dispatch path over a mocked
 * `fetch`, with no network. This is the integration test the ROADMAP calls for:
 * it covers the PiiTripwireError (fail-closed before dispatch) and
 * ContractMismatchError (version drift) paths, plus header/body/tool-path
 * wiring and the pw-api backend seam.
 *
 * It is deterministic and offline on purpose: a live check against
 * nexusmcp.site lives in scripts/smoke-nexus.mjs (opt-in, never run in CI),
 * because the public engine may be down or mid-build and must not gate this repo.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  planning,
  ContractMismatchError,
  ACTIVE_BACKEND,
} from "./planning-gateway";
import { PiiTripwireError } from "./compliance";
import {
  PLANNING_CONTRACT_VERSION,
  type MonteCarloRequest,
  type SolveGoalRequest,
  type AnalyzeGoalsRequest,
  type ProjectCashFlowRequest,
  type GlidePathRequest,
  type TaxWithdrawalRequest,
  type CorrelationRequest,
  type RegimeReturnRequest,
  type CapitalMarketAssumptionsRequest,
  type CashflowPlanningBridgeRequest,
  type CashReserveAnalysisRequest,
  type BudgetPacingProjectionRequest,
  type RothConversionRequest,
  type SequenceOfReturnsStressRequest,
  type RmdRequest,
  type TaxBracketHeadroomRequest,
  type SocialSecurityClaimingRequest,
  type RegimeConditionedSwrRequest,
  type PortfolioXrayRequest,
  type FireRequest,
  type RiskMetricsRequest,
  type RebalanceRequest,
  type OptimizeAllocationRequest,
  type IrmaaHeadroomRequest,
  type BuildPlanningReportRequest,
} from "../contract/planning";
import type { AnalyzeRothConversionRequest } from "../contract/roth-conversion";

// --- Minimal, well-typed requests (shape only; the engine does the math). ---

const mcReq: Omit<MonteCarloRequest, "contractVersion"> = {
  currentAge: 45,
  retirementAge: 65,
  horizonAge: 95,
  accounts: [],
  assetClasses: [],
  annualSpend: 120_000,
  spendColaRate: 0.02,
  guaranteedIncome: [],
  filingStatus: "single",
  returnModel: "emf_regime",
  paths: 1000,
};

const solveGoalReq: Omit<SolveGoalRequest, "contractVersion"> = {
  ...mcReq,
  solveFor: "annual_spend",
  targetSuccess: 0.8,
  bounds: { min: 60_000, max: 180_000 },
};

const analyzeGoalsReq: Omit<AnalyzeGoalsRequest, "contractVersion"> = {
  goals: [
    {
      id: "education-1",
      kind: "education",
      targetAmount: 200_000,
      yearsToGoal: 10,
      currentAssets: 40_000,
      monthlyContribution: 500,
      priority: 1,
      fundingYears: 4,
    },
  ],
  sharedFundingPool: { currentAssets: 25_000, monthlyContribution: 250 },
};

const projectCashFlowReq: Omit<ProjectCashFlowRequest, "contractVersion"> = {
  currentAge: 45,
  retirementAge: 65,
  terminalAge: 90,
  currentIncome: 180_000,
  currentExpenses: 90_000,
  currentPortfolio: 600_000,
  filingStatus: "married_joint",
  retirementIncome: 45_000,
  currentLiabilities: 250_000,
  baseYear: 2026,
};

const gpReq: Omit<GlidePathRequest, "contractVersion"> = {
  currentAge: 45,
  retirementAge: 65,
  horizonAge: 95,
  startEquityWeight: 0.7,
  endEquityWeight: 0.3,
  shape: "linear",
};

const taxReq: Omit<TaxWithdrawalRequest, "contractVersion"> = {
  year: 2026,
  filingStatus: "single",
  accounts: [],
  grossNeed: 120_000,
  age: 65,
  otherTaxableIncome: 0,
};

const corrReq: Omit<CorrelationRequest, "contractVersion"> = {
  assetClassIds: ["us_equity"],
  lookbackDays: 1260,
  shrinkage: true,
};

const regReq: Omit<RegimeReturnRequest, "contractVersion"> = {
  assetClasses: [],
  horizonYears: 50,
  paths: 1000,
};

const cmaReq: Omit<CapitalMarketAssumptionsRequest, "contractVersion"> = {
  assetClassIds: ["us_equity", "us_bonds"],
};

const cashflowBridgeReq: Omit<
  CashflowPlanningBridgeRequest,
  "contractVersion"
> = {
  monthsAnalyzed: 6,
  averageMonthlySpending: 8_000,
  essentialMonthlySpending: 5_000,
  lifestyleMonthlySpending: 3_000,
  averageMonthlyIncome: 12_000,
  averageMonthlySavings: 4_000,
  currentCashReserve: 25_000,
  targetCashReserveMonths: 6,
  oneTimeExpenseAdjustment: 500,
  spendingVolatility: "high",
};

const cashReserveReq: Omit<CashReserveAnalysisRequest, "contractVersion"> = {
  monthlyEssentialSpending: 5_000,
  monthlyTotalSpending: 8_000,
  currentCashReserve: 35_000,
  targetMonths: 6,
  secondaryTargetMonths: 9,
};

const budgetPacingReq: Omit<BudgetPacingProjectionRequest, "contractVersion"> =
  {
    monthDay: 15,
    daysInMonth: 30,
    monthToDateSpending: 2_500,
    monthlyBudget: 5_000,
    recurringRemaining: 250,
    knownOneTimeRemaining: 125,
  };

const rothReq: Omit<RothConversionRequest, "contractVersion"> = {
  currentTaxableIncome: 150_000,
  filingStatus: "married_joint",
  conversionAmount: 100_000,
  growthRate: 0.06,
  years: 15,
  retirementMarginalRate: 0.24,
};

const sorReq: Omit<SequenceOfReturnsStressRequest, "contractVersion"> = {
  initialBalance: 1_000_000,
  netSpendByYear: [50_000, 50_000],
  annualReturns: [0.07, -0.05],
};

const rmdReq: Omit<RmdRequest, "contractVersion"> = {
  age: 73,
  balance: 500_000,
};

const bracketReq: Omit<TaxBracketHeadroomRequest, "contractVersion"> = {
  taxableIncome: 100_000,
  filingStatus: "single",
  targetRate: 0.24,
};

const ssReq: Omit<SocialSecurityClaimingRequest, "contractVersion"> = {
  piaMonthly: 2_000,
  fraAge: 67,
};

const regimeSwrReq: Omit<RegimeConditionedSwrRequest, "contractVersion"> = {
  baseSwr: 0.04,
  portfolioBalance: 1_000_000,
};

const xrayReq: Omit<PortfolioXrayRequest, "contractVersion"> = {
  assetClasses: [
    {
      id: "us_equity",
      label: "US Equity",
      expectedReturn: 0.07,
      volatility: 0.16,
      lambda: 0.35,
    },
  ],
  accounts: [{ type: "roth", balance: 100_000, allocation: { us_equity: 1 } }],
};

const fireReq: Omit<FireRequest, "contractVersion"> = {
  currentAge: 40,
  retirementAge: 65,
  currentBalance: 400_000,
  annualContribution: 30_000,
  growthRate: 0.05,
  annualSpend: 80_000,
  swr: 0.04,
};

const riskReq: Omit<RiskMetricsRequest, "contractVersion"> = {
  returns: [0.12, -0.08, 0.15, -0.03, 0.06],
  riskFreeRate: 0.02,
  periodsPerYear: 1,
};

const rebalanceReq: Omit<RebalanceRequest, "contractVersion"> = {
  assetClasses: [
    {
      id: "us_equity",
      label: "US Equity",
      expectedReturn: 0.07,
      volatility: 0.16,
    },
    {
      id: "us_bonds",
      label: "US Bonds",
      expectedReturn: 0.03,
      volatility: 0.05,
    },
  ],
  accounts: [
    {
      type: "taxable",
      balance: 100_000,
      allocation: { us_equity: 0.7, us_bonds: 0.3 },
    },
  ],
  targetWeights: { us_equity: 0.6, us_bonds: 0.4 },
};

const optimizeReq: Omit<OptimizeAllocationRequest, "contractVersion"> = {
  riskProfile: "moderate",
  weightBounds: [0, 1],
  returnModel: "house_view",
  regimeAware: true,
  riskFreeRate: 0.02,
};

const irmaaReq: Omit<IrmaaHeadroomRequest, "contractVersion"> = {
  target_premium_year: 2028,
  magi_ex_conversion: 180_000,
  per_person: 2,
  inflation: 0.03,
  buffer: 5_000,
  filing_status: "mfj",
};

const reportReq: Omit<BuildPlanningReportRequest, "contractVersion"> = {
  title: "Planning summary",
  includeRegime: true,
  sections: [
    { kind: "summary", title: "Overview", findings: ["funds the horizon"] },
    { kind: "allocation" },
  ],
};

const rothCaseReq: AnalyzeRothConversionRequest = {
  contract: {
    case_id: "case-123",
    tax_year: 2026,
    filing_status: "mfj",
    state_code: "PA",
    birth_years: [1962, 1963],
    medicare_enrolled: 2,
    income_ex_conversion: { pension: 30_000, social_security_gross: 48_000 },
    accounts: {
      trad_ira_aggregate: 1_400_000,
      taxable_liquidity: 250_000,
    },
    intent: {
      target_rule: "fill_to_rate",
      years: [2026, 2027],
      target_rate: 0.24,
    },
  },
  irmaa_inflation: 0.03,
  irmaa_buffer: 5_000,
  growth_rate: 0.05,
};

/** Stub global fetch with a single canned response and return the spy. */
function stubFetch(
  body: unknown,
  init: { ok?: boolean; status?: number; text?: string } = {},
) {
  const res = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => init.text ?? JSON.stringify(body),
  };
  const fn = vi.fn().mockResolvedValue(res);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("planning gateway dispatch", () => {
  it("posts to the nexus-mcp tool path with contract + audit headers and an injected contract version", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      successProbability: 0.83,
      terminalValues: { p50: 1_000_000 },
      medianBalanceByYear: [1, 2, 3],
      worstPathTerminal: 0,
      seedUsed: 7,
    });

    const result = await planning.monteCarlo(mcReq);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://nexusmcp.site/mcp/tools/monte_carlo_decumulation",
    );
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.headers["x-pw-contract-version"]).toBe(
      PLANNING_CONTRACT_VERSION,
    );
    expect(init.headers["x-pw-audit-id"]).toMatch(
      /^local-monte_carlo_decumulation-/,
    );

    const sent = JSON.parse(init.body);
    expect(sent.contractVersion).toBe(PLANNING_CONTRACT_VERSION);
    expect(sent.currentAge).toBe(45);
    // The optional retirementAge rides through the dispatch path to the wire.
    expect(sent.retirementAge).toBe(65);

    expect(result.successProbability).toBe(0.83);
    expect(result.seedUsed).toBe(7);
  });

  it("omits the subject-ref header by default and includes it when provided", async () => {
    const noRef = stubFetch({ contractVersion: "0.1.0" });
    await planning.glidePath(gpReq);
    expect(noRef.mock.calls[0][1].headers["x-pw-subject-ref"]).toBeUndefined();

    vi.unstubAllGlobals();

    const withRef = stubFetch({ contractVersion: "0.1.0" });
    await planning.glidePath(gpReq, { subjectRef: "opaque-token-123" });
    expect(withRef.mock.calls[0][1].headers["x-pw-subject-ref"]).toBe(
      "opaque-token-123",
    );
  });

  it("throws ContractMismatchError when the engine returns a different version", async () => {
    stubFetch({ contractVersion: "0.2.0", equityWeightByAge: {} });
    await expect(planning.glidePath(gpReq)).rejects.toBeInstanceOf(
      ContractMismatchError,
    );
  });

  it("does not throw when the response omits a contract version", async () => {
    stubFetch({ equityWeightByAge: { "45": 0.7 } });
    await expect(planning.glidePath(gpReq)).resolves.toMatchObject({
      equityWeightByAge: { "45": 0.7 },
    });
  });

  it("throws PiiTripwireError before dispatch when the payload carries identity", async () => {
    const fetchMock = stubFetch({ contractVersion: "0.1.0" });
    // Simulate a caller smuggling an identity-shaped key past the type system.
    const leaky = { ...taxReq, email: "jane@example.com" };
    await expect(planning.taxWithdrawal(leaky)).rejects.toBeInstanceOf(
      PiiTripwireError,
    );
    // Fail-closed: nothing left the client.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws PiiTripwireError before dispatch for cash-flow bridge payloads with identity keys", async () => {
    const leakyBridge = {
      ...cashflowBridgeReq,
      email: "client@example.com",
    };
    const leakyReserve = {
      ...cashReserveReq,
      firstName: "Client",
    };
    const leakyBudget = {
      ...budgetPacingReq,
      dateOfBirth: "1980-01-01",
    };
    const cases: (() => Promise<unknown>)[] = [
      () => planning.cashflowPlanningBridge(leakyBridge),
      () => planning.cashReserveAnalysis(leakyReserve),
      () => planning.budgetPacingProjection(leakyBudget),
    ];

    for (const call of cases) {
      const fetchMock = stubFetch({ contractVersion: "0.1.0" });
      await expect(call()).rejects.toBeInstanceOf(PiiTripwireError);
      expect(fetchMock).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    }
  });

  it("throws PiiTripwireError before dispatch for newly reconciled planning tools", async () => {
    const cases: (() => Promise<unknown>)[] = [
      () =>
        planning.solveGoal({ ...solveGoalReq, email: "client@example.com" }),
      () =>
        planning.analyzeGoals({
          ...analyzeGoalsReq,
          firstName: "Client",
        }),
      () =>
        planning.projectCashFlow({
          ...projectCashFlowReq,
          dateOfBirth: "1980-01-01",
        }),
      () =>
        planning.irmaaHeadroom({
          ...irmaaReq,
          phone: "555-555-5555",
        }),
      () =>
        planning.analyzeRothConversion({
          ...rothCaseReq,
          address: "123 Main St",
        }),
      () =>
        planning.sequenceConversions({
          ...rothCaseReq,
          ssn: "123-45-6789",
        }),
    ];

    for (const call of cases) {
      const fetchMock = stubFetch({ contractVersion: "0.1.0" });
      await expect(call()).rejects.toBeInstanceOf(PiiTripwireError);
      expect(fetchMock).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    }
  });

  it("throws a gateway error carrying the status and body on a non-OK response", async () => {
    stubFetch({}, { ok: false, status: 400, text: "allocation must sum to 1" });
    await expect(planning.monteCarlo(mcReq)).rejects.toThrow(
      /planning gateway 400: allocation must sum to 1/,
    );
  });

  it("maps each tool to its exact contract tool id", async () => {
    const dispatches: { id: string; call: () => Promise<unknown> }[] = [
      {
        id: "monte_carlo_decumulation",
        call: () => planning.monteCarlo(mcReq),
      },
      { id: "solve_goal", call: () => planning.solveGoal(solveGoalReq) },
      {
        id: "analyze_goals",
        call: () => planning.analyzeGoals(analyzeGoalsReq),
      },
      {
        id: "project_cash_flow",
        call: () => planning.projectCashFlow(projectCashFlowReq),
      },
      { id: "glide_path", call: () => planning.glidePath(gpReq) },
      {
        id: "tax_aware_withdrawal",
        call: () => planning.taxWithdrawal(taxReq),
      },
      {
        id: "correlation_matrix",
        call: () => planning.correlationMatrix(corrReq),
      },
      {
        id: "regime_return_generator",
        call: () => planning.regimeReturnGenerator(regReq),
      },
      {
        id: "capital_market_assumptions",
        call: () => planning.capitalMarketAssumptions(cmaReq),
      },
      {
        id: "cashflow_planning_bridge",
        call: () => planning.cashflowPlanningBridge(cashflowBridgeReq),
      },
      {
        id: "cash_reserve_analysis",
        call: () => planning.cashReserveAnalysis(cashReserveReq),
      },
      {
        id: "budget_pacing_projection",
        call: () => planning.budgetPacingProjection(budgetPacingReq),
      },
      {
        id: "roth_conversion",
        call: () => planning.rothConversion(rothReq),
      },
      {
        id: "sequence_of_returns_stress",
        call: () => planning.sequenceOfReturnsStress(sorReq),
      },
      { id: "rmd", call: () => planning.rmd(rmdReq) },
      {
        id: "tax_bracket_headroom",
        call: () => planning.taxBracketHeadroom(bracketReq),
      },
      {
        id: "social_security_claiming",
        call: () => planning.socialSecurityClaiming(ssReq),
      },
      {
        id: "regime_conditioned_swr",
        call: () => planning.regimeConditionedSwr(regimeSwrReq),
      },
      {
        id: "portfolio_xray",
        call: () => planning.portfolioXray(xrayReq),
      },
      { id: "fire", call: () => planning.fire(fireReq) },
      { id: "risk_metrics", call: () => planning.riskMetrics(riskReq) },
      { id: "rebalance", call: () => planning.rebalance(rebalanceReq) },
      {
        id: "optimize_allocation",
        call: () => planning.optimizeAllocation(optimizeReq),
      },
      {
        id: "irmaa_headroom",
        call: () => planning.irmaaHeadroom(irmaaReq),
      },
      {
        id: "analyze_roth_conversion",
        call: () => planning.analyzeRothConversion(rothCaseReq),
      },
      {
        id: "sequence_conversions",
        call: () => planning.sequenceConversions(rothCaseReq),
      },
      {
        id: "build_planning_report",
        call: () => planning.buildPlanningReport(reportReq),
      },
    ];

    for (const { id, call } of dispatches) {
      const fetchMock = stubFetch({ contractVersion: "0.1.0" });
      await call();
      expect(fetchMock.mock.calls[0][0]).toBe(
        `https://nexusmcp.site/mcp/tools/${id}`,
      );
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).contractVersion).toBe(
        PLANNING_CONTRACT_VERSION,
      );
      vi.unstubAllGlobals();
    }
  });

  it("dispatches capital_market_assumptions and returns drop-in assetClasses + correlations", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      assetClasses: [
        {
          id: "us_equity",
          label: "US Equity",
          expectedReturn: 0.068,
          volatility: 0.16,
          lambda: 0.34,
        },
      ],
      correlations: { us_equity: { us_equity: 1 } },
      asOf: "2026-05-29",
    });

    const result = await planning.capitalMarketAssumptions(cmaReq);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://nexusmcp.site/mcp/tools/capital_market_assumptions",
    );
    const sent = JSON.parse(init.body);
    expect(sent.contractVersion).toBe(PLANNING_CONTRACT_VERSION);
    expect(sent.assetClassIds).toEqual(["us_equity", "us_bonds"]);
    // The result is drop-in for a MonteCarloRequest.
    expect(result.assetClasses[0].id).toBe("us_equity");
    expect(result.correlations.us_equity.us_equity).toBe(1);
    expect(result.asOf).toBe("2026-05-29");
  });

  it("dispatches cashflow_planning_bridge with derived monthly-close aggregates", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      monthsAnalyzed: 6,
      annualSpend: 96_000,
      normalizedAnnualSpend: 90_000,
      essentialAnnualSpend: 60_000,
      lifestyleAnnualSpend: 36_000,
      annualIncome: 144_000,
      annualSavings: 48_000,
      savingsRate: 0.3333333333,
      cashReserveTarget: 30_000,
      cashReserveGap: 5_000,
      retirementIncomeFloor: 60_000,
      retirementLifestyleBand: { lower: 30_600, target: 36_000, upper: 41_400 },
      spendingVolatility: "high",
      planningWarnings: ["cash_reserve_underfunded"],
      recommendedNextTools: ["project_cash_flow", "build_planning_report"],
      assumptions: { monthlyCloseBasis: "derived aggregates only" },
    });

    const result = await planning.cashflowPlanningBridge(cashflowBridgeReq);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/cashflow_planning_bridge",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.contractVersion).toBe(PLANNING_CONTRACT_VERSION);
    expect(sent.monthsAnalyzed).toBe(6);
    expect(sent.averageMonthlySpending).toBe(8_000);
    expect(sent.spendingVolatility).toBe("high");
    expect(sent.transactions).toBeUndefined();
    expect(result.normalizedAnnualSpend).toBe(90_000);
    expect(result.retirementLifestyleBand.target).toBe(36_000);
    expect(result.recommendedNextTools).toContain("project_cash_flow");
  });

  it("dispatches cash_reserve_analysis and returns reserve status", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      targetReserve: 30_000,
      secondaryTargetReserve: 45_000,
      currentReserve: 35_000,
      gapToTarget: 0,
      gapToSecondaryTarget: 10_000,
      monthsCoveredEssential: 7,
      monthsCoveredTotal: 4.375,
      status: "on_track",
    });

    const result = await planning.cashReserveAnalysis(cashReserveReq);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/cash_reserve_analysis",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.monthlyEssentialSpending).toBe(5_000);
    expect(sent.secondaryTargetMonths).toBe(9);
    expect(result.status).toBe("on_track");
    expect(result.gapToSecondaryTarget).toBe(10_000);
  });

  it("dispatches budget_pacing_projection and returns pacing warning state", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      projectedMonthEndSpending: 5_375,
      projectedVariance: 375,
      budgetUsedPct: 0.5,
      pacingStatus: "over",
      warningLevel: "warn",
      assumptions: {
        recurringRemainingBasis:
          "Known future recurring spend not yet included",
      },
    });

    const result = await planning.budgetPacingProjection(budgetPacingReq);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/budget_pacing_projection",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.monthDay).toBe(15);
    expect(sent.daysInMonth).toBe(30);
    expect(sent.recurringRemaining).toBe(250);
    expect(sent.knownOneTimeRemaining).toBe(125);
    expect(result.pacingStatus).toBe("over");
    expect(result.warningLevel).toBe("warn");
  });

  it("rides an optional pathCacheKey through the monte_carlo dispatch", async () => {
    const fetchMock = stubFetch({ contractVersion: "0.1.0" });
    await planning.monteCarlo({ ...mcReq, pathCacheKey: "emf-cache-xyz" });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.pathCacheKey).toBe("emf-cache-xyz");
  });

  it("dispatches solve_goal and returns the monotone solution curve", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      solveFor: "annual_spend",
      targetSuccess: 0.8,
      feasible: true,
      solvedValue: 112_000,
      achievedSuccess: 0.81,
      direction: "decreasing",
      bounds: { min: 60_000, max: 180_000 },
      iterations: 12,
      pathsSearch: 800,
      pathsConfirm: 1000,
      seedUsed: 4242421,
      successCurve: [{ x: 112_000, successProbability: 0.81 }],
      terminalValues: { p50: 900_000 },
    });

    const result = await planning.solveGoal(solveGoalReq);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/solve_goal",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.solveFor).toBe("annual_spend");
    expect(sent.targetSuccess).toBe(0.8);
    expect(sent.bounds).toEqual({ min: 60_000, max: 180_000 });
    expect(result.solvedValue).toBe(112_000);
    expect(result.successCurve[0].successProbability).toBe(0.81);
  });

  it("dispatches analyze_goals with opaque goal ids", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      goals: [
        {
          id: "education-1",
          kind: "education",
          priority: 1,
          yearsToGoal: 10,
          fundingYears: 4,
          inflationRate: 0.025,
          expectedReturn: 0.05,
          targetAmountToday: 200_000,
          futureCost: 256_000,
          projectedResources: 180_000,
          projectedFromAssets: 65_000,
          projectedFromContributions: 115_000,
          fundedRatio: 0.7031,
          fundedPct: 70.3,
          status: "underfunded",
          onTrack: false,
          shortfallFuture: 76_000,
          surplusFuture: 0,
          shortfallPresent: 46_000,
          requiredMonthlyContribution: 950,
          currentMonthlyContribution: 500,
          additionalMonthlyNeeded: 450,
        },
      ],
      aggregate: {
        goalCount: 1,
        overallFundedRatio: 0.7031,
        overallFundedPct: 70.3,
        presentValueOfGoals: 157_000,
        presentValueOfResources: 111_000,
        totalShortfallPresent: 46_000,
        fundedCount: 0,
        onTrackCount: 0,
        underfundedCount: 1,
      },
      onTrackThreshold: 0.85,
      priorityAllocation: {
        mode: "priority_ordered_shared_pool",
        sharedPool: {
          currentAssets: 50_000,
          monthlyContribution: 500,
          allocatedCurrentAssets: 50_000,
          unallocatedCurrentAssets: 0,
          allocatedMonthlyContribution: 450,
          unallocatedMonthlyContribution: 50,
        },
        order: [{ id: "education-1", priority: 1, inputOrder: 0 }],
        goals: [
          {
            id: "education-1",
            priority: 1,
            inputOrder: 0,
            allocatedCurrentAssets: 50_000,
            allocatedMonthlyContribution: 450,
            fundedRatioAfterSharedAllocation: 0.85,
            fundedPctAfterSharedAllocation: 85,
            statusAfterSharedAllocation: "on_track",
            shortfallFutureAfterSharedAllocation: 0,
            shortfallPresentAfterSharedAllocation: 0,
            bindingConstraint: {
              code: "none",
              description:
                "The goal is fully funded under the priority allocation.",
            },
          },
        ],
        summary: {
          goalCount: 1,
          fundedCount: 0,
          onTrackCount: 1,
          underfundedCount: 0,
          totalShortfallPresentAfterSharedAllocation: 0,
          bindingConstraints: { none: 1 },
        },
      },
    });

    const result = await planning.analyzeGoals(analyzeGoalsReq);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/analyze_goals",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.goals[0].id).toBe("education-1");
    expect(sent.goals[0].targetAmount).toBe(200_000);
    expect(result.aggregate.goalCount).toBe(1);
    expect(result.priorityAllocation?.order[0].id).toBe("education-1");
    expect(result.priorityAllocation?.sharedPool.allocatedCurrentAssets).toBe(
      50_000,
    );
    expect(result.priorityAllocation?.goals[0].bindingConstraint.code).toBe(
      "none",
    );
    expect(result.priorityAllocation?.summary.bindingConstraints.none).toBe(1);
  });

  it("dispatches project_cash_flow and returns yearly cash-flow rows", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      years: [
        {
          age: 45,
          year: 2026,
          phase: "accumulation",
          earnedIncome: 180_000,
          retirementIncome: 0,
          income: 180_000,
          expenses: 90_000,
          taxes: 25_000,
          netCashFlow: 65_000,
          portfolioBalance: 665_000,
          liabilities: 250_000,
          netWorth: 415_000,
        },
      ],
      aggregate: {
        startingPortfolio: 600_000,
        startingNetWorth: 350_000,
        endingPortfolio: 665_000,
        endingNetWorth: 415_000,
        peakNetWorth: 415_000,
        depletionAge: null,
        fundedThroughTerminal: true,
      },
      lifetimeTax: {
        totalIncome: 180_000,
        totalTaxesPaid: 25_000,
        effectiveRate: 0.1389,
      },
      assumptions: { filingStatus: "married_joint" },
    });

    const result = await planning.projectCashFlow(projectCashFlowReq);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/project_cash_flow",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.currentAge).toBe(45);
    expect(sent.baseYear).toBe(2026);
    expect(result.years[0].phase).toBe("accumulation");
    expect(result.aggregate.startingNetWorth).toBe(350_000);
  });

  it("dispatches roth_conversion and returns the comparison fields", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      conversionTax: 24000,
      effectiveConversionRate: 0.24,
      rothSeed: 100000,
      externalTaxPaidToday: 24000,
      convertedAfterTaxValue: 239655.82,
      notConvertedAfterTaxValue: 182138.42,
      netBenefit: 57517.4,
      breakevenRetirementRate: 0.24,
    });

    const result = await planning.rothConversion(rothReq);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/roth_conversion",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.contractVersion).toBe(PLANNING_CONTRACT_VERSION);
    expect(sent.conversionAmount).toBe(100_000);
    expect(result.netBenefit).toBe(57517.4);
    expect(result.breakevenRetirementRate).toBe(0.24);
  });

  it("dispatches sequence_of_returns_stress and returns the orderings", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      years: 2,
      meanAnnualReturn: 0.01,
      worstFirst: { terminalBalance: 0, depletedYear: 1 },
      bestFirst: { terminalBalance: 12345, depletedYear: null },
      asGiven: { terminalBalance: 9000, depletedYear: null },
      sequenceRiskGap: 12345,
    });

    const result = await planning.sequenceOfReturnsStress(sorReq);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/sequence_of_returns_stress",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.annualReturns).toEqual([0.07, -0.05]);
    expect(result.worstFirst.depletedYear).toBe(1);
    expect(result.bestFirst.depletedYear).toBeNull();
    expect(result.sequenceRiskGap).toBe(12345);
  });

  it("dispatches rmd and returns the distribution fields", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      rmdStartAge: 73,
      applies: true,
      distributionPeriod: 26.5,
      rmdAmount: 18867.92,
      effectiveRate: 0.0377,
    });
    const result = await planning.rmd(rmdReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/rmd",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).age).toBe(73);
    expect(result.rmdAmount).toBe(18867.92);
    expect(result.applies).toBe(true);
  });

  it("dispatches tax_bracket_headroom incl. the optional targetRate", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      taxableIncome: 85000,
      marginalRate: 0.22,
      bracketFloor: 48475,
      bracketCeiling: 103350,
      roomToNextBracket: 18350,
      nextRate: 0.24,
      targetRate: 0.24,
      roomToTargetRate: 112300,
    });
    const result = await planning.taxBracketHeadroom(bracketReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/tax_bracket_headroom",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).targetRate).toBe(0.24);
    expect(result.roomToNextBracket).toBe(18350);
    expect(result.roomToTargetRate).toBe(112300);
  });

  it("dispatches social_security_claiming and returns the claim table", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      fraAge: 67,
      pia: 2000,
      byClaimAge: [
        {
          claimAge: 62,
          monthlyBenefit: 1400,
          annualBenefit: 16800,
          pctOfPia: 0.7,
        },
      ],
      breakevens: [{ earlier: 62, later: 67, breakevenAge: 78.7 }],
    });
    const result = await planning.socialSecurityClaiming(ssReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/social_security_claiming",
    );
    expect(result.byClaimAge[0].monthlyBenefit).toBe(1400);
    expect(result.breakevens[0].breakevenAge).toBe(78.7);
  });

  it("dispatches regime_conditioned_swr and returns the live regime + adjusted rate", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      regime: "crisis",
      baseSwr: 0.04,
      regimeMultiplier: 0.75,
      adjustedSwr: 0.03,
      firstYearWithdrawal: 30000,
    });
    const result = await planning.regimeConditionedSwr(regimeSwrReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/regime_conditioned_swr",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.baseSwr).toBe(0.04);
    expect(result.regime).toBe("crisis");
    expect(result.adjustedSwr).toBe(0.03);
    expect(result.firstYearWithdrawal).toBe(30000);
  });

  it("dispatches correlation_matrix and returns the matrix + asOf", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      matrix: { us_equity: { us_equity: 1, us_bonds: 0.17 } },
      asOf: "2026-05-29",
    });
    const result = await planning.correlationMatrix(corrReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/correlation_matrix",
    );
    expect(result.matrix.us_equity.us_bonds).toBe(0.17);
    expect(result.asOf).toBe("2026-05-29");
  });

  it("dispatches regime_return_generator and returns regime + transition matrix + cache key", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      currentRegime: "crisis",
      transitionMatrix: { crisis: { crisis: 0.5, expansion: 0.5 } },
      pathCacheKey: "emf-v1-777",
    });
    const result = await planning.regimeReturnGenerator(regReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/regime_return_generator",
    );
    expect(result.currentRegime).toBe("crisis");
    expect(result.pathCacheKey).toBe("emf-v1-777");
  });

  it("dispatches portfolio_xray and returns regime + metrics + findings", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      regime: "crisis",
      weightedExpectedReturn: 0.056,
      weightedAvgVolatility: 0.1215,
      portfolioLambda: 0.2625,
      growthAllocation: 0.65,
      concentration: {
        maxWeight: 0.65,
        maxWeightAsset: "us_equity",
        herfindahl: 0.545,
        effectiveHoldings: 1.83,
      },
      accountMix: { taxable: 0, traditional: 0, roth: 1 },
      findings: [
        {
          id: "regime_sensitivity",
          severity: "warn",
          title: "Moderate",
          detail: "λ",
        },
      ],
    });
    const result = await planning.portfolioXray(xrayReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/portfolio_xray",
    );
    expect(result.regime).toBe("crisis");
    expect(result.concentration.maxWeightAsset).toBe("us_equity");
    expect(result.findings[0].severity).toBe("warn");
  });

  it("dispatches fire and returns the FIRE figures", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      fireNumber: 2_000_000,
      coastNumber: 590_576.5,
      coastReached: false,
      projectedBalanceAtRetirement: 2_793_000,
      surplusOrGapAtRetirement: 793_000,
      yearsToFire: 23,
      fireAge: 63,
    });
    const result = await planning.fire(fireReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/fire",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.annualSpend).toBe(80_000);
    expect(sent.swr).toBe(0.04);
    expect(result.fireNumber).toBe(2_000_000);
    expect(result.coastReached).toBe(false);
  });

  it("dispatches risk_metrics and returns the statistics", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      periods: 5,
      annualizedReturn: 0.041,
      annualizedVolatility: 0.103,
      sharpe: 0.2,
      sortino: 0.31,
      maxDrawdown: -0.08,
      valueAtRisk95: 0.07,
      conditionalVaR95: 0.08,
    });
    const result = await planning.riskMetrics(riskReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/risk_metrics",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.returns).toEqual([0.12, -0.08, 0.15, -0.03, 0.06]);
    expect(sent.periodsPerYear).toBe(1);
    expect(result.periods).toBe(5);
    expect(result.maxDrawdown).toBe(-0.08);
  });

  it("dispatches rebalance and returns the drift + trades", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      totalValue: 100_000,
      turnover: 10_000,
      perAsset: [
        {
          id: "us_equity",
          currentWeight: 0.7,
          targetWeight: 0.6,
          drift: 0.1,
          tradeAmount: -10_000,
        },
        {
          id: "us_bonds",
          currentWeight: 0.3,
          targetWeight: 0.4,
          drift: -0.1,
          tradeAmount: 10_000,
        },
      ],
    });
    const result = await planning.rebalance(rebalanceReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/rebalance",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.targetWeights).toEqual({ us_equity: 0.6, us_bonds: 0.4 });
    expect(result.turnover).toBe(10_000);
    expect(result.perAsset[0].tradeAmount).toBe(-10_000);
  });

  it("dispatches optimize_allocation and returns the weights + frontier point", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      weights: { us_equity: 0.6, us_bonds: 0.4 },
      assetClasses: [
        {
          id: "us_equity",
          label: "US Equity",
          expectedReturn: 0.07,
          volatility: 0.16,
          weight: 0.6,
        },
        {
          id: "us_bonds",
          label: "US Bonds",
          expectedReturn: 0.03,
          volatility: 0.05,
          weight: 0.4,
        },
      ],
      objective: "max_sharpe",
      objectiveSource: "regime",
      returnModel: "house_view",
      expectedReturn: 0.054,
      expectedVolatility: 0.102,
      sharpeRatio: 0.33,
      riskFreeRate: 0.02,
      weightBounds: [0, 1],
      regime: "expansion",
      asOf: "2026-06-14",
      riskProfile: "moderate",
      regimeNote: "expansion favors max_sharpe",
    });
    const result = await planning.optimizeAllocation(optimizeReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/optimize_allocation",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.contractVersion).toBe(PLANNING_CONTRACT_VERSION);
    expect(sent.riskProfile).toBe("moderate");
    expect(sent.weightBounds).toEqual([0, 1]);
    expect(sent.regimeAware).toBe(true);
    expect(result.weights.us_equity).toBe(0.6);
    expect(result.objectiveSource).toBe("regime");
    expect(result.sharpeRatio).toBe(0.33);
    expect(result.regimeNote).toBe("expansion favors max_sharpe");
  });

  it("dispatches irmaa_headroom and returns projected cliff room", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      target_premium_year: 2028,
      tiers_source_year: 2025,
      inflation_assumption: 0.03,
      buffer: 5_000,
      per_person: 2,
      current_tier_index: 0,
      in_top_tier: false,
      projected_current_floor: 0,
      projected_next_floor: 220_000,
      irmaa_safe_headroom: 35_000,
      current_annual_surcharge: 0,
      cliff_cost_if_crossed: 2_000,
    });
    const result = await planning.irmaaHeadroom(irmaaReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/irmaa_headroom",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.target_premium_year).toBe(2028);
    expect(sent.filing_status).toBe("mfj");
    expect(result.irmaa_safe_headroom).toBe(35_000);
    expect(result.cliff_cost_if_crossed).toBe(2_000);
  });

  it("dispatches analyze_roth_conversion through the planning registry", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      contract_version: "1.1.0",
      engine_version: "0.1.0",
      case_id: "case-123",
      filing_status: "married_joint",
      years: [],
      sequence: {
        years: [2026, 2027],
        recommended_by_year: [50_000, 45_000],
        total_recommended: 95_000,
        total_incremental_tax: 22_000,
        residual_trad_balance: 1_300_000,
        note: "rollup",
      },
      do_nothing: {
        rmd_start_age: 75,
        first_rmd_year: 2037,
        years_until_rmd: 11,
        growth_rate_assumption: 0.05,
        projected_trad_balance_at_rmd: 2_000_000,
        first_year_rmd: 81_300,
        first_year_rmd_marginal_rate: 0.24,
        note: "do nothing",
      },
      snapshot: {
        engine_version: "0.1.0",
        contract_version: "1.1.0",
        bracket_table_year: 2026,
        bracket_table_source: "engine_reference",
        irmaa_tiers_source_year: 2025,
        irmaa_inflation_assumption: 0.03,
        irmaa_buffer: 5_000,
        irmaa_table_source: "engine_reference",
        state_rule_source: "engine_reference",
      },
      assumptions: [],
      disclaimer: "Educational.",
    });
    const result = await planning.analyzeRothConversion(rothCaseReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/analyze_roth_conversion",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.contract.case_id).toBe("case-123");
    expect(sent.contractVersion).toBe(PLANNING_CONTRACT_VERSION);
    expect(result.case_id).toBe("case-123");
    expect(result.sequence.total_recommended).toBe(95_000);
  });

  it("dispatches sequence_conversions and returns the roll-up only", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      years: [2026, 2027],
      recommended_by_year: [50_000, 45_000],
      total_recommended: 95_000,
      total_incremental_tax: 22_000,
      residual_trad_balance: 1_300_000,
      note: "rollup",
    });
    const result = await planning.sequenceConversions(rothCaseReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/sequence_conversions",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.contract.case_id).toBe("case-123");
    expect(result.total_recommended).toBe(95_000);
    expect(result.recommended_by_year).toEqual([50_000, 45_000]);
  });

  it("dispatches build_planning_report and returns the ordered report", async () => {
    const fetchMock = stubFetch({
      contractVersion: "0.1.0",
      report: {
        title: "Planning summary",
        sections: [
          {
            kind: "summary",
            title: "Overview",
            findings: ["funds the horizon"],
            data: {},
          },
          { kind: "allocation", title: "Allocation", findings: [], data: {} },
        ],
        assumptions: ["EMF regime: expansion"],
        regime: "expansion",
      },
    });
    const result = await planning.buildPlanningReport(reportReq);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/mcp/tools/build_planning_report",
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.contractVersion).toBe(PLANNING_CONTRACT_VERSION);
    expect(sent.sections).toHaveLength(2);
    expect(sent.sections[0].kind).toBe("summary");
    expect(result.report.sections).toHaveLength(2);
    expect(result.report.regime).toBe("expansion");
    expect(result.report.assumptions[0]).toBe("EMF regime: expansion");
  });

  it("defaults the active backend to nexus-mcp", () => {
    expect(ACTIVE_BACKEND).toBe("nexus-mcp");
  });
});

describe("pw-api backend seam", () => {
  it("routes to the /v1/planning path when VITE_PLANNING_BACKEND=pw-api", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_PLANNING_BACKEND", "pw-api");
    const fetchMock = stubFetch({ contractVersion: "0.1.0" });

    const mod = await import("./planning-gateway");
    await mod.planning.glidePath(gpReq);

    expect(mod.ACTIVE_BACKEND).toBe("pw-api");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://nexusmcp.site/v1/planning/glide_path",
    );
  });

  it("fails fast on an unsupported VITE_PLANNING_BACKEND value", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_PLANNING_BACKEND", "nexuz");

    await expect(import("./planning-gateway")).rejects.toThrow(
      /Unsupported VITE_PLANNING_BACKEND/,
    );
  });
});
