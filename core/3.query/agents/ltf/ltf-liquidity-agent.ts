/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  ltfLiquidityOutputSchema,
  LTFLiquidityInput,
  LTFLiquidityOutput,
} from "../../../../shared/contracts/ltf/liquidity";

/**
 * LTF Liquidity Agent
 * Standardized using runBaseAgent
 */
export async function ltfLiquidityAgent(input: LTFLiquidityInput, minimal_context: any): Promise<LTFLiquidityOutput> {
  const fallback: LTFLiquidityOutput = {
    confidence: 0.1,
    sweeps: [],
    inducement: [],
    // notes: "No liquidity data",
    reasoning: "No liquidity data"
  };

  if (!input?.eurusd?.m15) return fallback;

  // Add explicit checks for htf and itf
  if (!input.htf) {
    throw new Error("[LTF-LIQUIDITY] Missing HTF context in input.");
  }
  if (!input.itf) {
    throw new Error("[LTF-LIQUIDITY] Missing ITF context in input.");
  }

  const result = await runBaseAgent<LTFLiquidityInput, LTFLiquidityOutput>(input, {
    agentName: "LTF-Liquidity-Agent",
    pipelinePath: "data/ltf_pipeline.json",
    layer: "ltf",
    step: "liquidity",
    role: "You are an ICT LTF liquidity analysis system.",
    task: "Identify micro liquidity: sweeps (stop hunts) and inducement (liquidity traps).",
    constraints: [
      "MANDATORY REASONING ORDER: 1. Apply HTF + ITF context to grounded knowledge, 2. Analyze chart (identify sweeps and inducement), 3. Classify, 4. Validate with HTF",
      "HTF CONTEXT (HARD BIAS): " + JSON.stringify({ ...input.htf, confidence: input.htf.confidence }),
      "ITF CONTEXT (NARRATIVE): " + JSON.stringify(input.itf),
      "MUST reference HTF + ITF alignment in reasoning",
      "MUST include price levels from the charts",
      "If conflict with HTF → reduce confidence",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{\n      "principles": [{"rule": "...", "chunk_id": "..."}],\n      "sweeps": ["..."],\n      "inducement": ["..."],\n      "confidence": 0.9,\n      "references": ["CHUNK_ID:..."],\n      "notes": "Step-by-step reasoning with HTF + ITF alignment"\n    }`,
    buildInputContext: (input) => "LTF Liquidity Analysis (M15 -> M5 -> M1)",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.m15!, "LTF-EURUSD-M15", callId);
      pushImage(parts, input.eurusd.m5!, "LTF-EURUSD-M5", callId);
      pushImage(parts, input.eurusd.m1!, "LTF-EURUSD-M1", callId);
    },
    useGroundingVerification: true,
    visionPrompt: `Analyze ALL attached chart images for LIVE ICT liquidity observations on the Low Time Frame (LTF - M15, M5, M1).

Focus strictly on identifying resting micro-liquidity pools, sweeps, and inducements (Answer the question: WHERE IS LIQUIDITY?):
1. **Micro Buy-side Liquidity (BSL) Pools**: Locate resting liquidity above local swing highs, equal highs (EQH), or session highs on M15, M5, or M1. (LIQUIDITY)
2. **Micro Sell-side Liquidity (SSL) Pools**: Locate resting liquidity below local swing lows, equal lows (EQL), or session lows on M15, M5, or M1. (LIQUIDITY)
3. **Liquidity Sweeps & Stop Hunts**: Check if recent price action has swept BSL or SSL pools on M15, M5, or M1 charts before reversing or pulling back. (LIQUIDITY)
4. **Inducements**: Identify minor swing highs/lows acting as local inducement (trapping early buyers/sellers) before major liquidity pools are reached. (LIQUIDITY)
5. **Liquidity Voids & Delivery Gaps**: Identify unfilled price spaces or delivery gaps on low timeframes acting as magnets for price. (LIQUIDITY)

Output your observations as objective bullet points. Focus purely on liquidity location and action. Do NOT try to identify or prioritize specific FVG structures.`,
    schema: ltfLiquidityOutputSchema,
    mapOutput: (result) => {
      return {
        confidence: result.confidence,
        reasoning: result.notes,
        sweeps: result.sweeps,
        inducement: result.inducement
      };
    },
    fallback
  }, minimal_context);
  const { _debug, ...rest } = result;
  return rest;
}
