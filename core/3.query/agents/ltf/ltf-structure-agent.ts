/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  ltfStructureOutputSchema,
  LTFStructureInput,
  LTFStructureOutput,
} from "../../../../shared/contracts/ltf/structure";
import { normalizeConfidence } from "../../../../shared/utils/confidence-utils";

/**
 * LTF Structure Agent
 * Standardized using runBaseAgent
 */
export async function ltfStructureAgent(input: LTFStructureInput, minimal_context: any): Promise<LTFStructureOutput> {
  const fallback: LTFStructureOutput = {
    confidence: normalizeConfidence("low"),
    facts: [],
    reasoning: "No valid LTF structure data"
  };

  if (!input?.eurusd?.m15) return fallback;

  const result = await runBaseAgent<LTFStructureInput, LTFStructureOutput>(input, {
    agentName: "LTF-Structure-Agent",
    pipelinePath: "data/ltf_pipeline.json",
    layer: "ltf",
    step: "structure",
    role: "You are an ICT LTF structure FACT EXTRACTION system. Do NOT infer bias or probabilities.",
    task: "Identify ALL potential LTF market structure facts (MSS, CISD, Displacement, Sweeps). Analyze micro structure (M15 → M5 → M1) and output ONLY objective observations.",
    constraints: [
      "MANDATORY OUTPUT: An array of VisionFact objects for each detected element.",
      "Detect Market Structure Shifts (MSS) and Change in State of Delivery (CISD).",
      "Detect Displacement (strong moves) and Liquidity Sweeps.",
      "Detect LTF Fair Value Gaps (FVG).",
      "Assign a confidence score (0.0-1.0) to each fact based on visual clarity.",
      "Preserve AMBIGUITY: Use types like 'possible_mss', 'potential_sweep' if not 100% clear.",
      "DO NOT infer macro bias; focus ONLY on what is visible on the LTF charts.",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{\n      "principles": [{"rule": "...", "chunk_id": "..."}],\n      "facts": [\n        {"type": "possible_mss", "confidence": 0.75, "anchor": "M15 Swing High", "timeframe": "M15"},\n        {"type": "confirmed_fvg", "confidence": 0.95, "anchor": "M5 Displacement Gap", "timeframe": "M5"}\n      ],\n      "references": ["CHUNK_ID:..."],\n      "confidence": 0.7,\n      "notes": "Step-by-step reasoning for micro-fact extraction"\n    }`,
    buildInputContext: (input) => "LTF Structure Fact Extraction (M15 -> M5 -> M1)",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.m15!, "LTF-EURUSD-M15", callId);
      pushImage(parts, input.eurusd.m5!, "LTF-EURUSD-M5", callId);
      pushImage(parts, input.eurusd.m1!, "LTF-EURUSD-M1", callId);
    },
    useGroundingVerification: true,
    schema: ltfStructureOutputSchema,
    mapOutput: (result) => {
      const facts = result?.facts?.map((fact: any) => ({...fact, confidence: fact.confidence})) || [];
      return {
        confidence: result.confidence,
        reasoning: result.notes,
        facts: facts,
      };
    },
    fallback
  }, minimal_context);
  const { _debug, ...rest } = result;
  return rest;
}
