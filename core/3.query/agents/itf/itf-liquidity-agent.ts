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
