/// <reference types="node" />

import "dotenv/config";
import { behaviorAgent } from "../agents/confluence/behavior-agent.js";
import { deliveryAgent } from "../agents/confluence/delivery-agent.js";
import { imbalanceAgent } from "../agents/confluence/imbalance-agent.js";
import { modelAgent } from "../agents/confluence/model-agent.js";
import { PersistenceService } from "../../../shared/services/persistence-service.js";

interface ConfluenceOrchestratorInput {
  eurusd: {
    m15: string;
    m5: string;
    m1: string;
  };
  gbpusd?: {
    m15: string;
    m5: string;
    m1: string;
  };
  query: string;
  optional_context?: string;
}

interface ConfluenceOrchestratorOutput {
  confirmation: boolean;
  strength: number; // 0 - 100
  narrative: string;
  _debug?: any;
}

export async function runConfluenceOrchestrator(input: ConfluenceOrchestratorInput): Promise<ConfluenceOrchestratorOutput> {
  // 1. Run Agents in Parallel
  const results = await Promise.allSettled([
    behaviorAgent(input),
    deliveryAgent(input),
    imbalanceAgent(input),
    modelAgent(input)
  ]);

  const behavior = results[0].status === "fulfilled" ? results[0].value : null;
  const delivery = results[1].status === "fulfilled" ? results[1].value : null;
  const imbalance = results[2].status === "fulfilled" ? results[2].value : null;
  const model = results[3].status === "fulfilled" ? results[3].value : null;

  // 2. Weighted Logic (Track C)
  const convToScore = (conv?: string) => {
    if (conv === "high") return 1.0;
    if (conv === "medium") return 0.6;
    if (conv === "low") return 0.3;
    return 0;
  };

  // model (40%) + behavior (30%) + delivery (20%) + imbalance (10%)
  const modelScore = (model?.detected ? 100 : 0) * 0.4 * convToScore(model?.conviction);
  const behaviorScore = (behavior?.behavior !== "unknown" ? 100 : 0) * 0.3 * convToScore(behavior?.conviction);
  const deliveryScore = (delivery?.delivery_state !== "unknown" ? 100 : 0) * 0.2 * convToScore(delivery?.conviction);
  const imbalanceScore = (imbalance?.imbalances?.length ? Math.min(imbalance.imbalances.length * 20, 100) : 0) * 0.1;

  const totalStrength = Math.round(modelScore + behaviorScore + deliveryScore + imbalanceScore);
  const confirmation = totalStrength >= 50;

  const narrative = `
Confluence Strength: ${totalStrength}%.
Behavior: ${behavior?.behavior || "unknown"} (${behavior?.conviction}).
Delivery: ${delivery?.delivery_state || "unknown"} (${delivery?.conviction}).
Model: ${model?.model_name || "none"} (${model?.detected ? "detected" : "not detected"}).
Imbalances: ${imbalance?.imbalances?.length || 0} detected.
  `.trim();

  const result: ConfluenceOrchestratorOutput = {
    confirmation,
    strength: totalStrength,
    narrative,
    _debug: {
      behavior,
      delivery,
      imbalance,
      model,
      scores: {
        modelScore,
        behaviorScore,
        deliveryScore,
        imbalanceScore
      }
    }
  };

  // The new PersistenceService saves the entire run artifact at the end, so we don't need to persist each orchestrator's output individually.

  return result;
}
