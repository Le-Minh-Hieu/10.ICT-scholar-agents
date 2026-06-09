import { z } from "zod";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";
import { Confidence } from "../pmso";

export const ltfPdArrayOutputSchema = z.object({
  principles: z.array(z.object({ rule: z.string(), chunk_id: z.string() })),
  zone: z.enum(["premium", "discount", "equilibrium", "unknown"]),
  pd_arrays: z.array(z.string()),
  confidence: z.number(),
  references: z.array(z.string()),
  notes: z.string(),
});

export interface LTFPDArrayInput {
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

export interface LTFPDArrayOutput extends BaseAgentOutput {
  zone: "premium" | "discount" | "equilibrium" | "unknown";
  pd_arrays: string[];
  _debug?: BaseDebugInfo;
}
