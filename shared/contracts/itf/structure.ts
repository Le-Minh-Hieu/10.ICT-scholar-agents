import { z } from "zod";
import { Confidence } from "../pmso";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";

export const itfStructureOutputSchema = z.object({
  principles: z.array(z.object({ rule: z.string(), chunk_id: z.string() })),
  structure_trend: z.enum(["bullish", "bearish", "consolidation", "unknown"]),
  smt_signal: z.enum(["bullish", "bearish", "none"]),
  structure_strength: z.enum(["weak", "medium", "strong"]),
  references: z.array(z.string()),
  confidence: z.number(),
  notes: z.string(),
});

export interface ITFStructureInput {
  eurusd: {
    h4: string | null;
    h1: string | null;
    m15: string | null;
  };
  gbpusd?: {
    h4: string | null;
    h1: string | null;
    m15: string | null;
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
}

export interface ITFStructureOutput extends BaseAgentOutput {
  structure_trend: "bullish" | "bearish" | "consolidation" | "unknown";
  smt_signal: "bullish" | "bearish" | "none";
  structure_strength: "weak" | "medium" | "strong";
  _debug?: BaseDebugInfo;
}
