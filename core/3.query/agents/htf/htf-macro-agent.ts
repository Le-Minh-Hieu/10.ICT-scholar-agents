/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  htfMacroOutputSchema,
  HTFMacroInput,
  HTFMacroOutput,
} from "../../../../shared/contracts/htf/macro";
import { BaseAgentOutput, BaseDebugInfo } from "../../../../shared/contracts/common/base-agent";
import { VisionFact } from "../../../../shared/contracts/pmso";
export type { HTFMacroInput, HTFMacroOutput } from "../../../../shared/contracts/htf/macro";
export { htfMacroOutputSchema } from "../../../../shared/contracts/htf/macro";

/**
 * HTF Macro Agent
 * Standardized using runBaseAgent
 */
export async function htfMacroAgent(input: HTFMacroInput, minimal_context: any): Promise<HTFMacroOutput> {
  const fallback: HTFMacroOutput = {
    confidence: 0.1,
    facts: [],
    reasoning: "No valid macro data"
  };

  if (!input?.eurusd?.d) return fallback;

  return runBaseAgent<HTFMacroInput, HTFMacroOutput>(input, {
    agentName: "HTF-Macro-Agent",
    pipelinePath: "data/htf_pipeline.json",
    layer: "htf",
    step: "macro",
    role: "You are an ICT macro FACT EXTRACTION system. Do NOT infer directional bias.",
    task: "Identify ALL macro intermarket facts (DXY moves, Yield shifts, Correlated asset behaviour). Analyze charts and output objective observations.",
    constraints: [
      "MANDATORY OUTPUT: An array of VisionFact objects for each detected macro element.",
      "Report DXY movement as a fact (e.g. 'DXY_displacement_bearish').",
      "Report Yield movement as a fact (e.g. 'Yield_rising').",
      "Report Correlated asset divergence if visible.",
      "Assign confidence (0.0-1.0) to each macro observation.",
      "DO NOT decide if this makes EURUSD bullish or bearish. Just report the macro facts.",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{\n      "principles": [{"rule": "...", "chunk_id": "..."}],\n      "facts": [\n        {"type": "dxy_bearish_displacement", "confidence": 0.85, "anchor": "DXY Daily High", "timeframe": "DAILY"},\n        {"type": "yields_rising", "confidence": 0.7, "anchor": "US10Y Weekly Low", "timeframe": "WEEKLY"}\n      ],\n      "references": ["CHUNK_ID:..."],\n      "confidence": 0.8,\n      "notes": "Step-by-step reasoning for macro fact extraction"\n    }`,
    buildInputContext: (input) => "Cross-asset Macro Fact Extraction (EURUSD, DXY, US10Y, US20Y)",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd?.m, "HTF-EURUSD-M", callId);
      pushImage(parts, input.eurusd?.w, "HTF-EURUSD-W", callId);
      pushImage(parts, input.eurusd?.d, "HTF-EURUSD-D", callId);
      pushImage(parts, input.dxy?.m, "HTF-DXY-M", callId);
      pushImage(parts, input.dxy?.w, "HTF-DXY-W", callId);
      pushImage(parts, input.dxy?.d, "HTF-DXY-D", callId);
      pushImage(parts, input.us10y?.m, "HTF-US10Y-M", callId);
      pushImage(parts, input.us10y?.w, "HTF-US10Y-W", callId);
      pushImage(parts, input.us10y?.d, "HTF-US10Y-D", callId);
      pushImage(parts, input.us20y?.m, "HTF-US20Y-M", callId);
      pushImage(parts, input.us20y?.w, "HTF-US20Y-W", callId);
      pushImage(parts, input.us20y?.d, "HTF-US20Y-D", callId);
    },
    useGroundingVerification: true,
    schema: htfMacroOutputSchema,
    mapOutput: (result) => {
      return {
        confidence: result?.confidence || 0.1,
        reasoning: result?.notes || "No reasoning",
        facts: result?.facts || []
      };
    },
    fallback
  }, minimal_context);
}
