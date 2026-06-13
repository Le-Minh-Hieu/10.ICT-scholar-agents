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
    visionPrompt: `Analyze ALL attached chart images for LIVE ICT liquidity observations.

Focus strictly on identifying where resting liquidity lies and recent sweep events (Answer the question: WHERE IS LIQUIDITY?):
1. **Buy-side Liquidity (BSL) Pools**: Locate resting liquidity above major swing highs, equal highs (EQH), or old weekly/monthly highs. (LIQUIDITY)
2. **Sell-side Liquidity (SSL) Pools**: Locate resting liquidity below major swing lows, equal lows (EQL), or old weekly/monthly lows. (LIQUIDITY)
3. **Liquidity Sweeps & Stop Hunts**: Note if recent price action has swept high/low liquidity pools before reversing or pulling back. (LIQUIDITY)
4. **Liquidity Voids, Imbalance Zones, & Delivery Gaps**: Identify major unfilled spaces or delivery gaps acting as magnets for future price movement without classifying them as specific FVG structures. (LIQUIDITY)

Output your observations as objective bullet points. Focus purely on liquidity location and action. Do NOT try to identify or prioritize specific FVG structures.`,
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
