import { z } from "zod";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";
import { VisionFact } from "../pmso";

export const htfStructureOutputSchema = z.object({
  principles: z.array(z.object({ rule: z.string(), chunk_id: z.string() })),
  facts: z.array(z.object({
    type: z.string(),
    confidence: z.number(),
    anchor: z.string(),
    timeframe: z.string(),
  })),
  references: z.array(z.string()),
  confidence: z.number(),
  notes: z.string(),
});

export interface HTFStructureInput {
  eurusd: {
    d: string | null;
    w: string | null;
    m: string | null;
  };
  gbpusd?: {
    d: string | null;
    w: string | null;
    m: string | null;
  };
}

export interface HTFStructureOutput extends BaseAgentOutput {
  facts: VisionFact[];
  _debug?: BaseDebugInfo;
}
