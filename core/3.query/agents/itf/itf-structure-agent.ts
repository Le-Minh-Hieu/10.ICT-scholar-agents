/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  itfStructureOutputSchema,
  ITFStructureInput,
  ITFStructureOutput,
} from "../../../../shared/contracts/itf/structure";
import { Confidence } from "../../../../shared/contracts/pmso";
import { normalizeConfidence } from "../../../../shared/utils/confidence-utils";
export type { ITFStructureInput, ITFStructureOutput } from "../../../../shared/contracts/itf/structure";
export { itfStructureOutputSchema } from "../../../../shared/contracts/itf/structure";

/**
 * ITF Structure Agent
 * Standardized using runBaseAgent
 */
export async function itfStructureAgent(input: ITFStructureInput, minimal_context: any): Promise<ITFStructureOutput> {
  const fallback: ITFStructureOutput = {
    confidence: 0.1,
    structure_trend: "unknown",
    smt_signal: "none",
    structure_strength: "weak",
    // notes: "No valid ITF structure data",
    reasoning: "No valid ITF structure data"
  };

  if (!input?.eurusd?.h4) return fallback;
  const compactHTF = {
    htf_bias: input.htf.htf_bias,
    next_candle_bias: input.htf.next_candle_bias,
    confidence: input.htf.confidence,
    reasoning: input.htf.reasoning,
  };
  const result = await runBaseAgent<ITFStructureInput, ITFStructureOutput>(input, {
    agentName: "ITF-Structure-Agent",
    pipelinePath: "data/itf_pipeline.json",
    layer: "itf",
    step: "structure",
    role: "You are an ICT ITF structure analysis system.",
    task: `Analyze ITF structure (H4 → H1 → M15) using STRICT grounded reasoning. \n    Compare ITF structure with the provided HTF bias to determine alignment.`,
    constraints: [
      "MANDATORY REASONING ORDER: 1. Extract Principles, 2. Apply to Chart (HH/HL, LH/LL), 3. Derive Signals, 4. Compare with HTF",
      JSON.stringify(compactHTF),
      "You MUST identify at least one specific price level from the chart before proceeding",
      "If same direction as HTF → continuation; If opposite → pullback or reversal",
      "If unclear → output 'unknown'",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{\n      "principles": [{"rule": "...", "chunk_id": "..."}],\n      "structure_trend": "bullish" | "bearish" | "consolidation" | "unknown",\n      "smt_signal": "bullish" | "bearish" | "none",\n      "structure_strength": "weak" | "medium" | "strong",\n      "references": ["CHUNK_ID:..."],\n      "confidence": 0.9,\n      "notes": "Step-by-step reasoning including HTF alignment"\n    }`,
    buildInputContext: (input) => "ITF Structure Analysis (H4 -> H1 -> M15)",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.h4!, "ITF-EURUSD-H4", callId);
      pushImage(parts, input.eurusd.h1!, "ITF-EURUSD-H1", callId);
      pushImage(parts, input.eurusd.m15!, "ITF-EURUSD-M15", callId);
      if (input.gbpusd) {
        pushImage(parts, input.gbpusd.h4!, "ITF-GBPUSD-H4", callId);
        pushImage(parts, input.gbpusd.h1!, "ITF-GBPUSD-H1", callId);
        pushImage(parts, input.gbpusd.m15!, "ITF-GBPUSD-M15", callId);
      }
    },
    useGroundingVerification: true,
    visionPrompt: `Analyze ALL attached chart images for LIVE ICT market structure observations on the Intermediate Time Frame (ITF - H4, H1, M15).

Focus on identifying intermediate structural shifts, block formations, and intermarket divergence:
1. **SMT Divergence Detection**: Compare EURUSD and GBPUSD swing highs/lows. Identify if there is a bullish SMT (EURUSD Lower Low vs GBPUSD Higher Low) or bearish SMT (EURUSD Higher High vs GBPUSD Lower High) at key intermediate turning points on H4, H1, or M15 charts. (STRUCTURE)
2. **Market Structure Shifts (MSS / BOS)**: Look for intermediate-term breaks of swing highs/lows with displacement, confirming trend shifts. (STRUCTURE)
3. **Structural Blocks**: Identify prominent intermediate-term Breaker Blocks (BB), Mitigation Blocks (MB), or high-confidence Order Blocks (OB) on H4, H1, or M15 charts. (STRUCTURE)
4. **Swing Highs & Lows**: Identify key H4/H1 swing highs and swing lows acting as intermediate structural boundaries. (PRICE)

Output your observations as objective bullet points. Do NOT infer directional bias or make trading recommendations.`,
    schema: itfStructureOutputSchema,
    mapOutput: (result) => {
      return {
        confidence: result.confidence,
        reasoning: result.notes,
        structure_trend: result.structure_trend,
        smt_signal: result.smt_signal,
        structure_strength: result.structure_strength
      };
    },
    fallback
  }, minimal_context);
  const { _debug, ...rest } = result;
  return rest;
}
