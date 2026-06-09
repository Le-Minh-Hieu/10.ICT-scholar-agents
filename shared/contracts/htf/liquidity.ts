import { z } from "zod";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";

export const htfLiquidityOutputSchema = z.object({
  principles: z.array(z.object({ rule: z.string(), chunk_id: z.string() })),
  liquidity: z.object({
    above: z.boolean(),
    below: z.boolean(),
  }),
  confidence: z.number().min(0).max(1),
  references: z.array(z.string()),
  notes: z.string(),
});

export interface HTFLiquidityInput {
  eurusd: {
    d: string | null;
    w: string | null;
    m: string | null;
  };
}

export interface HTFLiquidityOutput extends BaseAgentOutput {
  liquidity: {
    above: boolean;
    below: boolean;
  };
  _debug?: BaseDebugInfo;
}
