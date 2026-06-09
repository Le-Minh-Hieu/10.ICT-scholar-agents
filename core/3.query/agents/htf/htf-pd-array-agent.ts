/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  htfPDArrayOutputSchema,
  HTFPDArrayInput,
  HTFPDArrayOutput,
} from "../../../../shared/contracts/htf/pd-array";

/**
 * HTF PD Array Agent
 * Standardized using runBaseAgent
 */
export async function htfPDArrayAgent(input: HTFPDArrayInput, minimal_context: any): Promise<HTFPDArrayOutput> {
  const fallback: HTFPDArrayOutput = {
    confidence: 0.1,
    pd_array_status: "unknown",
    equilibrium: 0,
    range_high: 0,
    range_low: 0,
    // notes: "No valid PD array data",
    reasoning: "No valid PD array data"
  };

  if (!input?.eurusd?.d) return fallback;

  return runBaseAgent<HTFPDArrayInput, HTFPDArrayOutput>(input, {
    agentName: "HTF-PDArray-Agent",
    pipelinePath: "data/htf_pipeline.json",
    layer: "htf",
    step: "pd_array",
    role: "You are an ICT PD Array (Premium/Discount) analysis system.",
    task: "Detect premium / discount zones using STRICT grounded reasoning. Identify HTF range, equilibrium, and current price position.",
    constraints: [
      "MANDATORY REASONING ORDER: 1. Extract Principles, 2. Apply to Chart, 3. Derive Signals, 4. Self-Validation",
      "Extract at least 2 unique principles from grounded knowledge",
      "MUST include EXACTLY ONE CHUNK_ID per principle",
      "If structure unclear → output 'unknown'",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{\n      "principles": [{"rule": "...", "chunk_id": "..."}],\n      "pd_array_status": "premium" | "discount" | "equilibrium" | "unknown",\n      "equilibrium": number,\n      "range_high": number,\n      "range_low": number,\n      "confidence": 0.9,\n      "references": ["CHUNK_ID:..."],\n      "notes": "Step-by-step reasoning following the mandatory order"\n    }`,
    buildInputContext: (input) => "EURUSD (M → W → D) PD Array Context",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.m, "HTF-EURUSD-M", callId);
      pushImage(parts, input.eurusd.w, "HTF-EURUSD-W", callId);
      pushImage(parts, input.eurusd.d, "HTF-EURUSD-D", callId);
    },
    useGroundingVerification: true,
    schema: htfPDArrayOutputSchema,
    mapOutput: (result) => {
      return {
        confidence: result.confidence,
        reasoning: result.notes,
        pd_array_status: result.pd_array_status,
        equilibrium: result.equilibrium,
        range_high: result.range_high,
        range_low: result.range_low
      };
    },
    fallback
  }, minimal_context);
}
