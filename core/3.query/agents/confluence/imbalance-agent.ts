/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import { BaseAgentOutput, BaseDebugInfo } from "../../../../shared/contracts/common/base-agent";

interface ImbalanceInput {
  eurusd: {
    m15: string;
    m5: string;
    m1: string;
  };
  query: string;
}

interface ImbalanceAgentOutput extends BaseAgentOutput {
  imbalances: string[];
  _debug?: BaseDebugInfo;
}

/**
 * Imbalance Analysis Agent
 * Standardized using runBaseAgent
 */
export async function imbalanceAgent(input: ImbalanceInput): Promise<ImbalanceAgentOutput> {
  const fallback: ImbalanceAgentOutput = {
    confidence: "low",
    imbalances: [],
    notes: "Insufficient grounded knowledge",
    reasoning: "Insufficient grounded knowledge"
  };

  return runBaseAgent<ImbalanceInput, ImbalanceAgentOutput>(input, {
    agentName: "Imbalance-Agent",
    pipelinePath: "data/confluence_pipeline.json",
    layer: "confluence",
    step: "imbalance",
    role: "You are an ICT imbalance analyst.",
    task: "Identify and list significant price imbalances (Fair Value Gaps, BISI, SIBI, Volume Imbalances) currently visible on charts.",
    constraints: [
      "QUERY INTERPRETATION: USER QUERY = PRIMARY SIGNAL. GROUNDED KNOWLEDGE = SUPPORT ONLY.",
      "REASONING FLOW: 1. Parse QUERY, 2. Extract signals, 3. Use grounded knowledge to CONFIRM/refine, 4. Produce output.",
      "USER QUERY: " + input.query,
      "Scan price action for three-candle patterns that leave a gap (FVG).",
      "Identify if imbalance is 'unfilled', 'partially filled', or 'closed'.",
      "Determine significance based on location (e.g., in a discount/premium zone).",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{
      "principles": [{"rule": "...", "chunk_id": "..."}],
      "imbalances": ["list of identified imbalances"],
      "confidence": "high | medium | low",
      "references": ["CHUNK_ID:..."],
      "notes": "Step-by-step reasoning for the assessment. INCLUDE conviction hint: [strong conviction | moderate conviction | weak inference]."
    }`,
    buildInputContext: (input) => "Price Imbalance Context",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.m15, "Imbalance-EURUSD-M15", callId);
      pushImage(parts, input.eurusd.m5, "Imbalance-EURUSD-M5", callId);
      pushImage(parts, input.eurusd.m1, "Imbalance-EURUSD-M1", callId);
    },
    useGroundingVerification: true,
    mapOutput: (result) => {
      return {
        confidence: result?.confidence || "low",
        reasoning: result?.notes || "No reasoning",
        notes: result?.notes || "No reasoning",
        imbalances: result?.imbalances || []
      };
    },
    fallback
  });
}
