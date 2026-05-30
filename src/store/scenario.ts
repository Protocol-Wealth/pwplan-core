/**
 * scenario store — client-side plan state. Holds inputs and the latest engine
 * result. No PII leaves this store without passing through compliance.
 */

import { create } from "zustand";
import type {
  Account,
  AssetClass,
  FilingStatus,
  GuaranteedIncome,
  MonteCarloResult,
  ReturnModel,
} from "../contract/planning";

export interface ScenarioInputs {
  currentAge: number;
  retirementAge: number;
  horizonAge: number;
  filingStatus: FilingStatus;
  annualSpend: number;
  spendColaRate: number;
  accounts: Account[];
  assetClasses: AssetClass[];
  guaranteedIncome: GuaranteedIncome[];
  returnModel: ReturnModel;
  paths: number;
}

interface ScenarioState {
  inputs: ScenarioInputs;
  result: MonteCarloResult | null;
  running: boolean;
  error: string | null;
  setInputs: (patch: Partial<ScenarioInputs>) => void;
  setResult: (r: MonteCarloResult | null) => void;
  setRunning: (b: boolean) => void;
  setError: (e: string | null) => void;
}

const DEFAULT_INPUTS: ScenarioInputs = {
  currentAge: 45,
  retirementAge: 65,
  horizonAge: 95,
  filingStatus: "married_joint",
  annualSpend: 120_000,
  spendColaRate: 0.025,
  // Seeded with a valid, balanced scenario so the expanded form is usable out
  // of the box and the allocation invariant (weights sum to 1) holds initially.
  assetClasses: [
    {
      id: "us_equity",
      label: "US Equity",
      expectedReturn: 0.07,
      volatility: 0.16,
      lambda: 0.35,
    },
    {
      id: "us_bonds",
      label: "US Bonds",
      expectedReturn: 0.03,
      volatility: 0.05,
      lambda: 0.1,
    },
  ],
  accounts: [
    {
      type: "traditional",
      balance: 1_200_000,
      allocation: { us_equity: 0.6, us_bonds: 0.4 },
    },
    {
      type: "roth",
      balance: 300_000,
      allocation: { us_equity: 0.8, us_bonds: 0.2 },
    },
  ],
  guaranteedIncome: [
    {
      label: "Social Security",
      annualAmount: 42_000,
      startAge: 67,
      colaRate: 0.02,
    },
  ],
  returnModel: "emf_regime",
  paths: 10_000,
};

export const useScenario = create<ScenarioState>((set) => ({
  inputs: DEFAULT_INPUTS,
  result: null,
  running: false,
  error: null,
  setInputs: (patch) => set((s) => ({ inputs: { ...s.inputs, ...patch } })),
  setResult: (result) => set({ result }),
  setRunning: (running) => set({ running }),
  setError: (error) => set({ error }),
}));
