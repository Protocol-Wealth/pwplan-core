import type { FilingStatus, Goal, RiskTolerance } from "./schema.js";

/**
 * Named case-study profiles (INTERN-EXPLORATION.md §6). Each spec pins the
 * *drivers* that make the profile recognisable; the deterministic seed fills in
 * everything else (see {@link ./generate.ts}). Display names are always
 * obviously synthetic — that's the boundary-discipline invariant.
 *
 * The v0 schema has no asset-class field, so "precious metals" / "crypto"
 * concentration is approximated with `taxableTilt` (the share forced into the
 * taxable bucket, where such holdings would sit). Richer asset-class modelling
 * is a candidate schema extension — discuss before changing the schema
 * (cf. the riskTolerance 1–10 idea on the Ideas wall).
 */
export type ProfileName =
  | "conservativeRetiree"
  | "aggressiveBuilder"
  | "familyOfficeUHNW"
  | "hardAssetHedger"
  | "crowdedDecade"
  | "recentDivorcee"
  | "cryptoConcentrated"
  | "youngDualIncome"
  | "smallBusinessOwner"
  | "windfallInheritor";

export type ProfileSpec = {
  /** Obviously-synthetic display name. */
  label: string;
  age?: number;
  dependents?: number;
  state?: string;
  annualIncome?: number;
  filingStatus?: FilingStatus;
  riskTolerance?: RiskTolerance;
  /** 1–10 numeric risk score. When set, overrides riskTolerance via riskScoreToTolerance(). */
  riskScore?: number;
  /** Target total investable assets (sum across the investmentAssets buckets). */
  targetAssets?: number;
  /** 0..1 share forced into `taxable` — proxy for crypto / hard-asset concentration. */
  taxableTilt?: number;
  retirementAge?: number;
  /** Planning horizon in years (lets already-retired profiles keep it positive). */
  timeHorizonYears?: number;
  hasTrust?: boolean;
  /** Explicit goal set; when omitted, goals are generated from the seed. */
  goals?: Goal[];
};

