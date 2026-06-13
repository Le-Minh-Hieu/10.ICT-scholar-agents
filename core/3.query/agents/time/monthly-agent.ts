/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import { TimeAgentInput, TimeAgentOutput, TimeAgentOutputSchema } from "../../../../types/time-agent";
import { getNYTime, isMarketOpen } from "../../../../shared/utils/time-utils";
import { HydrationContext } from "../../../../shared/contracts/context";

/**
 * Monthly Time Analysis Agent
 * Standardized using runBaseAgent
 */
export async function monthlyAgent(
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
      agentName: "Monthly-Agent",
      pipelinePath: "data/time_pipeline.json",
      layer: "time",
      step: "monthly_time",
      schema: TimeAgentOutputSchema,
    role: "You are an ICT Time Analysis Agent.",
    task: "Analyze the monthly time-based market environment using grounded knowledge and chart images.",
    constraints: [
      "Analyze the provided 3 timeframes.",

      "ROLE FOCUS: If supported, identify relative positioning (e.g., premium/discount, monthly profiles, seasonal tendency).",

      "You MUST use grounded knowledge to identify relevant monthly concepts.",
      "You MUST extract principles from grounded knowledge before applying them.",
      "You MUST map those principles onto the current chart context.",
      "Your analysis MUST be derived from grounded knowledge FIRST, then validated using chart evidence.",

      "DO NOT rely on intuition or generic assumptions.",
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
      const month = nyDate.toLocaleString("en-US", { month: "long", timeZone: 'America/New_York' });
      const monthIndex = nyDate.getMonth() + 1;

      return `
      TIME CONTEXT (NY TIME):
      - NY Time: ${nyTime}
      - Month: ${month} (M${monthIndex})
      - Market Status: ${marketOpen ? 'OPEN' : 'CLOSED'}

      Task: Monthly Time Analysis
      `;
    },
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.tf1!, "Time-TF1", callId);
      pushImage(parts, input.eurusd.tf2!, "Time-TF2", callId);
      pushImage(parts, input.eurusd.tf3!, "Time-TF3", callId);
    },
    visionPrompt: `Analyze ALL attached chart images for LIVE ICT monthly time-based environment observations.

Focus on monthly cycles and seasonality:
1. **Turn-of-Month / End-of-Month Timing**: Identify if price is entering the Turn-of-Month window (last 3 days to first 3 days) or EOM window (last week). (TIME)
2. **Monthly Options Expiry Window**: Note if price is approaching the third Friday of the month options expiration week. (TIME)
3. **Monthly Seasonality Profile**: Observe if current month historically yields bearish or bullish expansions. (TIME)
4. **Monthly Opening Range**: Identify the high/low range of the first trading day of the month. (TIME)
5. **Monthly Dealing Range Reference**: Note if current price is in premium or discount relative to the monthly range. (PRICE)
6. **Weekly Order Block Reference**: Note key weekly order blocks acting as current resistance or support. (PRICE)

Output observations as bullet points. Do NOT use the phrases 'Monthly Bias', 'Monthly Seasonality', or 'Monthly Buy Day Bias' in observations.`,
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
