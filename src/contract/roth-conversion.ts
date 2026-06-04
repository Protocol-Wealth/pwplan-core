// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * Roth-conversion + IRMAA contract (PlanningContract v1.1.0) — UI-side mirror.
 * ----------------------------------------------------------------------------
 * The composite planning capability: size a Roth conversion for a ~60-something
 * retiree across multiple years when the binding constraint is IRMAA (Medicare
 * surcharges), not the tax bracket.
 *
 * This file MIRRORS the canonical contract, which lives in two coordinated
 * places: the nexus-core JSON-Schema (`engine/planning/planning_contract.schema.json`,
 * the cross-language source of truth) and the published TypeScript package
 * `@protocolwealthos/planning-contract`. pwplan-core keeps a thin local mirror
 * (rather than a runtime dependency) to stay a dependency-light demo shell; if the
 * canonical contract changes, mirror it here and bump
 * PLANNING_CASE_CONTRACT_VERSION. Field names are snake_case to match the wire.
 *
 * INVARIANT — PII-FREE BY CONSTRUCTION. No identity field anywhere: an opaque
 * `case_id` (never identity-derived), birth YEARS not dates of birth, aggregated
 * balances. Enforced by roth-conversion.test.ts.
 *
 * This case contract (1.1.0) is distinct from the per-tool gateway envelope
 * version (PLANNING_CONTRACT_VERSION = 0.1.0 in ./planning.ts) and versions on
 * its own timeline.
 */

export const PLANNING_CASE_CONTRACT_VERSION = "1.1.0" as const;

// --- input: PlanningContract ----------------------------------------------

export type ContractFilingStatus = "single" | "mfj" | "mfs";
export type TargetRule = "fill_to_rate" | "fill_to_irmaa_tier" | "fixed_amount";
export type Purpose = "tax_smoothing" | "irmaa_management" | "legacy";

export interface IncomeExConversion {
  wages?: number;
  pension?: number;
  social_security_gross?: number;
  taxable_interest?: number;
  /** Not federally taxable, but feeds the IRMAA MAGI. */
  tax_exempt_interest?: number;
  ordinary_dividends?: number;
  /** Subset of ordinary_dividends; taxed at LTCG rates. */
  qualified_dividends?: number;
  short_term_gains?: number;
  long_term_gains?: number;
  other_ordinary?: number;
  above_the_line?: number;
  itemized_or_standard?: "standard" | number;
}

export interface AccountBalances {
  trad_ira_aggregate: number;
  nondeductible_basis?: number;
  roth_balance?: number;
  first_roth_year?: number | null;
  /** Cash OUTSIDE the IRA available to pay the conversion tax. */
  taxable_liquidity?: number;
  /** Pre-tax employer-plan (401k/403b) balances (contract v1.1.0). Not directly
   *  convertible (roll to an IRA first), but adds to the future RMD drag. */
  employer_plan_aggregate?: number;
}

export interface ConversionIntent {
  target_rule: TargetRule;
  years: number[];
  target_rate?: number | null;
  fixed_amount?: number | null;
  purpose?: Purpose | null;
}

export interface PlanningContract {
  contract_version?: string;
  /** Opaque; MUST NOT be identity-derived. */
  case_id: string;
  /** First conversion year; must be the earliest in intent.years. */
  tax_year: number;
  filing_status: ContractFilingStatus;
  state_code: string;
  /** Birth YEAR only (never DOB). [self] or [self, spouse]. */
  birth_years: number[];
  medicare_enrolled?: number;
  income_ex_conversion: IncomeExConversion;
  accounts: AccountBalances;
  intent: ConversionIntent;
}

// --- output: RothConversionAnalysis ---------------------------------------

export interface IrmaaHeadroom {
  target_premium_year: number;
  tiers_source_year: number;
  inflation_assumption: number;
  buffer: number;
  per_person: number;
  current_tier_index: number;
  in_top_tier: boolean;
  projected_current_floor: number;
  projected_next_floor: number | null;
  irmaa_safe_headroom: number | null;
  current_annual_surcharge: number;
  cliff_cost_if_crossed: number | null;
}

export interface NiitInteraction {
  threshold: number;
  net_investment_income: number;
  magi_before: number;
  magi_after: number;
  niit_before: number;
  niit_after: number;
  incremental_niit: number;
}

