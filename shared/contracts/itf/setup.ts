import { z } from "zod";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";
import { Confidence } from "../pmso";
import { EntryBiasEnum } from "../canonical";

export const itfSetupOutputSchema = z.object({
  valid: z.boolean(),
  setup_detected: z.boolean(),
  setup_type: z.enum(["continuation", "pullback", "reversal", "none"]),
  direction: z.enum(["bullish", "bearish", "neutral"]),
  entry_bias: EntryBiasEnum,
  confidence: z.number(),
  invalidation_hint: z.string(),
  references: z.array(z.string()),
  notes: z.string(),
});

export interface ITFSetupInput {
  eurusd: {
    h1: string | null;
    m15: string | null;
    m5: string | null;
  };
  htf: {
    htf_bias: "bullish" | "bearish";
    next_candle_bias: "bullish" | "bearish";
    confidence: Confidence;
    reasoning: string;
    structure_state?: any;
    macro_state?: any;
    liquidity_state?: any;
    pd_array_state?: any;
  };
  itf_structure: {
    structure_trend: "bullish" | "bearish" | "consolidation" | "unknown";
    structure_strength: "weak" | "medium" | "strong";
    smt_signal: "bullish" | "bearish" | "none";
    reasoning: string;
  };
}

export interface ITFSetupOutput extends BaseAgentOutput {
  setup_type: "continuation" | "pullback" | "reversal" | "none";
  entry_bias: "bullish" | "bearish" | "none";
  invalidation_hint: string;
  _debug?: BaseDebugInfo;
}
