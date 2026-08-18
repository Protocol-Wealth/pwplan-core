export { generate, type GenerateOpts } from "./generate.js";
export {
  ClientProfileSchema,
  GoalSchema,
  type ClientProfile,
  type FilingStatus,
  type Goal,
  type GoalType,
  type RiskTolerance,
} from "./schema.js";
export {
  PlanningInputSchema,
  riskScoreToTolerance,
  toGlidePathParams,
  toPlanningInput,
  type PlanningInput,
} from "./planning-input.js";
export {
  CASE_SEEDS,
  PROFILE_NAMES,
  PROFILES,
  type ProfileName,
  type ProfileSpec,
} from "./profiles.js";
export {
  aggressiveBuilder,
  caseStudies,
  conservativeRetiree,
  crowdedDecade,
  cryptoConcentrated,
  familyOfficeUHNW,
  hardAssetHedger,
  recentDivorcee,
  youngDualIncome,
  smallBusinessOwner,
  windfallInheritor,
} from "./cases.js";
