import { Confidence } from "../pmso";

export interface TimeOrchestratorOutput {
  trading_window: "active" | "inactive";
  timing_bias: "favorable" | "neutral" | "unfavorable";
  expectation:
    | "Accumulation"
    | "Re-accumulation"
    | "Consolidation"
    | "Manipulation"
    | "Reversal"
    | "Expansion"
    | "Distribution"
    | "Re-distribution"
    | "Retracement"
    | "none";
  confidence: Confidence;
  narrative: string;
  _debug?: any;
}
