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
} from "../contract/planning";

// --- Minimal, well-typed requests (shape only; the engine does the math). ---

const mcReq: Omit<MonteCarloRequest, "contractVersion"> = {
  currentAge: 45,
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
