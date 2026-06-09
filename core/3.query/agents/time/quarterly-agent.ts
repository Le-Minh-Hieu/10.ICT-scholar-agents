/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import { TimeAgentInput, TimeAgentOutput, TimeAgentOutputSchema } from "../../../../types/time-agent";
import { getNYTime, isMarketOpen } from "../../../../shared/utils/time-utils";
import { HydrationContext } from "../../../../shared/contracts/context";

/**
 * Quarterly Time Analysis Agent
 * Standardized using runBaseAgent
 */
export async function quarterlyAgent(
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
      agentName: "Quarterly-Agent",
      pipelinePath: "data/time_pipeline.json",
      layer: "time",
      step: "quarterly_time",
      schema: TimeAgentOutputSchema,
    role: "You are an ICT Time Analysis Agent.",
    task: "Analyze the quarterly market cycle using grounded knowledge, chart images, and NY time context.",
    constraints: [
      "Analyze the provided 3 timeframes.",

      "ROLE FOCUS: Identify swing cycle phases (accumulation, expansion, distribution, retracement).",

      "You MUST use grounded knowledge to identify macro cycle concepts.",
      "You MUST extract cycle behavior from grounded knowledge before applying it.",
      "You MUST map those cycle principles onto the current chart context using the provided TIME CONTEXT.",
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

      const nyDate = new Date(nyTime);
      const month = nyDate.getMonth() + 1;

      const quarter = Math.ceil(month / 3);
      const monthInQuarter = ((month - 1) % 3) + 1;

      return `
        TIME CONTEXT (NY TIME):
        - Quarter: Q${quarter}
        - Month in Quarter: M${monthInQuarter}
        - NY Time: ${nyTime}
        - Market Status: ${marketOpen ? 'OPEN' : 'CLOSED'}

        Task: Quarterly Time Analysis
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
