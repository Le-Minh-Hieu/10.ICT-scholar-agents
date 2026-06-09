import { z } from "zod";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";
import { Confidence } from "../pmso";

export const ltfLiquidityOutputSchema = z.object({
  principles: z.array(z.object({ rule: z.string(), chunk_id: z.string() })),
  sweeps: z.array(z.string()),
  inducement: z.array(z.string()),
  confidence: z.number(),
  references: z.array(z.string()),
  notes: z.string(),
});

export interface LTFLiquidityInput {
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
    dominant_factors?: string[];
  };
  itf: {
    itf_bias: "bullish" | "bearish";
    entry_bias: string;
    setup_type: string;

    confidence: Confidence;

    dominant_factors?: string[];
    reasoning: string;
  };
}

export interface LTFLiquidityOutput extends BaseAgentOutput {
  sweeps: string[];
  inducement: string[];
  _debug?: BaseDebugInfo;
}