export interface LtcgStacking {
  preferential_income: number;
  ltcg_rate_before: number;
  ltcg_rate_after: number;
  ltcg_tax_before: number;
  ltcg_tax_after: number;
  incremental_ltcg_tax: number;
}

export interface ProRata {
  applies: boolean;
  nondeductible_basis: number;
  trad_ira_aggregate: number;
  basis_fraction: number;
  taxable_fraction: number;
  taxable_portion: number;
  basis_recovered: number;
}

export interface LiquidityGate {
  taxable_liquidity: number;
  total_tax_due: number;
  gated: boolean;
  liquidity_limited_amount: number;
  note: string;
}

export interface StateTax {
  state_code: string;
  modeled: boolean;
  treatment: string;
  rate: number;
  incremental_state_tax: number;
  note: string;
}

export interface ConversionOption {
  key: string;
  label: string;
  amount: number;
  marginal_rate_after: number;
  crosses_irmaa_cliff: boolean;
}

export type BindingConstraint =
  | "bracket"
  | "irmaa"
  | "liquidity"
  | "trad_balance"
  | "fixed_amount"
  | "none";

/** ACA premium-tax-credit erosion from the conversion (contract v1.1.0); null on
 *  `YearAnalysis.aca` unless an ACA situation is injected + someone is under 65 +
 *  marketplace-enrolled. Flag-with-magnitude estimate, not a precise determination. */
export interface AcaInteraction {
  cliff_mode: string;
  magi_pct_fpl_before: number;
  magi_pct_fpl_after: number;
  ptc_before: number;
  ptc_after: number;
  incremental_ptc_loss: number;
  crosses_hard_cliff: boolean;
}

export interface YearAnalysis {
  year: number;
  ages: number[];
  target_premium_year: number;
  magi_ex_conversion: number;
  ordinary_taxable_ex_conversion: number;
  bracket_ceiling: number | null;
  irmaa_ceiling: number | null;
  binding_ceiling: number;
  binding_constraint: BindingConstraint;
  recommended_amount: number;
  incremental_federal_tax: number;
  effective_conversion_rate: number;
  breakeven_retirement_rate: number;
  options: ConversionOption[];
  irmaa: IrmaaHeadroom;
  niit: NiitInteraction;
  ltcg: LtcgStacking;
  pro_rata: ProRata;
  state_tax: StateTax;
  liquidity: LiquidityGate;
  notes: string[];
  /** ACA PTC erosion (contract v1.1.0); null unless an ACA situation is injected. */
  aca?: AcaInteraction | null;
}

export interface DoNothingProjection {
  rmd_start_age: number;
  first_rmd_year: number;
  years_until_rmd: number;
  growth_rate_assumption: number;
  projected_trad_balance_at_rmd: number;
  first_year_rmd: number;
  first_year_rmd_marginal_rate: number;
  note: string;
  /** Pre-tax employer-plan balance folded into the RMD-drag pool (contract v1.1.0). */
  employer_plan_aggregate?: number;
  /** Survivor-year compression (contract v1.1.0): the surviving-spouse single-filing
   *  RMD marginal rate; null when already single/mfs. */
  survivor_first_year_rmd_marginal_rate?: number | null;
}

export interface SequenceSummary {
  years: number[];
  recommended_by_year: number[];
  total_recommended: number;
  total_incremental_tax: number;
  residual_trad_balance: number;
  note: string;
}

export interface SnapshotMetadata {
  engine_version: string;
  contract_version: string;
  bracket_table_year: number;
  bracket_table_source: string;
  irmaa_tiers_source_year: number;
  irmaa_inflation_assumption: number;
  irmaa_buffer: number;
  irmaa_table_source: string;
  state_rule_source: string;
}

export interface RothConversionAnalysis {
  /** Envelope contract version echoed by the gateway (0.1.0). */
  contractVersion?: string;
  /** Case contract version (1.1.0). */
  contract_version: string;
  engine_version: string;
  case_id: string;
  filing_status: string;
  years: YearAnalysis[];
  sequence: SequenceSummary;
  do_nothing: DoNothingProjection;
  snapshot: SnapshotMetadata;
  assumptions: string[];
  disclaimer: string;
}

/** Request body for the `analyze_roth_conversion` gateway tool. */
export interface AnalyzeRothConversionRequest {
  contract: PlanningContract;
  irmaa_inflation?: number;
  irmaa_buffer?: number;
  growth_rate?: number;
}
