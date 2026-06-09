/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import { BaseAgentOutput, BaseDebugInfo } from "../../../../shared/contracts/common/base-agent";

interface ModelInput {
  eurusd: {
    m15: string;
    m5: string;
    m1: string;
  };
  query: string;
}

interface ModelAgentOutput extends BaseAgentOutput {
  model_name: string;
  detected: boolean;
  conviction: "high" | "medium" | "low";
  _debug?: BaseDebugInfo;
}

/**
 * Trading Model Detection Agent
 * Standardized using runBaseAgent
 */
export async function modelAgent(input: ModelInput): Promise<ModelAgentOutput> {
  const fallback: ModelAgentOutput = {
    confidence: "low",
    conviction: "low",
    model_name: "none",
    detected: false,
    notes: "Insufficient grounded knowledge",
    reasoning: "Insufficient grounded knowledge"
  };

  return runBaseAgent<ModelInput, ModelAgentOutput>(input, {
    agentName: "Model-Agent",
    pipelinePath: "data/confluence_pipeline.json",
    layer: "confluence",
    step: "model",
    role: "You are an expert in identifying ICT trading models (e.g., 2022 Mentorship, Silver Bullet, Turtle Soup, Unicorn, Breaker+FVG).",
    task: "Identify if a specific, high-probability ICT trading model is currently active based on chart evidence and grounded knowledge.",
    constraints: [
      "QUERY INTERPRETATION: USER QUERY = PRIMARY SIGNAL. GROUNDED KNOWLEDGE = SUPPORT ONLY.",
      "REASONING FLOW: 1. Parse QUERY, 2. Extract signals, 3. Use grounded knowledge to CONFIRM/refine, 4. Produce output.",
      "USER QUERY: " + input.query,
      "Verify components: liquidity sweep, MSS, FVG, displacement.",
      "Check if model is forming at the correct time (Killzones) and in the correct zone (Premium/Discount).",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{
      "principles": [{"rule": "...", "chunk_id": "..."}],
      "model_name": "string (e.g., 2022 Model, Silver Bullet, etc.)",
      "detected": boolean,
      "confidence": "high | medium | low",
      "references": ["CHUNK_ID:..."],
      "notes": "Step-by-step reasoning for the assessment. INCLUDE conviction hint: [strong conviction | moderate conviction | weak inference]."
    }`,
    buildInputContext: (input) => "Trading Model Detection Context",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.m15, "Model-EURUSD-M15", callId);
      pushImage(parts, input.eurusd.m5, "Model-EURUSD-M5", callId);
      pushImage(parts, input.eurusd.m1, "Model-EURUSD-M1", callId);
    },
    useGroundingVerification: true,
    mapOutput: (result) => {
      const conviction = result?.confidence || result?.conviction || "low";
      return {
        confidence: conviction,
        conviction: conviction,
        reasoning: result?.notes || "No reasoning",
        notes: result?.notes || "No reasoning",
        model_name: result?.model_name || "none",
        detected: !!result?.detected
      };
    },
    fallback
  });
}
