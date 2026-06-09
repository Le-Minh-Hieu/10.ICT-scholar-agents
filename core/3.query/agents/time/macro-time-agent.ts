/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import { TimeAgentInput, TimeAgentOutput, TimeAgentOutputSchema } from "../../../../types/time-agent";
import { getNYTime, isMarketOpen } from "../../../../shared/utils/time-utils";
import { HydrationContext } from "../../../../shared/contracts/context";

/**
 * Macro Time Analysis Agent
 * Standardized using runBaseAgent
 */
export async function macroTimeAgent(
  input: TimeAgentInput,
  hydrationContext: HydrationContext
): Promise<TimeAgentOutput> {
  const fallback: TimeAgentOutput = {
    timing_bias: "neutral",
    trading_window: "inactive",
    expectation: "Consolidation",
    confidence: "low",
    notes: "No valid data",
  };

  if (!input?.eurusd?.tf1) return fallback;

  return runBaseAgent<TimeAgentInput, TimeAgentOutput>(
    input,
    {
      agentName: "Macro-Time-Agent",
      pipelinePath: "data/time_pipeline.json",
      layer: "time",
      step: "macro_time",
      schema: TimeAgentOutputSchema,
    role: "You are an ICT Time Analysis Agent.",
    task: "Analyze the macro time-based market regime using grounded knowledge, chart images, and NY time context.",
    constraints: [
      "Analyze the provided 3 timeframes.",

      "ROLE FOCUS: Identify macro market regime (e.g., expansion vs contraction, directional bias).",

      "You MUST use grounded knowledge to identify macro-level concepts (e.g., regime behavior, expansion cycles).",
      "You MUST extract principles from grounded knowledge before applying them.",
      "You MUST map those principles onto the current chart context using the provided TIME CONTEXT.",
      "Your analysis MUST be derived from grounded knowledge FIRST, then validated using chart evidence.",

      "DO NOT use structure logic or liquidity logic",
      "DO NOT rely on intuition.",
      "DO NOT ignore grounded knowledge.",
      "DO NOT generate entry signals"
    ],
    outputFormat: `{
      "timing_bias": "favorable | neutral | unfavorable",
      "trading_window": "active | inactive",
      "expectation": "Accumulation | Re-accumulation | Consolidation | Manipulation | Reversal | Expansion | Distribution | Re-distribution | Consolidation | Retracement",
      "confidence": "high | medium | low",
      "notes": "Step-by-step reasoning citing visual evidence."
    }`,
    buildInputContext: (input) => {
      const now = new Date();

      const nyTime = getNYTime(now);
      const marketOpen = isMarketOpen(now);
      const month = new Date(nyTime).toLocaleString("en-US", {
        month: "long",
        timeZone: 'America/New_York'
      });

      return `
        TIME CONTEXT (NY TIME):
        - NY Time: ${nyTime}
        - Month: ${month}
        - Market Status: ${marketOpen ? 'OPEN' : 'CLOSED'}

        Task: Macro Time Analysis
        `;
    },
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.tf1!, "Time-TF1", callId);
      pushImage(parts, input.eurusd.tf2!, "Time-TF2", callId);
      pushImage(parts, input.eurusd.tf3!, "Time-TF3", callId);
    },
    useGroundingVerification: false,
    mapOutput: (result) => {
      return {
        timing_bias: result?.timing_bias || "neutral",
        trading_window: result?.trading_window || "inactive",
          expectation: result?.expectation || "Consolidation",
        confidence: result?.confidence || "low",
        notes: result?.notes || "No reasoning"
      };
    },
      fallback
    },
    hydrationContext
  );
}
