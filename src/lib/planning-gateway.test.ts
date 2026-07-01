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
  type GlidePathRequest,
  type TaxWithdrawalRequest,
  type CorrelationRequest,
  type RegimeReturnRequest,
  type CapitalMarketAssumptionsRequest,
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
  type BuildPlanningReportRequest,
} from "../contract/planning";

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

const reportReq: Omit<BuildPlanningReportRequest, "contractVersion"> = {
  title: "Planning summary",
  includeRegime: true,
  sections: [
    { kind: "summary", title: "Overview", findings: ["funds the horizon"] },
    { kind: "allocation" },
  ],
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

  it("rides an optional pathCacheKey through the monte_carlo dispatch", async () => {
    const fetchMock = stubFetch({ contractVersion: "0.1.0" });
    await planning.monteCarlo({ ...mcReq, pathCacheKey: "emf-cache-xyz" });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.pathCacheKey).toBe("emf-cache-xyz");
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
