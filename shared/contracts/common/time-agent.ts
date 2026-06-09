// Canonical contract: TimeAgentInput
// NOTE: This file is moved-only from types/time-agent.ts

import { z } from 'zod';

export interface TimeAgentInput {
  eurusd: {
    tf1: string | null;
    tf2: string | null;
    tf3: string | null;
  };
}

export const TimeAgentOutputSchema = z.object({
  timing_bias: z.enum(["favorable", "neutral", "unfavorable"]),
  trading_window: z.enum(["active", "inactive"]),
  expectation: z.enum([
    "Accumulation",
    "Re-accumulation",
    "Consolidation",
    "Manipulation",
    "Reversal",
    "Expansion",
    "Distribution",
    "Re-distribution",
    "Retracement",
  ]),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string(),
});

export type TimeAgentOutput = z.infer<typeof TimeAgentOutputSchema> & { _debug?: any };

