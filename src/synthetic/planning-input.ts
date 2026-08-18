import { z } from "zod";
import {
  GoalSchema,
  type ClientProfile,
  type RiskTolerance,
} from "./schema.js";

/**
 * PII-FREE BY CONSTRUCTION.
 *
 * The planning contract carries only de-identified planning *variables* — never a name, displayName,
 * id-as-name, DOB, SSN, email, address, or phone. `planning-input.test.ts`
 * fails the build if a forbidden field is ever added here. That single
 * invariant is what makes it safe to send this payload to the public nexus-core
 * gateway (nexusmcp.site).
 *
 * `state` (a 2-letter code) is a tax driver, not an address — it stays.
 */
export const PlanningInputSchema = z.object({
  age: z.number().int().min(18).max(100),
  dependents: z.number().int().min(0),
  state: z.string().length(2),
  annualIncome: z.number().nonnegative(),
  annualSpending: z.number().nonnegative(),
  liquidAssets: z.number().nonnegative(),
  investmentAssets: z.object({
    taxable: z.number().nonnegative(),
    traditional401k: z.number().nonnegative(),
    rothIra: z.number().nonnegative(),
    otherRetirement: z.number().nonnegative(),
  }),
  realEstateValue: z.number().nonnegative(),
  mortgageBalance: z.number().nonnegative(),
  nonMortgageDebt: z.number().nonnegative(),
  goals: z.array(GoalSchema),
  retirementAge: z.number().int().positive(),
  targetRetirementIncome: z.number().nonnegative(),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
  timeHorizonYears: z.number().int().positive(),
  filingStatus: z.enum([
    "single",
    "marriedJoint",
    "marriedSeparate",
    "headOfHousehold",
  ]),
  federalMarginalBracket: z.enum(["10", "12", "22", "24", "32", "35", "37"]),
  lifeInsuranceCoverageAmount: z.number().nonnegative(),
  hasDisabilityInsurance: z.boolean(),
  hasTrust: z.boolean(),
  estateBeneficiariesUpToDate: z.boolean(),
});

export type PlanningInput = z.infer<typeof PlanningInputSchema>;

/**
 * Strip identity from a synthetic ClientProfile, yielding a PII-free
 * PlanningInput. `id` and `displayName` are dropped explicitly; the result is
 * validated against the contract (which has no slot for them anyway).
 */
export function toPlanningInput(profile: ClientProfile): PlanningInput {
  const { id: _id, displayName: _displayName, ...rest } = profile;
  return PlanningInputSchema.parse(rest);
}

/**
 * Map a 1–10 numeric risk score to the conservative/moderate/aggressive enum.
 * Thresholds: 1–3 → conservative, 4–7 → moderate, 8–10 → aggressive.
 * This is the only place the mapping lives — generate.ts and tests import it.
 */
export function riskScoreToTolerance(score: number): RiskTolerance {
  if (score <= 3) return "conservative";
  if (score <= 7) return "moderate";
  return "aggressive";
}

const START_EQUITY: Record<PlanningInput["riskTolerance"], number> = {
  conservative: 0.5,
  moderate: 0.7,
  aggressive: 0.9,
};

/**
 * Map de-identified planning input → the nexus `glide_path` tool payload
 * (contract 0.1.0 — camelCase params). A worked example of the gateway shape;
 * other tools follow the same de-identified-payload pattern.
 */
export function toGlidePathParams(input: PlanningInput): {
  currentAge: number;
  retirementAge: number;
  horizonAge: number;
  startEquityWeight: number;
  endEquityWeight: number;
  shape: string;
} {
  const startEquityWeight = START_EQUITY[input.riskTolerance];
  const currentAge = input.age;
  // glide_path enforces currentAge <= retirementAge < horizonAge. The schema puts
  // no upper bound on retirementAge, so a valid profile can retire at 95 — and a
  // horizon derived only from currentAge (max(90, age+1) = 90) would then sit
  // BELOW it and the payload would be rejected. Derive the horizon from the
  // clamped retirement age so the ordering holds for every schema-valid input.
  const retirementAge = Math.max(input.retirementAge, currentAge);
  return {
    currentAge,
    retirementAge,
    horizonAge: Math.max(90, retirementAge + 1),
    startEquityWeight,
    endEquityWeight: Math.max(0.2, startEquityWeight - 0.4),
    shape: "linear",
  };
}
