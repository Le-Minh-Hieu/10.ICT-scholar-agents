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
    visionPrompt: `Analyze ALL attached chart images for LIVE ICT Premium/Discount (PD) Array observations on the Low Time Frame (LTF - M15, M5, M1).

Focus on mapping the active low-timeframe dealing range and identifying the PD array hierarchy (Answer the question: Where is price in the dealing range?):
Primary Focus:
1. **LTF Dealing Range Boundaries**: Identify the recent valid M15 or M5 swing high and swing low defining the current active low-timeframe dealing range. (PD_ARRAY)
2. **Equilibrium Level**: Pinpoint the midpoint (50% level) of this active dealing range. (PD_ARRAY)
3. **Current Price Position**: Determine whether the current price is trading in a Premium zone (above 50% equilibrium) or Discount zone (below 50% equilibrium) within the active range. (PD_ARRAY)
4. **PD Array Hierarchy**: Map where the price is trading relative to key low-timeframe PD Arrays (e.g. trading at equilibrium, deep premium, deep discount, or reacting to a specific M15/M5 PD Array). (PD_ARRAY)

Secondary Focus:
5. **Premium / Discount PD Arrays**: Note supporting M15/M5/M1 Order Blocks (OB), Fair Value Gaps (FVG), or Volume Imbalances (VI) only to confirm price location and interaction within the dealing range. (PD_ARRAY)

Output your observations as objective bullet points detailing the Premium/Discount status and dealing range location.`,
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
