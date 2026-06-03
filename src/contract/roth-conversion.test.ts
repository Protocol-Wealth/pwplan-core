// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PLANNING_CASE_CONTRACT_VERSION } from "./roth-conversion";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractSrc = readFileSync(join(__dirname, "roth-conversion.ts"), "utf8");

describe("roth-conversion case contract", () => {
  it("exposes a semver case-contract version (1.0.0)", () => {
    expect(PLANNING_CASE_CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(PLANNING_CASE_CONTRACT_VERSION).toBe("1.0.0");
  });
});

describe("PII-free invariant", () => {
  const FORBIDDEN = [
    "name",
    "firstName",
    "lastName",
    "dob",
    "dateOfBirth",
    "ssn",
    "email",
    "phone",
    "address",
    "streetAddress",
    "accountNumber",
  ];

  for (const word of FORBIDDEN) {
    it(`contract declares no '${word}' field`, () => {
      // Property declarations are indented and begin the line; comment lines
      // begin with `*` or `/` after whitespace, so they are not matched.
      const re = new RegExp(`^[ \\t]+${word}\\??:`, "mi");
      expect(re.test(contractSrc)).toBe(false);
    });
  }
});
