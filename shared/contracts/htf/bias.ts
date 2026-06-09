import { BaseAgentOutput } from "../common/base-agent";
import { Confidence } from "../pmso";

export interface HTFBiasInput {
  macro: {
    macro_impact: "high" | "medium" | "low" | "none";
    macro_direction: "bullish" | "bearish" | "neutral";
    macro_alignment: boolean;
    notes: string;
  };
  structure: {
    structure_trend: "bullish" | "bearish" | "consolidation" | "unknown";
    smt_signal: "bullish" | "bearish" | "none";
    structure_strength: "weak" | "medium" | "strong";
    notes: string;
  };
  liquidity: {
    liquidity: {
      above: boolean;
      below: boolean;
    };
    notes: string;
  };
  pd_array: {
    pd_array_status: "premium" | "discount" | "equilibrium" | "unknown";
    equilibrium: number;
    range_high: number;
    range_low: number;
    notes: string;
  };
}

export interface HTFBiasOutput extends BaseAgentOutput {
  htf_bias: "bullish" | "bearish" | "neutral";
  short_term_expectation: "bullish" | "bearish" | "neutral";
  state: "trending" | "pullback" | "consolidation";
  tradable: boolean;
  confidence: Confidence;
  conflict?: {
    structure: string;
    macro: string;
    resolution: string;
  };
}
