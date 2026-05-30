import { describe, it, expect } from "vitest";
import {
  serializeScenario,
  toScenarioJSON,
  parseScenario,
  parseScenarioJSON,
  SCENARIO_FILE_KIND,
  SCENARIO_FILE_VERSION,
  type ScenarioSnapshot,
} from "./scenario-io";
import { PLANNING_CONTRACT_VERSION } from "../contract/planning";

const snapshot: ScenarioSnapshot = {
  tool: "monte_carlo",
  inputs: {
    currentAge: 45,
    retirementAge: 65,
    horizonAge: 95,
    filingStatus: "married_joint",
    annualSpend: 120_000,
    spendColaRate: 0.025,
    accounts: [
      {
        type: "traditional",
        balance: 1_200_000,
        allocation: { us_equity: 0.6, us_bonds: 0.4 },
      },
    ],
    assetClasses: [
      {
        id: "us_equity",
        label: "US Equity",
        expectedReturn: 0.07,
        volatility: 0.16,
        lambda: 0.35,
      },
      {
        id: "us_bonds",
        label: "US Bonds",
        expectedReturn: 0.03,
        volatility: 0.05,
      },
    ],
    guaranteedIncome: [
      {
        label: "Social Security",
        annualAmount: 42_000,
        startAge: 67,
        colaRate: 0.02,
      },
    ],
    returnModel: "emf_regime",
    paths: 10_000,
  },
  glidePathInputs: {
    currentAge: 45,
    retirementAge: 65,
    horizonAge: 95,
    startEquityWeight: 0.7,
    endEquityWeight: 0.3,
    shape: "linear",
  },
  taxInputs: {
    year: 2026,
    age: 65,
    filingStatus: "married_joint",
    grossNeed: 120_000,
    otherTaxableIncome: 0,
  },
};

describe("serializeScenario", () => {
  it("wraps inputs in a tagged, versioned envelope stamped with the contract version", () => {
    const env = serializeScenario(snapshot);
    expect(env.kind).toBe(SCENARIO_FILE_KIND);
    expect(env.fileVersion).toBe(SCENARIO_FILE_VERSION);
    expect(env.contractVersion).toBe(PLANNING_CONTRACT_VERSION);
    expect(env.tool).toBe("monte_carlo");
  });

  it("throws if the snapshot somehow carries an identity-shaped key", () => {
    const leaky = {
      ...snapshot,
      inputs: {
        ...snapshot.inputs,
        guaranteedIncome: [
          {
            label: "Pension",
            annualAmount: 1,
            startAge: 65,
            colaRate: 0,
            ssn: "000-00-0000",
          },
        ],
      },
    } as unknown as ScenarioSnapshot;
    expect(() => serializeScenario(leaky)).toThrow();
  });
});

describe("round-trip", () => {
  it("parses what it serializes back to an equal snapshot", () => {
    const json = toScenarioJSON(snapshot);
    const result = parseScenarioJSON(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(snapshot);
  });

  it("preserves an optional omitted lambda (does not invent one)", () => {
    const result = parseScenarioJSON(toScenarioJSON(snapshot));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const bonds = result.value.inputs.assetClasses.find(
        (a) => a.id === "us_bonds",
      );
      expect(bonds?.lambda).toBeUndefined();
    }
  });
});

describe("parseScenario rejections", () => {
  it("rejects a non-object", () => {
    expect(parseScenario(42)).toMatchObject({ ok: false });
    expect(parseScenario(null)).toMatchObject({ ok: false });
  });

  it("rejects an unrelated JSON object (wrong kind)", () => {
    expect(parseScenario({ kind: "something-else" })).toMatchObject({
      ok: false,
    });
  });

  it("rejects an unsupported file version", () => {
    const env = serializeScenario(snapshot);
    expect(parseScenario({ ...env, fileVersion: "99" })).toMatchObject({
      ok: false,
    });
  });

  it("rejects an unknown tool", () => {
    const env = serializeScenario(snapshot);
    expect(parseScenario({ ...env, tool: "crystal_ball" })).toMatchObject({
      ok: false,
    });
  });

  it("rejects malformed inputs (missing numeric field)", () => {
    const env = serializeScenario(snapshot);
    const broken = {
      ...env,
      inputs: { ...env.inputs, currentAge: "old" },
    };
    expect(parseScenario(broken)).toMatchObject({ ok: false });
  });

  it("rejects an account with a bad type", () => {
    const env = serializeScenario(snapshot);
    const broken = {
      ...env,
      inputs: {
        ...env.inputs,
        accounts: [{ type: "crypto", balance: 1, allocation: {} }],
      },
    };
    expect(parseScenario(broken)).toMatchObject({ ok: false });
  });

  it("rejects a non-numeric allocation weight", () => {
    const env = serializeScenario(snapshot);
    const broken = {
      ...env,
      inputs: {
        ...env.inputs,
        accounts: [
          { type: "roth", balance: 1, allocation: { us_equity: "lots" } },
        ],
      },
    };
    expect(parseScenario(broken)).toMatchObject({ ok: false });
  });

  it("reports a PII hit as an error result (does not throw) on load", () => {
    const env = serializeScenario(snapshot);
    const leaky = {
      ...env,
      taxInputs: { ...env.taxInputs, email: "jane@example.com" },
    };
    const result = parseScenario(leaky);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/PII tripwire/);
  });

  it("rejects non-JSON text", () => {
    expect(parseScenarioJSON("{not json")).toMatchObject({ ok: false });
  });
});
