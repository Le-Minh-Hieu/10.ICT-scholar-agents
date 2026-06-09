/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import { BaseAgentOutput, BaseDebugInfo } from "../../../../shared/contracts/common/base-agent";

interface DeliveryInput {
  eurusd: {
    m15: string;
    m5: string;
    m1: string;
  };
  query: string;
}

interface DeliveryAgentOutput extends BaseAgentOutput {
  delivery_state: string;
  conviction: "high" | "medium" | "low";
  _debug?: BaseDebugInfo;
}

/**
 * Delivery Analysis Agent
 * Standardized using runBaseAgent
 */
export async function deliveryAgent(input: DeliveryInput): Promise<DeliveryAgentOutput> {
  const fallback: DeliveryAgentOutput = {
    confidence: "low",
    conviction: "low",
    delivery_state: "unknown",
    notes: "Insufficient grounded knowledge",
    reasoning: "Insufficient grounded knowledge"
  };

  return runBaseAgent<DeliveryInput, DeliveryAgentOutput>(input, {
    agentName: "Delivery-Agent",
    pipelinePath: "data/confluence_pipeline.json",
    layer: "confluence",
    step: "delivery",
    role: "You are an ICT order delivery analyst.",
    task: "Identify the current order delivery state (e.g., Efficient, Inefficient, Seeking Liquidity, Running for stops).",
    constraints: [
      "QUERY INTERPRETATION: USER QUERY = PRIMARY SIGNAL. GROUNDED KNOWLEDGE = SUPPORT ONLY.",
      "REASONING FLOW: 1. Parse QUERY, 2. Extract signals, 3. Use grounded knowledge to CONFIRM/refine, 4. Produce output.",
      "USER QUERY: " + input.query,
      "Check for overlapping candles vs. impulsive moves with gaps.",
      "Identify if price has just balanced an old inefficiency.",
      "Determine if current delivery is 'orderly' or 'aggressive'.",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{
      "principles": [{"rule": "...", "chunk_id": "..."}],
      "delivery_state": "string",
      "confidence": "high | medium | low",
      "references": ["CHUNK_ID:..."],
      "notes": "Step-by-step reasoning for the assessment. INCLUDE conviction hint: [strong conviction | moderate conviction | weak inference]."
    }`,
    buildInputContext: (input) => "Order Delivery Context",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.m15, "Delivery-EURUSD-M15", callId);
      pushImage(parts, input.eurusd.m5, "Delivery-EURUSD-M5", callId);
      pushImage(parts, input.eurusd.m1, "Delivery-EURUSD-M1", callId);
    },
    useGroundingVerification: true,
    mapOutput: (result) => {
      const conviction = result?.confidence || result?.conviction || "low";
      return {
        confidence: conviction,
        conviction: conviction,
        reasoning: result?.notes || "No reasoning",
        notes: result?.notes || "No reasoning",
        delivery_state: result?.delivery_state || "unknown"
      };
    },
    fallback
  });
}
