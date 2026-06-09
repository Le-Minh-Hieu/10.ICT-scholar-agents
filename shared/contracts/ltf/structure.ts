import { z } from "zod";
import { BaseAgentOutput, BaseDebugInfo } from "../common/base-agent";
import { VisionFact } from "../pmso";

export const ltfStructureOutputSchema = z.object({
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

export interface LTFStructureInput {
  eurusd: {
    m15: string | null;
    m5: string | null;
    m1: string | null;
  };
}

export interface LTFStructureOutput extends BaseAgentOutput {
  facts: VisionFact[];
  _debug?: BaseDebugInfo;
}
