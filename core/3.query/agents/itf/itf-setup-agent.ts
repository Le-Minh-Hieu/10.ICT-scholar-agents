/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  itfSetupOutputSchema,
  ITFSetupInput,
  ITFSetupOutput,
} from "../../../../shared/contracts/itf/setup";

/**
 * ITF Setup Agent
 * Standardized using runBaseAgent
 */
export async function itfSetupAgent(input: ITFSetupInput, minimal_context: any): Promise<ITFSetupOutput> {
  const fallback: ITFSetupOutput = {
    confidence: 0.1,
    setup_type: "none",
    entry_bias: "none",
    invalidation_hint: "no setup",
    // notes: "no valid setup",
    reasoning: "no valid setup"
  };

  if (!input?.eurusd?.h1) return fallback;

  const compactHTF = {
    htf_bias: input.htf?.htf_bias,
    next_candle_bias: input.htf?.next_candle_bias,
    confidence: input.htf?.confidence,
    reasoning: input.htf?.reasoning,
  };

  const compactITFStructure = {
    structure_trend: input.itf_structure?.structure_trend,
    structure_strength: input.itf_structure?.structure_strength,
    smt_signal: input.itf_structure?.smt_signal,
    reasoning: input.itf_structure?.reasoning,
  };

  const result = await runBaseAgent<ITFSetupInput, ITFSetupOutput>(input, {
    agentName: "ITF-Setup-Agent",
    pipelinePath: "data/itf_pipeline.json",
    layer: "itf",
    step: "setup",
    role: "You are an ICT ITF setup (entry) analysis system.",
    task: "Identify if a valid ICT setup (Liquidity sweep, Displacement, FVG, OTE zone interaction, MSS) is forming from chart data.",
    constraints: [
      "MANDATORY REASONING ORDER: 1. Extract Principles, 2. Apply to Chart (Events: Sweep, Displacement, FVG, OTE, MSS), 3. Identify Setup Conditions, 4. Derive Signals, 5. Compare with HTF + ITF, 6. Assign Confidence",
      "HTF CONTEXT (DIRECTIONAL CONSTRAINT): " +
      JSON.stringify(compactHTF),
      "ITF STRUCTURE (CURRENT STATE): " +
      JSON.stringify(compactITFStructure),
      "You MUST identify at least one specific price level from the chart before proceeding",
      "If aligned with HTF+ITF → continuation; If opposing → pullback or reversal",
      "If unclear → setup_type = 'none'",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{\n      "valid": boolean,\n      "setup_detected": boolean,\n      "setup_type": "continuation | pullback | reversal | none",\n      "direction": "bullish | bearish | neutral",\n      "entry_bias": "bullish | bearish | none",\n      "confidence": 0.9,\n      "invalidation_hint": "...",\n      "references": ["CHUNK_ID:..."],\n      "notes": "Step-by-step reasoning from chart → concept → decision"\n    }`,
    buildInputContext: (input) => "ITF Setup Analysis (H1 -> M15 -> M5)",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.h1!, "ITF-EURUSD-H1", callId);
      pushImage(parts, input.eurusd.m15!, "ITF-EURUSD-M15", callId);
      pushImage(parts, input.eurusd.m5!, "ITF-EURUSD-M5", callId);
    },
    useGroundingVerification: true,
    visionPrompt: `Analyze ALL attached chart images for LIVE ICT setup readiness and execution alignment on the execution timeframes (H1, M15, M5).

Focus strictly on evaluating the readiness and consequence of the setup, synthesizing the current market state rather than rediscovering raw building blocks (Do NOT focus on identifying isolated FVGs, MSS, or OTEs):
1. **Setup Alignment**: Evaluate if the intermediate structure and high timeframe bias are fully aligned. (SETUP)
2. **Liquidity Objective**: Observe if key liquidity pools (identified by the Liquidity agent) have been swept or if price has reached a clear liquidity objective (e.g. swept session high/low or HTF range liquidity). (SETUP)
3. **Structure Shift Confirmation**: Confirm if a market structure shift has actually occurred as a consequence of liquidity sweep, showing displacement. (SETUP)
4. **PD Zone Favorable Location**: Check if price is reacting from a high-value/favorable Premium/Discount array (e.g., deep discount for long, deep premium for short) to justify a trade. (SETUP)
5. **Execution Pattern Validation**: Verify if there is a valid execution pattern confirming the entry trigger (e.g. reaction/displacement off key zone). (SETUP)

Output your observations as objective synthesis points assessing setup readiness and alignment. Do NOT make trade recommendations.`,
    schema: itfSetupOutputSchema,
    mapOutput: (result) => {
      return {
        confidence: result.confidence,
        reasoning: result.notes,
        setup_type: result.setup_type,
        entry_bias: result.entry_bias,
        invalidation_hint: result.invalidation_hint
      };
    },
    fallback
  }, minimal_context);
  const { _debug, ...rest } = result;
  return rest;
}
