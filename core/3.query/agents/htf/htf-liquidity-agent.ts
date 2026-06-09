/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  htfLiquidityOutputSchema,
  HTFLiquidityInput,
  HTFLiquidityOutput,
} from "../../../../shared/contracts/htf/liquidity";

/**
 * HTF Liquidity Agent
 * Standardized using runBaseAgent
 */
export async function htfLiquidityAgent(input: HTFLiquidityInput, minimal_context: any): Promise<HTFLiquidityOutput> {
  const fallback: HTFLiquidityOutput = {
    confidence: 0.1,
    liquidity: { above: false, below: false },
    // notes: "No valid liquidity data",
    reasoning: "No valid liquidity data"
  };

  if (!input?.eurusd?.d) return fallback;

  return runBaseAgent<HTFLiquidityInput, HTFLiquidityOutput>(input, {
    agentName: "HTF-Liquidity-Agent",
    pipelinePath: "data/htf_pipeline.json",
    layer: "htf",
    step: "liquidity",
    role: "You are an ICT liquidity detection system.",
    task: "Identify HTF liquidity using STRICT grounded reasoning. Determine where liquidity rests (above / below).",
    constraints: [
      "MANDATORY REASONING ORDER: 1. Extract Principles, 2. Apply to Chart, 3. Derive Signals, 4. Self-Validation",
      "Extract at least 2 unique principles from grounded knowledge",
      "If both liquidity.above and below are true, you MUST explain directional preference or uncertainty",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{\n      "principles": [{"rule": "...", "chunk_id": "..."}],\n      "liquidity": {"above": boolean, "below": boolean},\n      "confidence": 0.9,\n      "references": ["CHUNK_ID:..."],\n      "notes": "Step-by-step reasoning following the mandatory order"\n    }`,
    buildInputContext: (input) => "EURUSD (M → W → D) Liquidity Context",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.m, "HTF-EURUSD-M", callId);
      pushImage(parts, input.eurusd.w, "HTF-EURUSD-W", callId);
      pushImage(parts, input.eurusd.d, "HTF-EURUSD-D", callId);
    },
    useGroundingVerification: true,
    schema: htfLiquidityOutputSchema,
    mapOutput: (result) => {
      const notes = (result?.notes || "").toLowerCase();
      let above = result?.liquidity?.above ?? false;
      let below = result?.liquidity?.below ?? false;
      let confidence = result?.confidence || 0.1;

      // Preserve correction logic
      if (notes.includes("above") && !above) {
        above = true;
      }
      if (notes.includes("below") && !below) {
        below = true;
      }

      return {
        confidence: confidence,
        reasoning: result.notes,
        liquidity: { above, below }
      };
    },
    fallback
  }, minimal_context);
}
