// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

export interface RiskProfileAnswerOption {
  id: string;
  label: string;
  score: number;
}

export interface RiskProfileQuestionOption {
  id: string;
  label: string;
  answers: RiskProfileAnswerOption[];
}

export const RISK_PROFILE_QUESTIONS: RiskProfileQuestionOption[] = [
  {
    id: "time_horizon",
    label: "Investment time horizon",
    answers: [
      { id: "under_3_years", label: "Under 3 years", score: 0 },
      { id: "3_to_7_years", label: "3 to 7 years", score: 1 },
      { id: "7_to_15_years", label: "7 to 15 years", score: 3 },
      { id: "15_plus_years", label: "15+ years", score: 4 },
    ],
  },
  {
    id: "withdrawal_timing",
    label: "Expected withdrawal timing",
    answers: [
      { id: "now", label: "Now", score: 0 },
      { id: "within_3_years", label: "Within 3 years", score: 1 },
      { id: "3_to_7_years", label: "3 to 7 years", score: 2 },
      { id: "7_plus_years", label: "7+ years", score: 4 },
    ],
  },
  {
    id: "drawdown_tolerance",
    label: "Portfolio decline tolerance",
    answers: [
      { id: "sell_at_5", label: "Would sell after a 5% decline", score: 0 },
      {
        id: "uncomfortable_10",
        label: "Uncomfortable around a 10% decline",
        score: 1,
      },
      {
        id: "stay_20",
        label: "Can stay invested through a 20% decline",
        score: 3,
      },
      {
        id: "add_at_30",
        label: "May add capital after a 30% decline",
        score: 4,
      },
    ],
  },
  {
    id: "income_stability",
    label: "Income stability",
    answers: [
      { id: "unstable", label: "Unstable", score: 0 },
      { id: "variable", label: "Variable", score: 1 },
      { id: "stable", label: "Stable", score: 3 },
      { id: "very_stable", label: "Very stable", score: 4 },
    ],
  },
  {
    id: "liquidity_need",
    label: "Need for near-term liquidity",
    answers: [
      { id: "high", label: "High", score: 0 },
      { id: "moderate", label: "Moderate", score: 1 },
      { id: "low", label: "Low", score: 3 },
      { id: "very_low", label: "Very low", score: 4 },
    ],
  },
  {
    id: "investing_experience",
    label: "Investing experience",
    answers: [
      { id: "none", label: "None", score: 0 },
      { id: "basic", label: "Basic", score: 1 },
      {
        id: "diversified",
        label: "Diversified portfolio experience",
        score: 2,
      },
      {
        id: "advanced",
        label: "Advanced / complex investment experience",
        score: 4,
      },
    ],
  },
  {
    id: "inflation_priority",
    label: "Inflation vs. principal tradeoff",
    answers: [
      {
        id: "preserve_principal",
        label: "Prioritize principal stability",
        score: 0,
      },
      { id: "balanced", label: "Balance stability and growth", score: 2 },
      { id: "growth", label: "Prioritize long-term growth", score: 3 },
      {
        id: "high_growth",
        label: "Strongly prioritize long-term growth",
        score: 4,
      },
    ],
  },
  {
    id: "risk_capacity",
    label: "Financial capacity for risk",
    answers: [
      { id: "limited", label: "Limited", score: 0 },
      { id: "below_average", label: "Below average", score: 1 },
      { id: "average", label: "Average", score: 2 },
      { id: "above_average", label: "Above average", score: 3 },
      { id: "high", label: "High", score: 4 },
    ],
  },
  {
    id: "reaction_to_volatility",
    label: "Likely reaction to volatility",
    answers: [
      { id: "sell", label: "Sell risk assets", score: 0 },
      { id: "reduce", label: "Reduce risk", score: 1 },
      { id: "rebalance", label: "Rebalance to target", score: 3 },
      { id: "buy", label: "Buy at lower prices", score: 4 },
    ],
  },
  {
    id: "goal_flexibility",
    label: "Goal flexibility",
    answers: [
      { id: "inflexible", label: "No flexibility", score: 0 },
      { id: "modest", label: "Modest flexibility", score: 1 },
      { id: "flexible", label: "Flexible timing or amount", score: 3 },
      {
        id: "very_flexible",
        label: "Very flexible timing and amount",
        score: 4,
      },
    ],
  },
];

export const RISK_PROFILE_QUESTION_IDS = RISK_PROFILE_QUESTIONS.map(
  (question) => question.id,
);

export const DEFAULT_RISK_PROFILE_ANSWERS: Record<string, string> = {
  time_horizon: "7_to_15_years",
  withdrawal_timing: "3_to_7_years",
  drawdown_tolerance: "stay_20",
  income_stability: "stable",
  liquidity_need: "moderate",
  investing_experience: "diversified",
  inflation_priority: "balanced",
  risk_capacity: "average",
  reaction_to_volatility: "rebalance",
  goal_flexibility: "modest",
};

export function answerIdsForQuestion(questionId: string): string[] {
  return (
    RISK_PROFILE_QUESTIONS.find((question) => question.id === questionId)
      ?.answers ?? []
  ).map((answer) => answer.id);
}
