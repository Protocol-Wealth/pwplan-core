import { z } from "zod";

export const GoalSchema = z.object({
  type: z.enum(["retirement", "college", "home", "charitable", "other"]),
  targetAmount: z.number().nonnegative(),
  yearsAway: z.number().int().nonnegative(),
  label: z.string(),
});

export type Goal = z.infer<typeof GoalSchema>;

export const ClientProfileSchema = z.object({
  // Demographics
  id: z.string(),
  displayName: z.string(),
  age: z.number().int().min(18).max(100),
  dependents: z.number().int().min(0).default(0),
  state: z.string().length(2),

  // Financial situation
  annualIncome: z.number().nonnegative(),
  annualSpending: z.number().nonnegative(),
  liquidAssets: z.number().nonnegative(),
  investmentAssets: z.object({
    taxable: z.number().nonnegative(),
    traditional401k: z.number().nonnegative(),
    rothIra: z.number().nonnegative(),
    otherRetirement: z.number().nonnegative(),
  }),
  realEstateValue: z.number().nonnegative().default(0),
  mortgageBalance: z.number().nonnegative().default(0),
  nonMortgageDebt: z.number().nonnegative().default(0),

  // Goals
  goals: z.array(GoalSchema),
  retirementAge: z.number().int().positive(),
  targetRetirementIncome: z.number().nonnegative(),

  // Risk + horizon
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
  riskScore: z.number().int().min(1).max(10).optional(),
  timeHorizonYears: z.number().int().positive(),

  // Tax
  filingStatus: z.enum([
    "single",
    "marriedJoint",
    "marriedSeparate",
    "headOfHousehold",
  ]),
  federalMarginalBracket: z.enum(["10", "12", "22", "24", "32", "35", "37"]),

  // Insurance + estate
  lifeInsuranceCoverageAmount: z.number().nonnegative().default(0),
  hasDisabilityInsurance: z.boolean(),
  hasTrust: z.boolean(),
  estateBeneficiariesUpToDate: z.boolean(),
});

export type ClientProfile = z.infer<typeof ClientProfileSchema>;

// Convenience aliases for the closed sets, reused by profiles + planning input.
export type RiskTolerance = ClientProfile["riskTolerance"];
export type FilingStatus = ClientProfile["filingStatus"];
export type FederalMarginalBracket = ClientProfile["federalMarginalBracket"];
export type GoalType = Goal["type"];
