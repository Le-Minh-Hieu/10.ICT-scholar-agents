import { z } from "zod";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";
import { Confidence } from "../pmso";

export const itfLiquidityOutputSchema = z.object({
  principles: z.array(z.object({ rule: z.string(), chunk_id: z.string() })),
  sweeps: z.array(z.string()),
  targets: z.array(z.string()),
  inducement: z.array(z.string()),
  confidence: z.number(),
  references: z.array(z.string()),
  notes: z.string(),
});

export interface ITFLiquidityInput {
  eurusd: {
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
  query?: string;
}

export interface ITFLiquidityOutput extends BaseAgentOutput {
  sweeps: string[];
  targets: string[];
  inducement: string[];
  _debug?: BaseDebugInfo;
}
