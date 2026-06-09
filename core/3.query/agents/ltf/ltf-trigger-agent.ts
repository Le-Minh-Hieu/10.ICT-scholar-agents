/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import {
  LTFTriggerInput,
  LTFTriggerOutput,
  ltfTriggerOutputSchema,
} from "../../../../shared/contracts/ltf/trigger";
import { Confidence } from "../../../../shared/contracts/pmso";
export type { LTFTriggerInput, LTFTriggerOutput } from "../../../../shared/contracts/ltf/trigger";
export { ltfTriggerOutputSchema } from "../../../../shared/contracts/ltf/trigger";

/**
 * LTF Trigger Agent
 * Standardized using runBaseAgent
 */
export async function ltfTriggerAgent(input: LTFTriggerInput, minimal_context: any): Promise<LTFTriggerOutput> {
  const fallback: LTFTriggerOutput = {
    confidence: 0.1,
    execute: false,
    direction: "neutral",
    entry: "none",
    confluence_score: 0,
    // notes: "No valid setup",
    reasoning: "No valid setup",
    entry_price: 0,
    stop_loss: 0,
    take_profit: 0,
  };

  if (!input.htf) {
    throw new Error("[LTF-TRIGGER] Missing HTF context in input.");
  }
  if (!input.itf) {
    throw new Error("[LTF-TRIGGER] Missing ITF context in input.");
  }
  if (!input.structure) {
    throw new Error("[LTF-TRIGGER] Missing structure context in input.");
  }
  if (!input.liquidity) {
    throw new Error("[LTF-TRIGGER] Missing liquidity context in input.");
  }
  if (!input.pd_array) {
    throw new Error("[LTF-TRIGGER] Missing PD Array context in input.");
  }

  const result = await runBaseAgent<LTFTriggerInput, LTFTriggerOutput>(input, {
    agentName: "LTF-Trigger-Agent",
    pipelinePath: "data/ltf_pipeline.json",
    layer: "ltf",
    step: "trigger",
    role: "You are an ICT execution engine (final decision layer).",
    task: "Decide whether to execute a trade, the direction, and entry logic based on provided multi-timeframe and multi-agent context.",
    constraints: [
      // MARKET_DELIVERY_STATE_V1_CONSUMER
      // Context-only: the model must treat market_delivery_state as guidance/prior, not as a deterministic rule.
      (() => {
        const mds = (minimal_context as any)?.market_delivery_state ?? (minimal_context as any)?.hydrationContext?.market_delivery_state;
        if (!mds) return "MARKET DELIVERY STATE: <unavailable>";
        return [
          "MARKET DELIVERY STATE",
          `Regime: ${mds.regime ?? "unknown"}`,
          `Paradigm: ${mds.paradigm ?? "unknown"}`,
          `MMXM Phase: ${mds.mmxm_phase ?? "unknown"}`,
          `Confidence: ${typeof mds.confidence === 'number' ? mds.confidence : 'unknown'}`,
          "Guidance:",
          "* Treat this as contextual execution guidance.",
          "* Treat this as a prior, not a rule.",
          "* Do NOT override structure/liquidity/pd-array evidence.",
          "* If delivery state aligns with evidence, confidence may increase.",
          "* If delivery state conflicts with evidence, prefer actual evidence and reduce confidence.",
        ].join("\n");
      })(),

      "MANDATORY REASONING ORDER: 1. Apply HTF + ITF context to grounded knowledge, 2. Structure alignment, 3. Liquidity, 4. PD Array, 5. Confluence scoring",
      "HTF CONTEXT: " + JSON.stringify({ ...input.htf, confidence: input.htf.confidence }),
      "ITF CONTEXT: " + JSON.stringify(input.itf),
      "LTF STRUCTURE: " + JSON.stringify(input.structure),
      "LTF LIQUIDITY: " + JSON.stringify(input.liquidity),
      "LTF PD ARRAY: " + JSON.stringify(input.pd_array),
      "MUST align HTF + ITF",
      "MUST use structure + liquidity + pd_array",
      "SCORING: 3 factors aligned → score 3; 2 factors → score 2; <2 → no trade (execute=false)",
      "If low confluence → execute=false",
      "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
    ],
    outputFormat: `{\n      "principles": [{"rule": "...", "chunk_id": "..."}],\n      "execute": boolean,\n      "direction": "bullish | bearish | neutral",\n      "entry": "descriptive entry logic",\n      "entry_price": 1.12345,\n      "stop_loss": 1.12000,\n      "take_profit": 1.13000,\n      "confluence_score": number,\n      "confidence": 0.9,\n      "references": ["CHUNK_ID:..."],\n      "notes": "Step-by-step explanation"\n    }`,
    buildInputContext: (input) => "LTF Execution Trigger Analysis",
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.m15!, "LTF-EURUSD-M15", callId);
      pushImage(parts, input.eurusd.m5!, "LTF-EURUSD-M5", callId);
      pushImage(parts, input.eurusd.m1!, "LTF-EURUSD-M1", callId);
    },
    useGroundingVerification: true,
    schema: ltfTriggerOutputSchema,
    mapOutput: (result) => {
      return {
        confidence: result.confidence,
        reasoning: result.notes,
        execute: result.execute,
        direction: result.direction,
        entry: result.entry,
        entry_price: result.entry_price,
        stop_loss: result.stop_loss,
        take_profit: result.take_profit,
        confluence_score: result.confluence_score
      };
    },
    fallback
  }, minimal_context);
  const { _debug, ...rest } = result;
  return rest;
}
