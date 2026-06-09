// Canonical contract: ITFOrchestratorInput
// NOTE: This file is moved-only from core/3.query/orchestrators/itf-orchestrator.ts

import type { HTFOrchestratorOutput } from '../canonical';

export interface ITFOrchestratorInput {
  eurusd: {
    d: string | null;
    w: string | null;
    h4: string | null;
    h1: string | null;
  };
  htf?: HTFOrchestratorOutput;
  [key: string]: any;
}

