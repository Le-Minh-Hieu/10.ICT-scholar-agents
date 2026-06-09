/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  ltfPdArrayOutputSchema,
  LTFPDArrayInput,
  LTFPDArrayOutput,
} from "../../../../shared/contracts/ltf/pd-array";

/**
 * LTF PD Array Agent
 * Standardized using runBaseAgent
 */
export async function ltfPDArrayAgent(input: LTFPDArrayInput, minimal_context: any): Promise<LTFPDArrayOutput> {
  const fallback: LTFPDArrayOutput = {
    confidence: 0.1,
    zone: "unknown",
    pd_arrays: [],
    // notes: "Insufficient grounded knowledge",
    reasoning: "Insufficient grounded knowledge"
  };

  if (!input?.eurusd?.m15) return fallback;

  // Add explicit checks for htf and itf
  if (!input.htf) {
    throw new Error("[LTF-PD-ARRAY] Missing HTF context in input.");
  }
  if (!input.itf) {
    throw new Error("[LTF-PD-ARRAY] Missing ITF context in input.");
  }

  const result = await runBaseAgent<LTFPDArrayInput, LTFPDArrayOutput>(input, {
    agentName: "LTF-PD-Array-Agent",
    pipelinePath: "data/ltf_pipeline.json",
    layer: "ltf",
    step: "pd_array",
    role: "You are an expert in Lower Timeframe (LTF) PD Array analysis.",
    task: `Identify the LTF zone (premium | discount | equilibrium | unknown) and specific PD arrays present.\n    \n    ## 3-STEP REASONING CONTRACT (MANDATORY)\n    1. Extract Key Signals: List findings (LTF range, specific PD arrays like FVG/OB, current zone).\n    2. Map Signals -> Fields: Link findings to \"zone\" and \"pd_arrays\".\n    3. Self-Validation: Cross-check signals against fields.`,
    constraints: [
      "MANDATORY REASONING ORDER: 1. Apply HTF + ITF context to grounded knowledge, 2. Analyze chart (identify PD arrays), 3. Classify zone, 4. Validate with HTF",
      "HTF CONTEXT (HARD BIAS): " + JSON.stringify({ ...input.htf, confidence: input.htf.confidence }),
      "ITF CONTEXT (NARRATIVE): " + JSON.stringify(input.itf),
      "No silent defaults. If no LTF PD arrays are found, explicitly state why in notes.",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{\n      "principles": [{"rule": "...", "chunk_id": "..."}],\n      "zone": "premium | discount | equilibrium | unknown",\n      "pd_arrays": ["..."],\n      "confidence": 0.9,\n      "references": ["CHUNK_ID:..."],\n      "notes": "Step-by-step reasoning following the contract. Include conviction hint: [strong conviction | moderate conviction | weak inference]."\n    }`,
    buildInputContext: (input) => "LTF PD Array Analysis (M15 -> M5 -> M1)",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.m15!, "LTF-EURUSD-M15", callId);
      pushImage(parts, input.eurusd.m5!, "LTF-EURUSD-M5", callId);
      pushImage(parts, input.eurusd.m1!, "LTF-EURUSD-M1", callId);
    },
    useGroundingVerification: true,
    schema: ltfPdArrayOutputSchema,
    mapOutput: (result) => {
      const notes = (result?.notes || "").toLowerCase();
      let zone = result?.zone || "unknown";

      // Preserve existing correction logic
      if (notes.includes("premium") && zone !== "premium") zone = "premium";
      if (notes.includes("discount") && zone !== "discount") zone = "discount";

      return {
        confidence: result.confidence,
        reasoning: result.notes,
        zone,
        pd_arrays: result.pd_arrays
      };
    },
    fallback
  }, minimal_context);
  const { _debug, ...rest } = result;
  return rest;
}
