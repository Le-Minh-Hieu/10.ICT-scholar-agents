/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import { BaseAgentOutput, BaseDebugInfo } from "../../../../shared/contracts/common/base-agent";

interface BehaviorInput {
  eurusd: {
    m15: string;
    m5: string;
    m1: string;
  };
  query: string;
}

interface BehaviorAgentOutput extends BaseAgentOutput {
  behavior: string;
  conviction: "high" | "medium" | "low";
  _debug?: BaseDebugInfo;
}

/**
 * Behavior Analysis Agent
 * Standardized using runBaseAgent
 */
export async function behaviorAgent(input: BehaviorInput): Promise<BehaviorAgentOutput> {
  const fallback: BehaviorAgentOutput = {
    confidence: "low",
    conviction: "low",
    behavior: "unknown",
    notes: "Insufficient grounded knowledge",
    reasoning: "Insufficient grounded knowledge"
  };

  return runBaseAgent<BehaviorInput, BehaviorAgentOutput>(input, {
    agentName: "Behavior-Agent",
    pipelinePath: "data/confluence_pipeline.json",
    layer: "confluence",
    step: "behavior",
    role: "You are an ICT price behavior analyst.",
    task: "Identify the current behavioral state of price (e.g., Accumulation, Manipulation, Distribution, SMT, Re-pricing).",
    constraints: [
      "QUERY INTERPRETATION: USER QUERY = PRIMARY SIGNAL. GROUNDED KNOWLEDGE = SUPPORT ONLY.",
      "REASONING FLOW: 1. Parse QUERY, 2. Extract signals, 3. Use grounded knowledge to CONFIRM/refine, 4. Produce output.",
      "USER QUERY: " + input.query,
      "Look for patterns like AMD (Consolidation -> Sweep -> Expansion).",
      "Identify if price is being 'engineered' or is consistent with 'smart money' behavior.",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{
      "principles": [{"rule": "...", "chunk_id": "..."}],
      "behavior": "string",
      "confidence": "high | medium | low",
      "references": ["CHUNK_ID:..."],
      "notes": "Step-by-step reasoning for the assessment. INCLUDE conviction hint: [strong conviction | moderate conviction | weak inference]."
    }`,
    buildInputContext: (input) => "Price Behavior Context",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.m15, "Behavior-EURUSD-M15", callId);
      pushImage(parts, input.eurusd.m5, "Behavior-EURUSD-M5", callId);
      pushImage(parts, input.eurusd.m1, "Behavior-EURUSD-M1", callId);
    },
    useGroundingVerification: true,
    mapOutput: (result) => {
      const conviction = result?.confidence || result?.conviction || "low";
      return {
        confidence: conviction,
        conviction: conviction,
        reasoning: result?.notes || "No reasoning",
        notes: result?.notes || "No reasoning",
        behavior: result?.behavior || "unknown"
      };
    },
    fallback
  });
}