export const PROFILES: Record<ProfileName, ProfileSpec> = {
  conservativeRetiree: {
    label: "Demo Retiree (Conservative) — synthetic",
    age: 67,
    dependents: 0,
    annualIncome: 90_000,
    filingStatus: "marriedJoint",
    riskTolerance: "conservative",
    riskScore: 2,
    targetAssets: 1_800_000,
    retirementAge: 65,
    timeHorizonYears: 23,
    hasTrust: true,
    goals: [{ type: "retirement", targetAmount: 1_800_000, yearsAway: 0, label: "Retirement income" }],
  },
  aggressiveBuilder: {
    label: "Demo Builder (Aggressive) — synthetic",
    age: 32,
    dependents: 0,
    annualIncome: 145_000,
    filingStatus: "single",
    riskTolerance: "aggressive",
    riskScore: 9,
    targetAssets: 180_000,
    retirementAge: 60,
    hasTrust: false,
    goals: [
      { type: "retirement", targetAmount: 3_000_000, yearsAway: 28, label: "Retirement income" },
      { type: "home", targetAmount: 150_000, yearsAway: 5, label: "Home purchase" },
    ],
  },
  familyOfficeUHNW: {
    label: "Test Family Office (Alpha) — synthetic",
    age: 52,
    dependents: 3,
    annualIncome: 1_200_000,
    filingStatus: "marriedJoint",
    riskTolerance: "moderate",
    riskScore: 6,
    targetAssets: 25_000_000,
    retirementAge: 62,
    hasTrust: true,
    goals: [
      { type: "charitable", targetAmount: 5_000_000, yearsAway: 10, label: "Charitable giving" },
      { type: "retirement", targetAmount: 10_000_000, yearsAway: 10, label: "Retirement income" },
      { type: "college", targetAmount: 900_000, yearsAway: 6, label: "College funding" },
    ],
  },
  hardAssetHedger: {
    label: "Demo Hard-Asset Hedger — synthetic",
    age: 48,
    dependents: 2,
    annualIncome: 220_000,
    filingStatus: "marriedJoint",
    riskTolerance: "moderate",
    riskScore: 5,
    targetAssets: 1_200_000,
    taxableTilt: 0.55,
    retirementAge: 58,
    hasTrust: false,
    goals: [
      { type: "retirement", targetAmount: 2_500_000, yearsAway: 10, label: "Inflation-protected retirement" },
    ],
  },
  crowdedDecade: {
    label: "Demo Crowded-Decade Family — synthetic",
    age: 42,
    dependents: 3,
    annualIncome: 260_000,
    filingStatus: "marriedJoint",
    riskTolerance: "moderate",
    riskScore: 4,
    targetAssets: 850_000,
    retirementAge: 65,
    hasTrust: false,
    goals: [
      { type: "college", targetAmount: 240_000, yearsAway: 8, label: "College funding (child 1)" },
      { type: "college", targetAmount: 240_000, yearsAway: 11, label: "College funding (child 2)" },
      { type: "college", targetAmount: 240_000, yearsAway: 15, label: "College funding (child 3)" },
      { type: "home", targetAmount: 200_000, yearsAway: 4, label: "Home upgrade" },
    ],
  },
  recentDivorcee: {
    label: "Demo Recent-Divorcee — synthetic",
    age: 49,
    dependents: 1,
    annualIncome: 110_000,
    filingStatus: "single",
    riskTolerance: "conservative",
    riskScore: 3,
    targetAssets: 620_000,
    retirementAge: 66,
    hasTrust: false,
    goals: [
      { type: "retirement", targetAmount: 1_400_000, yearsAway: 17, label: "Retirement income (reset)" },
      { type: "other", targetAmount: 60_000, yearsAway: 1, label: "Emergency reserve rebuild" },
    ],
  },
  cryptoConcentrated: {
    label: "Demo Crypto-Concentrated — synthetic",
    age: 35,
    dependents: 0,
    annualIncome: 175_000,
    filingStatus: "single",
    riskTolerance: "aggressive",
    riskScore: 10,
    targetAssets: 900_000,
    taxableTilt: 0.6,
    retirementAge: 55,
    hasTrust: false,
    goals: [
      { type: "other", targetAmount: 500_000, yearsAway: 5, label: "Diversification out of crypto" },
      { type: "retirement", targetAmount: 4_000_000, yearsAway: 20, label: "Retirement income" },
    ],
  },
  youngDualIncome: {
    label: "Demo Young Dual-Income — synthetic",
    age: 31,
    dependents: 1,
    annualIncome: 182_000,
    filingStatus: "marriedJoint",
    riskTolerance: "moderate",
    riskScore: 5,
    targetAssets: 310_000,
    retirementAge: 62,
    hasTrust: false,
    goals: [
      { type: "home", targetAmount: 120_000, yearsAway: 3, label: "Down payment" },
      { type: "college", targetAmount: 200_000, yearsAway: 17, label: "College funding" },
      { type: "retirement", targetAmount: 3_500_000, yearsAway: 31, label: "Retirement income" },
    ],
  },
  smallBusinessOwner: {
    label: "Demo Small-Business Owner — synthetic",
    age: 45,
    dependents: 2,
    annualIncome: 285_000,
    filingStatus: "marriedJoint",
    riskTolerance: "moderate",
    riskScore: 6,
    targetAssets: 1_050_000,
    retirementAge: 60,
    hasTrust: true,
    goals: [
      { type: "retirement", targetAmount: 4_000_000, yearsAway: 15, label: "Business-exit retirement" },
      { type: "other", targetAmount: 150_000, yearsAway: 2, label: "Business succession reserve" },
    ],
  },
  windfallInheritor: {
    label: "Demo Windfall Inheritor — synthetic",
    age: 38,
    dependents: 0,
    annualIncome: 92_000,
    filingStatus: "single",
    riskTolerance: "conservative",
    riskScore: 2,
    targetAssets: 2_400_000,
    retirementAge: 58,
    hasTrust: false,
    goals: [
      { type: "retirement", targetAmount: 3_200_000, yearsAway: 20, label: "Preserve + retire early" },
      { type: "charitable", targetAmount: 500_000, yearsAway: 10, label: "Charitable foundation seed" },
    ],
  },
};

export const PROFILE_NAMES = Object.keys(PROFILES) as ProfileName[];

/** Fixed seeds for the canonical case-study instances (stable across runs). */
export const CASE_SEEDS: Record<ProfileName, number> = {
  conservativeRetiree: 100,
  aggressiveBuilder: 101,
  familyOfficeUHNW: 102,
  hardAssetHedger: 103,
  crowdedDecade: 104,
  recentDivorcee: 105,
  cryptoConcentrated: 106,
  youngDualIncome: 107,
  smallBusinessOwner: 108,
  windfallInheritor: 109,
};
