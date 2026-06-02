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
});
