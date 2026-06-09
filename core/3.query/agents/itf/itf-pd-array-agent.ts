/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  itfPdArrayOutputSchema,
  ITFPDArrayInput,
  ITFPDArrayOutput,
} from "../../../../shared/contracts/itf/pd-array";

/**
 * ITF PD Array Agent
 * Standardized using runBaseAgent
 */
export async function itfPDArrayAgent(input: ITFPDArrayInput, minimal_context: any): Promise<ITFPDArrayOutput> {
  const fallback: ITFPDArrayOutput = {
    confidence: 0.1,
    pd_array_state: "unknown",
    // notes: "Insufficient data",
    reasoning: "Insufficient data"
  };

  if (!input?.eurusd?.h4) return fallback;
  const compactHTF = {
    htf_bias: input.htf.htf_bias,
    next_candle_bias: input.htf.next_candle_bias,
    confidence: input.htf.confidence,
    reasoning: input.htf.reasoning,
  };
  const result = await runBaseAgent<ITFPDArrayInput, ITFPDArrayOutput>(input, {
    agentName: "ITF-PD-Array-Agent",
    pipelinePath: "data/itf_pipeline.json",
    layer: "itf",
    step: "pd_array",
    role: "You are an ICT ITF PD Array analysis system.",
    task: "Determine whether price is in premium, discount, or equilibrium based on the ITF range.",
    constraints: [
      "MANDATORY REASONING ORDER: 1. Extract Principles, 2. Extract Range (Swing High/Low), 3. Compute Equilibrium, 4. Locate Current Price, 5. Validate with HTF",
      "HTF CONTEXT (DO NOT OVERRIDE): " + JSON.stringify(compactHTF),
      "MUST identify specific price levels (swing high/low) from the chart",
      "Above midpoint → premium; Below midpoint → discount; Near midpoint → equilibrium",
      "If unclear → return 'unknown'",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes",
      "chunk_id MUST NOT be null or empty."
    ],
    outputFormat: `{\n      "principles": [{"rule": "The rule extracted from the text", "chunk_id": "CHUNK_ID:12345"}],\n      "pd_array_state": "premium" | "discount" | "equilibrium" | "unknown",\n      "confidence": 0.9,\n      "references": ["CHUNK_ID:12345"],\n      "notes": "Step-by-step reasoning with price levels"\n    }`,
    buildInputContext: (input) => "ITF PD Array Analysis (H4 -> H1 -> M15)",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.h4, "ITF-EURUSD-H4", callId);
      pushImage(parts, input.eurusd.h1, "ITF-EURUSD-H1", callId);
      pushImage(parts, input.eurusd.m15, "ITF-EURUSD-M15", callId);
    },
    useGroundingVerification: true,
    schema: itfPdArrayOutputSchema,
    mapOutput: (result) => {
      const notes = (result?.notes || "").toLowerCase();
      let state = result?.pd_array_state || "unknown";

      return {
        confidence: result.confidence,
        reasoning: result.notes,
        pd_array_state: state
      };
    },
    fallback
  }, minimal_context);
  const { _debug, ...rest } = result;
  return rest;
}
