// Canonical contract: HTFOrchestratorInput
// NOTE: This file is moved-only from core/3.query/orchestrators/htf-orchestrator.ts

export interface HTFOrchestratorInput {
  eurusd: {
    d: string | null;
    w: string | null;
    m: string | null;
  };
  [key: string]: any;
}

