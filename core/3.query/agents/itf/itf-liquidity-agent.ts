/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  itfLiquidityOutputSchema,
  ITFLiquidityInput,
  ITFLiquidityOutput,
} from "../../../../shared/contracts/itf/liquidity";

/**
 * ITF Liquidity Agent
 * Standardized using runBaseAgent
 */
export async function itfLiquidityAgent(input: ITFLiquidityInput, minimal_context: any): Promise<ITFLiquidityOutput> {
  const fallback: ITFLiquidityOutput = {
    confidence: 0.1,
    sweeps: [],
    targets: [],
    inducement: [],
    // notes: "No valid ITF liquidity data",
    reasoning: "No valid ITF liquidity data"
  };

  if (!input?.eurusd?.h4) return fallback;
  const compactHTF = {
    htf_bias: input.htf.htf_bias,
    next_candle_bias: input.htf.next_candle_bias,
    confidence: input.htf.confidence,
    reasoning: input.htf.reasoning,
  };
  const result = await runBaseAgent<ITFLiquidityInput, ITFLiquidityOutput>(input, {
    agentName: "ITF-Liquidity-Agent",
    pipelinePath: "data/itf_pipeline.json",
    layer: "itf",
    step: "liquidity",
    role: "You are an ICT ITF liquidity analysis system.",
    task: "Identify liquidity (sweeps, targets, inducement) from the chart using grounded reasoning.",
    constraints: [
      "MANDATORY REASONING ORDER: 1. Extract Principles, 2. Apply to Chart (Pools, Sweeps, Inducement, Targets), 3. Refine with Query, 4. Derive Signals, 5. Validate with HTF",
      "HTF CONTEXT (DO NOT OVERRIDE): " + JSON.stringify(compactHTF),
      "Optional query context: " + (input.query || "none"),
      "If unclear → return empty arrays",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{\n      "principles": [{"rule": "...", "chunk_id": "..."}],\n      "sweeps": ["..."],\n      "targets": ["..."],\n      "inducement": ["..."],\n      "confidence": 0.9,\n      "references": ["CHUNK_ID:..."],\n      "notes": "Step-by-step reasoning"\n    }`,
    buildInputContext: (input) => "ITF Liquidity Analysis (H4 -> H1 -> M15)",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.h4, "ITF-EURUSD-H4", callId);
      pushImage(parts, input.eurusd.h1, "ITF-EURUSD-H1", callId);
      pushImage(parts, input.eurusd.m15, "ITF-EURUSD-M15", callId);
    },
    useGroundingVerification: true,
    visionPrompt: `Analyze ALL attached chart images for LIVE ICT liquidity observations on the Intermediate Time Frame (ITF - H4, H1, M15).

Focus strictly on identifying resting liquidity pools, sweeps, and inducement levels:
1. **Buy-side Liquidity (BSL) Pools**: Locate resting liquidity above H4/H1 swing highs, equal highs (EQH), or intermediate-term highs. (LIQUIDITY)
2. **Sell-side Liquidity (SSL) Pools**: Locate resting liquidity below H4/H1 swing lows, equal lows (EQL), or intermediate-term lows. (LIQUIDITY)
3. **Liquidity Sweeps & Stop Hunts**: Check if recent price action has swept BSL or SSL pools on H4, H1, or M15 charts before reversing. (LIQUIDITY)
4. **Inducements**: Identify minor swing highs/lows acting as inducement (trapping early buyers/sellers) before major liquidity pools are reached. (LIQUIDITY)
5. **Liquidity Voids & Delivery Gaps**: Identify unfilled price spaces or delivery gaps on intermediate timeframes acting as magnets for price. (LIQUIDITY)

Output your observations as objective bullet points. Focus purely on liquidity location and action. Do NOT try to identify or prioritize specific FVG structures.`,
    schema: itfLiquidityOutputSchema,
    mapOutput: (result) => {
      const notes = (result?.notes || "").toLowerCase();
      const sweeps = result?.sweeps || [];
      const inducement = result?.inducement || [];
      let confidence = result?.confidence || 0.1;

      // Preservation of validation logic
      if (notes.includes("sweep") && sweeps.length === 0) {
        confidence = 0.4;
      }
      if (notes.includes("inducement") && inducement.length === 0) {
        confidence = 0.4;
      }

      return {
        confidence: confidence,
        reasoning: result.notes,
        sweeps,
        targets: result.targets,
        inducement
      };
    },
    fallback
  }, minimal_context);
  const { _debug, ...rest } = result;
  return rest;
}
