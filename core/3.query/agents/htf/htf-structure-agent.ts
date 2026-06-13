/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  htfStructureOutputSchema,
  HTFStructureInput,
  HTFStructureOutput,
} from "../../../../shared/contracts/htf/structure";
import { BaseAgentOutput, BaseDebugInfo } from "../../../../shared/contracts/common/base-agent";
import { VisionFact } from "../../../../shared/contracts/pmso";
export type { HTFStructureInput, HTFStructureOutput } from "../../../../shared/contracts/htf/structure";
export { htfStructureOutputSchema } from "../../../../shared/contracts/htf/structure";

/**
 * HTF Structure Agent
 * Standardized using runBaseAgent
 */
export async function htfStructureAgent(
  input: HTFStructureInput,
  minimal_context: any
): Promise<HTFStructureOutput> {
  const fallback: HTFStructureOutput = {
    confidence: 0.1,
    facts: [],
    reasoning: "No valid structure data"
  };

  if (!input?.eurusd?.d) return fallback;

  return runBaseAgent<HTFStructureInput, HTFStructureOutput>(input, {
    agentName: "HTF-Structure-Agent",
    pipelinePath: "data/htf_pipeline.json",
    layer: "htf",
    step: "structure",
    role: "You are an ICT structure FACT EXTRACTION system. Do NOT infer bias or probabilities.",
    task: `Identify ALL potential HTF market structure facts and SMT Divergence signals. 
    Analyze the visible charts and output ONLY objective observations. Assign a confidence to each observation.`,
    constraints: [
      "MANDATORY OUTPUT: An array of VisionFact objects for each detected element.",
      "SMT Detection: Bullish SMT (EURUSD LL + GBPUSD HL), Bearish SMT (EURUSD HH + GBPUSD LH). Report as a fact with confidence.",
      "Detect Fair Value Gaps (FVG) and Breaker Blocks (BB) and report as facts.",
      "Detect Liquidity Sweeps and Structure Shifts. Report as facts.",
      "Assign a confidence score (0.0-1.0) to each fact based on visual clarity.",
      "DO NOT infer market bias (bullish/bearish) or overall market direction.",
      "DO NOT reconcile opposing facts; report both with their respective confidences.",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{
      "principles": [{"rule": "...", "chunk_id": "..."}],
      "facts": [
        {"type": "possible_fvg", "confidence": 0.8, "anchor": "Daily Low FVG", "timeframe": "DAILY"},
        {"type": "potential_liquidity_sweep", "confidence": 0.7, "anchor": "Previous Week High", "timeframe": "WEEKLY"}
      ],
      "references": ["CHUNK_ID:..."],
      "confidence": 0.9,
      "notes": "Step-by-step reasoning"
    }`,
    buildInputContext: (input) => `* EURUSD (M → W → D)\n${input.gbpusd ? "- GBPUSD (M → W → D) [SMT Pair]" : ""}`,
    pushImages: (parts, input, callId) => {
      if (input.eurusd.m) pushImage(parts, input.eurusd.m, "HTF-EURUSD-M", callId);
      if (input.eurusd.w) pushImage(parts, input.eurusd.w, "HTF-EURUSD-W", callId);
      if (input.eurusd.d) pushImage(parts, input.eurusd.d, "HTF-EURUSD-D", callId);
      if (input.gbpusd) {
        if (input.gbpusd.m) pushImage(parts, input.gbpusd.m, "HTF-GBPUSD-M", callId);
        if (input.gbpusd.w) pushImage(parts, input.gbpusd.w, "HTF-GBPUSD-W", callId);
        if (input.gbpusd.d) pushImage(parts, input.gbpusd.d, "HTF-GBPUSD-D", callId);
      }
    },
    useGroundingVerification: true,
    visionPrompt: `Analyze ALL attached chart images for LIVE ICT market structure observations.

Focus on identifying structural shifts, block formations, and intermarket divergence:
1. **SMT Divergence Detection**: Compare EURUSD and GBPUSD swing highs/lows. Identify if there is a bullish SMT (EURUSD Lower Low vs GBPUSD Higher Low) or bearish SMT (EURUSD Higher High vs GBPUSD Lower High) at key turning points. (STRUCTURE)
2. **Market Structure Shifts (MSS / BOS)**: Look for clean breaks of swing highs/lows confirming displacement and trend shifts. (STRUCTURE)
3. **Structural Blocks**: Identify prominent Breaker Blocks (BB), Mitigation Blocks (MB), or high-confidence Order Blocks (OB) on Monthly, Weekly, or Daily charts. (STRUCTURE)
4. **Swing Highs & Lows**: Note key structural swing points currently acting as major support/resistance levels. (PRICE)

Output your observations as objective bullet points. Do NOT infer directional bias or make trading recommendations.`,
    schema: htfStructureOutputSchema,
    mapOutput: (result) => {
      return {
        confidence: result.confidence,
        reasoning: result.notes,
        facts: result.facts,
      };
    },
    fallback
  }, minimal_context);
}
