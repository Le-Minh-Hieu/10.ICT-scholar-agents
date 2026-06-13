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
    visionPrompt: `Analyze ALL attached chart images for LIVE ICT Premium/Discount (PD) Array observations.

Focus on mapping the active dealing range and identifying the PD array hierarchy (Answer the question: Where is price in the dealing range?):
Primary Focus:
1. **HTF Dealing Range Boundaries**: Identify the recent valid swing high and swing low defining the current daily/weekly dealing range. (PD_ARRAY)
2. **Equilibrium Level**: Pinpoint the estimated midpoint (50% level) of the current dealing range. (PD_ARRAY)
3. **Current Price Position**: Determine whether the current price is trading in a Premium zone (above 50% equilibrium) or Discount zone (below 50% equilibrium). (PD_ARRAY)
4. **PD Array Hierarchy**: Map which structural zone the price is in (e.g. Deep Premium, Discount, Equilibrium boundary). (PD_ARRAY)

Secondary Focus (Only as supporting reference):
5. **Premium / Discount PD Arrays**: Note supporting Daily/Weekly Order Blocks (OB), Fair Value Gaps (FVG), or Volume Imbalances (VI) only to confirm price location inside the range. (PD_ARRAY)

Output your observations as objective bullet points detailing the Premium/Discount status and dealing range location.`,
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
