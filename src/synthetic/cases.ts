import { generate } from "./generate.js";
import { CASE_SEEDS, PROFILE_NAMES, type ProfileName } from "./profiles.js";
import type { ClientProfile } from "./schema.js";

/**
 * The canonical case-study clients — deterministic instances of each named
 * profile at its fixed seed. These are the demos shown at the July 15
 * checkpoint and rendered in apps/web.
 */
export const caseStudies = Object.fromEntries(
  PROFILE_NAMES.map((name) => [
    name,
    generate({ seed: CASE_SEEDS[name], profile: name }),
  ]),
) as Record<ProfileName, ClientProfile>;

export const conservativeRetiree = caseStudies.conservativeRetiree;
export const aggressiveBuilder = caseStudies.aggressiveBuilder;
export const familyOfficeUHNW = caseStudies.familyOfficeUHNW;
export const hardAssetHedger = caseStudies.hardAssetHedger;
export const crowdedDecade = caseStudies.crowdedDecade;
export const recentDivorcee = caseStudies.recentDivorcee;
export const cryptoConcentrated = caseStudies.cryptoConcentrated;
export const youngDualIncome = caseStudies.youngDualIncome;
export const smallBusinessOwner = caseStudies.smallBusinessOwner;
export const windfallInheritor = caseStudies.windfallInheritor;
