// Canonical contract: MasterOrchestratorInputSchema + MasterOrchestratorInput
// NOTE: This file is moved-only from core/3.query/orchestrators/master-orchestrator.ts

import { z } from 'zod';
import type { HydrationContext } from '../context';
import { HydrationContextSchema } from '../context';
import type { HTFOrchestratorOutput, ITFOrchestratorOutput, LTFOrchestratorOutput } from '../canonical';
import {
  HTFOrchestratorOutputSchema,
  ITFOrchestratorOutputSchema,
  LTFOrchestratorOutputSchema,
} from '../canonical';

export const MasterOrchestratorInputSchema = z.object({
  time: z.any(),
  htf: HTFOrchestratorOutputSchema,
  itf: ITFOrchestratorOutputSchema,
  ltf: LTFOrchestratorOutputSchema,
  hydration_context: HydrationContextSchema,
});

export type MasterOrchestratorInput = z.infer<typeof MasterOrchestratorInputSchema>;

// Re-export for legacy typings ergonomics
export type { HydrationContext };

