import { z } from "zod";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";

export const htfPDArrayOutputSchema = z.object({
  principles: z.array(z.object({ rule: z.string(), chunk_id: z.string() })),
  pd_array_status: z.enum(["premium", "discount", "equilibrium", "unknown"]),
  equilibrium: z.number(),
  range_high: z.number(),
  range_low: z.number(),
  confidence: z.number(),
  references: z.array(z.string()),
  notes: z.string(),
});

export interface HTFPDArrayInput {
  eurusd: {
    d: string | null;
    w: string | null;
    m: string | null;
  };
}

export interface HTFPDArrayOutput extends BaseAgentOutput {
  pd_array_status: "premium" | "discount" | "equilibrium" | "unknown";
  equilibrium: number;
  range_high: number;
  range_low: number;
  _debug?: BaseDebugInfo;
}
