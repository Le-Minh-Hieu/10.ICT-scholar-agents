/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import { TimeAgentInput, TimeAgentOutput, TimeAgentOutputSchema } from "../../../../types/time-agent";
import { getNYTime, getICTSession, getNYDayOfWeek, isMarketOpen } from "../../../../shared/utils/time-utils";
import { HydrationContext } from "../../../../shared/contracts/context";

function buildDailyProfileContext(hydrationContext: HydrationContext): string {
  const dailyProfile = (hydrationContext as any)?.daily_profile;
  const weeklyProfile = (hydrationContext as any)?.weekly_profile ?? (hydrationContext as any)?.macro_profile;
  if (!dailyProfile && !weeklyProfile) return "";

  const catalysts = Array.isArray(dailyProfile?.todays_catalysts)
    ? dailyProfile.todays_catalysts.slice(0, 5).map((event: any) => `${event?.market_time_hhmm || "time?"} ${event?.title} (${event?.impact || "UNKNOWN"})`).join("; ")
    : "";
  const conditions = Array.isArray(dailyProfile?.liquidity_expectations?.expected_conditions)
    ? dailyProfile.liquidity_expectations.expected_conditions.join(", ")
    : "";
  const windows = Array.isArray(dailyProfile?.liquidity_expectations?.high_attention_windows)
    ? dailyProfile.liquidity_expectations.high_attention_windows.join(", ")
    : "";
  const cautions = Array.isArray(dailyProfile?.intraday_awareness?.caution_flags)
    ? dailyProfile.intraday_awareness.caution_flags.slice(0, 3).join("; ")
    : "";

  return `
         DAILY NEWS PROFILE:
         - Market Date: ${dailyProfile?.market_date ?? "unknown"}
         - Market Weekday: ${dailyProfile?.market_weekday ?? "unknown"}
         - Day Type: ${dailyProfile?.day_type ?? "unknown"}
         - Day Role In Week: ${dailyProfile?.day_role_in_week ?? "unknown"}
         - Weekly Alignment State: ${dailyProfile?.weekly_alignment_state ?? "unknown"}
         - Dominant Weekly Theme: ${dailyProfile?.dominant_weekly_theme ?? weeklyProfile?.dominant_theme ?? "unknown"}
         - Dominant Weekly Narrative: ${dailyProfile?.dominant_weekly_narrative ?? weeklyProfile?.dominant_narrative ?? "unknown"}
         - Weekly Delivery Model: ${dailyProfile?.weekly_delivery_model ?? weeklyProfile?.weekly_delivery_model?.model ?? "unknown"}
         - Expected Expansion Day: ${dailyProfile?.expected_expansion_day ?? weeklyProfile?.weekly_delivery_model?.expected_expansion_day ?? "unknown"}
         - Today's Catalysts: ${catalysts || "none"}
         - Liquidity Conditions: ${conditions || "unknown"}
         - High Attention Windows: ${windows || "none"}
         - Session Focus: ${dailyProfile?.intraday_awareness?.session_focus ?? "unknown"}
         - Execution Risk: ${dailyProfile?.intraday_awareness?.execution_risk_context ?? "unknown"}
         - Caution Flags: ${cautions || "none"}
  `;
}
/**
 * Daily Time Analysis Agent
 * Standardized using runBaseAgent
 */
export async function dailyAgent(
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
      agentName: "Daily-Agent",
      pipelinePath: "data/time_pipeline.json",
      layer: "time",
      step: "daily_time",
      schema: TimeAgentOutputSchema,
      role: "You are an ICT Time Analysis Agent.",
      task: "Analyze the daily time-based market environment using grounded knowledge, chart images, and provided time context.",
      constraints: [
        "Analyze the provided 3 timeframes.",

        "ROLE FOCUS: If supported, identify daily profile and intraday timing behavior (e.g., expansion, reversal, consolidation).",

        "You MUST use grounded knowledge to identify daily timing concepts (e.g., daily profiles, session behavior, expansion patterns).",
        "You MUST extract principles from grounded knowledge before applying them.",
        "You MUST map those principles onto the current chart context using the provided TIME CONTEXT.",
        "Your analysis MUST be derived from grounded knowledge FIRST, then validated using chart evidence.",

        "DO NOT use structure logic (BOS, MSS, etc.)",
        "DO NOT use liquidity logic (Sweeps, Stop Hunts)",
        "DO NOT rely on intuition or assumptions.",
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
        const session = getICTSession(now);
        const dayOfWeek = getNYDayOfWeek(now);
        const marketOpen = isMarketOpen(now);

        return `
         TIME CONTEXT (NY TIME):
         - NY Time: ${nyTime}
         - Day of Week: ${dayOfWeek}
         - Session: ${session}
         - Market Status: ${marketOpen ? 'OPEN' : 'CLOSED'}

         ${buildDailyProfileContext(hydrationContext)}

         Task: Daily Time Analysis
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
      fallback,
    },
    hydrationContext
  );
}
