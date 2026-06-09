// Canonical contract: LTFOrchestratorInput
// NOTE: This file is moved-only from core/3.query/orchestrators/ltf-orchestrator.ts

import type { HTFOrchestratorOutput, ITFOrchestratorOutput } from '../canonical';

export interface LTFOrchestratorInput {
  eurusd: {
    h1: string | null;
    m15: string | null;
    m5: string | null;
    m1: string | null;
  };
  htf?: HTFOrchestratorOutput;
  itf?: ITFOrchestratorOutput;
  [key: string]: any;
}

