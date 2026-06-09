import { z } from "zod";
import { Confidence } from "../pmso";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";

export const ltfTriggerOutputSchema = z.object({
  principles: z.array(z.object({ rule: z.string(), chunk_id: z.string() })),
  execute: z.boolean(),
  direction: z.enum(["bullish", "bearish", "neutral"]),
  entry: z.string(),
  entry_price: z.number().nullable().optional(),
  stop_loss: z.number().nullable().optional(),
  take_profit: z.number().nullable().optional(),
  confluence_score: z.number(),
  confidence: z.number(),
  references: z.array(z.string()),
  notes: z.string(),
});

export interface LTFTriggerInput {
  eurusd: {
    m15: string | null;
    m5: string | null;
    m1: string | null;
  };
  htf: {
    htf_bias: "bullish" | "bearish";
    next_candle_bias: "bullish" | "bearish";
    confidence: Confidence;
    reasoning: string;
  };
  itf: {
    structure_trend: "bullish" | "bearish" | "consolidation" | "unknown";
    structure_strength: "weak" | "medium" | "strong";
    smt_signal: "bullish" | "bearish" | "none";
  };
  structure: {
    structure_state: "continuation" | "pullback" | "micro-reversal" | "consolidation" | "unknown";
    structure_strength: "weak" | "medium" | "strong";
  };
  liquidity: {
    sweeps: string[];
    inducement: string[];
  };
  pd_array: {
    zone: "premium" | "discount" | "equilibrium" | "unknown";
    pd_arrays: string[];
  };
}

export interface LTFTriggerOutput extends BaseAgentOutput {
  execute: boolean;
  direction: "bullish" | "bearish" | "neutral";
  entry: string;
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  confluence_score: number;
  _debug?: BaseDebugInfo;
}
