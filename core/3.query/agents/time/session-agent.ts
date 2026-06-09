/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import { TimeAgentInput, TimeAgentOutput, TimeAgentOutputSchema } from "../../../../types/time-agent";
import { getICTSession, getNYTime, getNYDayOfWeek, isMarketOpen } from "../../../../shared/utils/time-utils";
import { HydrationContext } from "../../../../shared/contracts/context";

function buildSessionProfileContext(hydrationContext: HydrationContext): string {
  const dailyProfile = (hydrationContext as any)?.daily_profile;
  const weeklyProfile = (hydrationContext as any)?.weekly_profile ?? (hydrationContext as any)?.macro_profile;
  if (!dailyProfile && !weeklyProfile) return "";

  const catalysts = Array.isArray(dailyProfile?.todays_catalysts)
    ? dailyProfile.todays_catalysts.slice(0, 5).map((event: any) => `${event?.market_time_hhmm || "time?"} ${event?.title} (${event?.impact || "UNKNOWN"}) [${Array.isArray(event?.killzone_tags) ? event.killzone_tags.join(", ") : ""}]`).join("; ")
    : "";
  const displacementWindows = Array.isArray(dailyProfile?.liquidity_expectations?.expected_displacement_windows)
    ? dailyProfile.liquidity_expectations.expected_displacement_windows.join(", ")
    : "";
  const reversalWindows = Array.isArray(dailyProfile?.liquidity_expectations?.expected_reversal_windows)
    ? dailyProfile.liquidity_expectations.expected_reversal_windows.join(", ")
    : "";

  return `
          SESSION NEWS PROFILE:
          - Day Type: ${dailyProfile?.day_type ?? "unknown"}
          - Day Role In Week: ${dailyProfile?.day_role_in_week ?? "unknown"}
          - Session Focus: ${dailyProfile?.intraday_awareness?.session_focus ?? "unknown"}
          - Catalyst Priorities: ${Array.isArray(dailyProfile?.intraday_awareness?.catalyst_priorities) ? dailyProfile.intraday_awareness.catalyst_priorities.join(", ") : "none"}
          - Today's Catalysts: ${catalysts || "none"}
          - High Attention Windows: ${Array.isArray(dailyProfile?.liquidity_expectations?.high_attention_windows) ? dailyProfile.liquidity_expectations.high_attention_windows.join(", ") : "none"}
          - Expected Displacement Windows: ${displacementWindows || "none"}
          - Expected Reversal Windows: ${reversalWindows || "none"}
          - Execution Risk: ${dailyProfile?.intraday_awareness?.execution_risk_context ?? "unknown"}
          - Weekly Narrative: ${dailyProfile?.dominant_weekly_narrative ?? weeklyProfile?.dominant_narrative ?? "unknown"}
  `;
}

/**
 * Session Time Analysis Agent
 * Standardized using runBaseAgent
 */
export async function sessionAgent(
  input: TimeAgentInput,
  hydrationContext: HydrationContext
): Promise<TimeAgentOutput> {
  const now = new Date();
  const session = getICTSession(now);
  const nyTime = getNYTime(now);
  const dayOfWeek = getNYDayOfWeek(now);
  const marketOpen = isMarketOpen(now);

  const fallback: TimeAgentOutput = {
    timing_bias: "neutral",
    trading_window: "inactive",
    expectation: "Consolidation",
    confidence: "low",
    notes: "No valid data",
  };

  return runBaseAgent<TimeAgentInput, TimeAgentOutput>(
    input,
    {
      agentName: "Session-Agent",
      pipelinePath: "data/time_pipeline.json",
      layer: "time",
      step: "session_time",
      schema: TimeAgentOutputSchema,
    role: "You are an ICT Time Analysis Agent specializing in Session timing.",
    task: "Analyze the session-based market environment using grounded knowledge, chart images, and NY time context.",
    constraints: [
      "Analyze the provided 3 timeframes applying the CURRENT TIME CONTEXT.",
      `CURRENT TIME CONTEXT: NY Time: ${nyTime}, Day of Week: ${dayOfWeek}, Session: ${session}, Market Status: ${marketOpen ? 'OPEN' : 'CLOSED'}`,

      "ROLE FOCUS: Identify session timing, killzones, and intraday behavior.",

      "You MUST use grounded knowledge to identify session-based concepts (e.g., killzones, NWOG, NDOG, session expansion behavior).",
      "You MUST extract principles from grounded knowledge before applying them.",
      "You MUST map those principles onto the current chart context using NY TIME.",
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
      "notes": "Include session info, NY time reasoning, and chart context observations."
    }`,
    buildInputContext: (input) => `
          TIME CONTEXT (NY TIME):
          - NY Time: ${nyTime}
          - Day of Week: ${dayOfWeek}
          - Session: ${session}
          - Market Status: ${marketOpen ? 'OPEN' : 'CLOSED'}

          ${buildSessionProfileContext(hydrationContext)}

          Task: Session Time Analysis
          `,
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
