import seedrandom from "seedrandom";
import {
  ClientProfileSchema,
  type ClientProfile,
  type FilingStatus,
  type Goal,
} from "./schema.js";
import { PROFILES, type ProfileName, type ProfileSpec } from "./profiles.js";
import { riskScoreToTolerance } from "./planning-input.js";

const STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

const GOAL_TYPES = [
  "retirement",
  "college",
  "home",
  "charitable",
  "other",
] as const;
const GOAL_LABELS: Record<(typeof GOAL_TYPES)[number], string> = {
  retirement: "Retirement income",
  college: "College funding",
  home: "Home purchase",
  charitable: "Charitable giving",
  other: "General savings",
};

const RISK_LEVELS = ["conservative", "moderate", "aggressive"] as const;
const FILING_STATUSES = [
  "single",
  "marriedJoint",
  "marriedSeparate",
  "headOfHousehold",
] as const;
type TaxBracket = "10" | "12" | "22" | "24" | "32" | "35" | "37";

export type GenerateOpts = {
  seed: number | string;
  /** Optional named case-study profile that pins the recognisable drivers. */
  profile?: ProfileName;
};

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

function snap(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/**
 * Approximate marginal bracket for a synthetic profile.
 *
 * The thresholds are single-filer figures; joint and head-of-household filers
 * widen them. Without this a $220k married-joint profile was assigned the 32%
 * bracket on single-filer thresholds, making the exported planning input
 * internally inconsistent with the profile that produced it.
 *
 * This is a plausibility heuristic for SYNTHETIC profile generation, not a tax
 * computation. This repo ships planning demos and states plainly in NOTICE that
 * it is not tax advice; a real bracket needs a tax year, deductions, and
 * jurisdiction, none of which a synthetic generator has.
 */
function bracketFromIncome(
  income: number,
  filingStatus: FilingStatus,
): TaxBracket {
  const widen =
    filingStatus === "marriedJoint"
      ? 2
      : filingStatus === "headOfHousehold"
        ? 1.4
        : 1;
  if (income < 11_000 * widen) return "10";
  if (income < 44_725 * widen) return "12";
  if (income < 95_375 * widen) return "22";
  if (income < 201_050 * widen) return "24";
  if (income < 383_900 * widen) return "32";
  if (income < 578_125 * widen) return "35";
  return "37";
}

/** Split a total across the four investment buckets, honouring an optional
 *  taxable tilt (concentration proxy). Deterministic given `rng`. */
function allocate(
  rng: () => number,
  total: number,
  taxableTilt: number | undefined,
): ClientProfile["investmentAssets"] {
  let wTaxable: number;
  let rest: number;
  if (taxableTilt !== undefined) {
    wTaxable = taxableTilt;
    rest = 1 - taxableTilt;
  } else {
    const w = rng();
    wTaxable = w;
    rest = 1 - w;
  }
  const a = rng();
  const b = rng();
  const c = rng();
  const sum = a + b + c || 1;
  return {
    taxable: snap(wTaxable * total, 100),
    traditional401k: snap(((rest * a) / sum) * total, 100),
    rothIra: snap(((rest * b) / sum) * total, 100),
    otherRetirement: snap(((rest * c) / sum) * total, 100),
  };
}

export function generate(opts: GenerateOpts): ClientProfile {
  const rng = seedrandom(String(opts.seed));
  const spec: ProfileSpec = opts.profile
    ? PROFILES[opts.profile]
    : { label: "" };

  const seedStr = String(opts.seed).padStart(3, "0");
  const id = `demo-${seedStr}`;
  const displayName = spec.label || `Demo Client ${seedStr} — synthetic`;

  const age = spec.age ?? randInt(rng, 25, 72);
  const dependents = spec.dependents ?? (rng() < 0.4 ? 0 : randInt(rng, 1, 4));
  const state = spec.state ?? pick(rng, STATES);

  const annualIncome = snap(
    spec.annualIncome ?? randFloat(rng, 50_000, 450_000),
    1_000,
  );
  const annualSpending = snap(annualIncome * randFloat(rng, 0.55, 0.9), 1_000);
  const liquidAssets = snap(
    randFloat(rng, annualIncome * 0.3, annualIncome * 2.5),
    1_000,
  );

  const totalInvestments =
    spec.targetAssets ??
    snap(randFloat(rng, annualIncome * 0.5, annualIncome * 15), 1_000);
  const investmentAssets = allocate(rng, totalInvestments, spec.taxableTilt);

  const hasRealEstate = rng() > 0.3;
  const realEstateValue = hasRealEstate
    ? snap(randFloat(rng, 200_000, 2_000_000), 10_000)
    : 0;
  const mortgageBalance =
    hasRealEstate && rng() > 0.2
      ? snap(realEstateValue * randFloat(rng, 0.1, 0.7), 10_000)
      : 0;
  const nonMortgageDebt =
    rng() > 0.5 ? snap(randFloat(rng, 1_000, 50_000), 1_000) : 0;

  const goals: Goal[] = spec.goals ?? randomGoals(rng);

  const retirementAge =
    spec.retirementAge ?? randInt(rng, age + 3, Math.min(age + 40, 80));
  const targetRetirementIncome = snap(
    annualIncome * randFloat(rng, 0.5, 0.85),
    1_000,
  );

  const riskScore = spec.riskScore;
  const riskTolerance =
    riskScore != null
      ? riskScoreToTolerance(riskScore)
      : (spec.riskTolerance ?? pick(rng, RISK_LEVELS));
  const timeHorizonYears =
    spec.timeHorizonYears ?? Math.max(1, retirementAge - age);

  const filingStatus = spec.filingStatus ?? pick(rng, FILING_STATUSES);
  const federalMarginalBracket = bracketFromIncome(annualIncome, filingStatus);

  const lifeInsuranceCoverageAmount =
    rng() > 0.4 ? snap(annualIncome * randFloat(rng, 5, 20), 10_000) : 0;
  const hasDisabilityInsurance = rng() > 0.5;
  const hasTrust = spec.hasTrust ?? rng() > 0.7;
  const estateBeneficiariesUpToDate = rng() > 0.4;

  return ClientProfileSchema.parse({
    id,
    displayName,
    age,
    dependents,
    state,
    annualIncome,
    annualSpending,
    liquidAssets,
    investmentAssets,
    realEstateValue,
    mortgageBalance,
    nonMortgageDebt,
    goals,
    retirementAge,
    targetRetirementIncome,
    riskTolerance,
    riskScore,
    timeHorizonYears,
    filingStatus,
    federalMarginalBracket,
    lifeInsuranceCoverageAmount,
    hasDisabilityInsurance,
    hasTrust,
    estateBeneficiariesUpToDate,
  });
}

function randomGoals(rng: () => number): Goal[] {
  const goalCount = randInt(rng, 1, 3);
  const goals: Goal[] = [];
  const usedTypes = new Set<string>();
  for (let i = 0; i < goalCount; i++) {
    let type = pick(rng, GOAL_TYPES);
    let attempts = 0;
    while (usedTypes.has(type) && attempts < 8) {
      type = pick(rng, GOAL_TYPES);
      attempts++;
    }
    usedTypes.add(type);
    goals.push({
      type,
      targetAmount: snap(randFloat(rng, 50_000, 2_000_000), 10_000),
      yearsAway: randInt(rng, 1, 35),
      label: GOAL_LABELS[type],
    });
  }
  return goals;
}
