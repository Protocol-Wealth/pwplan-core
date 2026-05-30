import { describe, it, expect } from "vitest";
import {
  assertNoPII,
  findIdentityKey,
  auditCall,
  PiiTripwireError,
} from "./compliance";

// A representative, PII-free planning payload (shape mirrors the contract).
const cleanPayload = {
  contractVersion: "0.1.0",
  currentAge: 45,
  horizonAge: 95,
  accounts: [
    { type: "traditional", balance: 1_000_000, allocation: { us_equity: 0.6 } },
  ],
  assetClasses: [{ id: "us_equity", label: "US Equity", expectedReturn: 0.07 }],
  guaranteedIncome: [{ label: "Social Security", annualAmount: 42_000 }],
};

describe("assertNoPII", () => {
  it("returns a clean payload unchanged", () => {
    expect(assertNoPII(cleanPayload)).toBe(cleanPayload);
  });

  it("does not flag legitimate contract keys (label, id, type)", () => {
    expect(findIdentityKey(cleanPayload)).toBeNull();
  });

  it("throws on a top-level identity key", () => {
    expect(() => assertNoPII({ ...cleanPayload, email: "a@b.co" })).toThrow(
      PiiTripwireError,
    );
  });

  it("throws on a nested identity key and reports its path", () => {
    const leaky = {
      ...cleanPayload,
      accounts: [{ type: "roth", owner: { firstName: "Jane" } }],
    };
    expect(() => assertNoPII(leaky)).toThrow(PiiTripwireError);
    expect(findIdentityKey(leaky)).toBe("accounts.0.owner.firstName");
  });

  it("matches case- and separator-insensitively", () => {
    expect(findIdentityKey({ Date_Of_Birth: "1980-01-01" })).toBe(
      "Date_Of_Birth",
    );
    expect(findIdentityKey({ SSN: "000-00-0000" })).toBe("SSN");
    expect(findIdentityKey({ "street-address": "1 Main St" })).toBe(
      "street-address",
    );
  });

  it("catches identity keys inside arrays", () => {
    expect(findIdentityKey([{ ok: 1 }, { phone: "555" }])).toBe("1.phone");
  });

  it("ignores null/primitive payloads", () => {
    expect(findIdentityKey(null)).toBeNull();
    expect(findIdentityKey(42)).toBeNull();
    expect(findIdentityKey("name")).toBeNull(); // a string value, not a key
  });
});

describe("auditCall", () => {
  it("returns a local, tool-tagged id (no-op seam)", async () => {
    const id = await auditCall({
      tool: "monte_carlo",
      contractVersion: "0.1.0",
    });
    expect(id).toMatch(/^local-monte_carlo-/);
  });

  it("returns a distinct id per call", async () => {
    const a = await auditCall({ tool: "t", contractVersion: "0.1.0" });
    const b = await auditCall({ tool: "t", contractVersion: "0.1.0" });
    expect(a).not.toBe(b);
  });
});
