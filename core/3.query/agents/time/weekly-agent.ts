/// <reference types="node" />
import "dotenv/config";
import { runBaseAgent, pushImage } from "../shared/base-agent";
import { TimeAgentInput, TimeAgentOutput, TimeAgentOutputSchema } from "../../../../types/time-agent";
import { getNYDayOfWeek, isMarketOpen, getNYTime } from "../../../../shared/utils/time-utils";
import { HydrationContext } from "../../../../shared/contracts/context";

function buildWeeklyProfileContext(hydrationContext: HydrationContext): string {
  const weeklyProfile = (hydrationContext as any)?.weekly_profile ?? (hydrationContext as any)?.macro_profile;
  if (!weeklyProfile) return "";

  const storyArc = Array.isArray(weeklyProfile?.weekly_story_arc)
    ? weeklyProfile.weekly_story_arc.slice(0, 5).map((item: any) => `${item?.day}: ${item?.role}`).join("; ")
    : "";
  const activeEvents = Array.isArray(weeklyProfile?.active_events)
    ? weeklyProfile.active_events.slice(0, 5).map((event: any) => `${event?.title || event?.id} (${event?.impact || "UNKNOWN"})`).join("; ")
    : "";
  const timeline = Array.isArray(weeklyProfile?.macro_timeline)
    ? weeklyProfile.macro_timeline.slice(0, 5).map((item: any) => `${item?.date}: ${item?.catalyst} -> ${item?.expected_effect}`).join("; ")
    : "";

  return `
        WEEKLY NEWS PROFILE:
        - Week Start: ${weeklyProfile?.week_start ?? "unknown"}
        - Week Type: ${weeklyProfile?.week_type ?? "unknown"}
        - Primary Drivers: ${Array.isArray(weeklyProfile?.primary_drivers) ? weeklyProfile.primary_drivers.join(", ") : "unknown"}
        - Volatility Expectation: ${weeklyProfile?.volatility_expectation ?? "unknown"}
        - Macro Bias: ${weeklyProfile?.macro_bias ?? "unknown"}
        - Dominant Theme: ${weeklyProfile?.dominant_theme ?? "unknown"}
        - Dominant Narrative: ${weeklyProfile?.dominant_narrative ?? "unknown"}
        - Weekly Delivery Model: ${weeklyProfile?.weekly_delivery_model?.model ?? "unknown"}
        - Weekly Story Arc: ${storyArc || "unknown"}
        - Active Events: ${activeEvents || "none"}
        - Macro Timeline: ${timeline || "none"}
        - Regime: Volatility=${weeklyProfile?.regime?.volatility ?? "unknown"}, Liquidity=${weeklyProfile?.regime?.liquidity ?? "unknown"}, Alignment=${weeklyProfile?.regime?.macro_alignment ?? "unknown"}
  `;
}

/**
 * Weekly Time Analysis Agent
 * Standardized using runBaseAgent
 */
export async function weeklyAgent(
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
      agentName: "Weekly-Agent",
      pipelinePath: "data/time_pipeline.json",
      layer: "time",
      step: "weekly_time",
      schema: TimeAgentOutputSchema,
    role: "You are an ICT Time Analysis Agent specializing in Weekly profile analysis.",
    task: "Analyze the weekly time-based market environment using grounded knowledge, chart images, and provided time context.",
    constraints: [
      "Analyze the provided 3 timeframes.",

      "ROLE FOCUS: If supported, identify the weekly profile, day-of-week behavior, and intra-week timing patterns.",

      "You MUST use grounded knowledge to identify weekly timing concepts (e.g., weekly profiles, Monday/Friday behavior, expansion patterns).",
      "You MUST extract principles from grounded knowledge before applying them.",
      "You MUST map those principles onto the current chart context using the provided TIME CONTEXT.",
      "Your analysis MUST be derived from grounded knowledge FIRST, then validated using chart evidence.",

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
      const dayOfWeek = getNYDayOfWeek(now);
      const marketOpen = isMarketOpen(now);
      const weekOfMonth = Math.ceil(new Date(nyTime).getDate() / 7);

      return `
        TIME CONTEXT (NY TIME):
        - NY Time: ${nyTime}
        - Day of Week: ${dayOfWeek}
        - Week of Month: W${weekOfMonth}
        - Market Status: ${marketOpen ? 'OPEN' : 'CLOSED'}

        ${buildWeeklyProfileContext(hydrationContext)}

        Task: Weekly Time Analysis
        `;
    },
    pushImages: (parts, input, callId) => {
      pushImage(parts, input.eurusd.tf1!, "Time-TF1", callId);
      pushImage(parts, input.eurusd.tf2!, "Time-TF2", callId);
      pushImage(parts, input.eurusd.tf3!, "Time-TF3", callId);
    },
    visionPrompt: `Analyze ALL attached chart images for LIVE ICT weekly time-based observations.

Focus on weekly profiles and day-of-week timing:
1. **Weekly Open Range Timing**: Identify the high/low range established during the first 24 hours of the week starting Monday. (TIME)
2. **New Week Opening Gap (NWOG) Status**: State if the NWOG is open, partially filled, or completely filled. (TIME)
3. **Intra-Week Volatility Windows**: Note the timing of daily range expansions (Monday/Tuesday manipulation vs Wednesday/Thursday expansion). (TIME)
4. **Weekly Range Boundaries**: Reference the boundaries of the weekly range and equilibrium levels. (PRICE)
5. **Daily FVG Reference**: Note daily FVGs price is currently interacting with as secondary draw. (PRICE)

Output observations as bullet points. Do NOT use the phrases 'Weekly Bias', 'Weekly Buy Day Bias', 'Weekly Sell Day Bias', or 'Weekend Effect' in observations.`,
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
