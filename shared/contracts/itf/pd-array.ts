import { z } from "zod";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";
import { Confidence } from "../pmso";

export const itfPdArrayOutputSchema = z.object({
  principles: z.array(z.object({ rule: z.string(), chunk_id: z.string() })),
  pd_array_state: z.enum(["premium", "discount", "equilibrium", "unknown"]),
  confidence: z.number(),
  references: z.array(z.string()),
  notes: z.string(),
});

export interface ITFPDArrayInput {
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
}

export interface ITFPDArrayOutput extends BaseAgentOutput {
  pd_array_state: "premium" | "discount" | "equilibrium" | "unknown";
  _debug?: BaseDebugInfo;
}
