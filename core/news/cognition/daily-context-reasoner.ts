import { callLLM } from "../../../shared/utils/llm-utils.js";
import type { DailyBridgeContext, DailyContextProfile } from "../daily-context.js";
import { trace } from "../trace-utils.js";

function inferAlignmentState(bridge: DailyBridgeContext) {
  if (!bridge.today_role?.role) return "INSUFFICIENT_EVIDENCE" as const;
  if (!bridge.today_catalysts.length) return "TENSION" as const;

  if ((bridge.weekly_delivery_model?.expected_expansion_day || "") === bridge.market_weekday && bridge.today_catalysts.length > 0) {
    return "ALIGNED" as const;
  }
  return "ALIGNED" as const;
}

function buildFallbackProfile(bridge: DailyBridgeContext, retrieval: { queries: string[]; rag: any }): DailyContextProfile {
  const catalystTitles = bridge.today_catalysts.map((x) => x.title);
  const highAttentionWindows = Array.from(new Set(bridge.today_catalysts.flatMap((x) => x.killzone_tags || [])));
  const sessionFocus = Array.from(new Set(bridge.today_catalysts.flatMap((x) => x.session_tags || [])));
  const todayReversalWindows = Array.from(
    new Set(
      bridge.today_catalysts
        .map((x) => x.market_time_hhmm)
        .filter((x): x is string => Boolean(x))
    )
  );
  const alignmentState = inferAlignmentState(bridge);

  return {
    profile_date_utc: bridge.profile_date_utc,
    market_date: bridge.market_date,
    market_weekday: bridge.market_weekday,
    market_timezone: bridge.market_timezone,
    week_start_market_date: bridge.week_start,
    source_week_profile_id: bridge.week_start,
    calendar_bias: bridge.calendar_bias,
    daily_bias: bridge.daily_bias,
    day_type: catalystTitles.length ? "CATALYST_DRIVEN" : bridge.today_role?.role || "UNCLASSIFIED",
    day_confidence: catalystTitles.length ? 0.62 : 0.35,
    day_role_in_week: bridge.today_role?.role || "INSUFFICIENT_EVIDENCE",
    weekly_alignment_state: alignmentState,
    dominant_weekly_theme: bridge.dominant_theme || "INSUFFICIENT_EVIDENCE",
    dominant_weekly_narrative: bridge.dominant_narrative || "",
    weekly_delivery_model: bridge.weekly_delivery_model?.model || "INSUFFICIENT_EVIDENCE",
    expected_weekly_high_day: bridge.weekly_delivery_model?.expected_weekly_high_day || null,
    expected_weekly_low_day: bridge.weekly_delivery_model?.expected_weekly_low_day || null,
    expected_expansion_day: bridge.weekly_delivery_model?.expected_expansion_day || null,
    expected_distribution_day: bridge.weekly_delivery_model?.expected_distribution_day || null,
    todays_catalysts: bridge.today_catalysts.map((x) => ({
      ...x,
      catalyst_role: bridge.today_role?.role || "Catalyst Context",
      confidence: 0.6
    })),
    liquidity_expectations: {
      expected_conditions: catalystTitles.length ? ["event-driven repricing", "liquidity sensitivity around scheduled releases"] : ["routine liquidity conditions"],
      expected_liquidity_sequence: bridge.today_catalysts.map((x) => `${x.market_time_hhmm} ${x.title}`),
      high_attention_windows: highAttentionWindows,
      expected_displacement_windows: highAttentionWindows.filter((x) => x.includes("killzone") || x.includes("0830") || x.includes("1000")),
      expected_reversal_windows: todayReversalWindows
    },
    retrieval_context: {
      retrieval_intents: bridge.retrieval_intents,
      queries: retrieval.queries || [],
      retrieved_chunk_ids: (retrieval.rag?.chunks || []).map((x: any) => String(x.chunk_id)),
      supporting_concepts: (retrieval.rag?.chunks || []).slice(0, 6).map((x: any, i: number) => ({
        concept: String(x?.text || "").replace(/\s+/g, " ").slice(0, 80),
        chunk_id: String(x.chunk_id),
        relevance: Math.max(0.2, 1 - i * 0.1)
      }))
    },
    narrative_assessment: {
      daily_thesis: catalystTitles.length
        ? `${bridge.market_weekday} is expected to express ${bridge.today_role?.role || "a catalyst-driven role"} through ${catalystTitles.join(", ")}.`
        : `${bridge.market_weekday} has limited catalyst structure and should be interpreted through the weekly role.`,
      key_if_then_paths: catalystTitles.length
        ? [`If ${catalystTitles[0]} drives displacement, monitor whether it confirms ${bridge.today_role?.role || "the weekly role"}.`]
        : ["If no major catalyst materializes, rely on weekly role context rather than event-driven repricing."],
      invalidation_conditions: bridge.weekly_delivery_model?.expected_weekly_low_day
        ? [`If ${bridge.market_weekday} fails to behave like the expected ${bridge.weekly_delivery_model.expected_weekly_low_day} structure, downgrade alignment.`]
        : ["If retrieved context does not support the current day role, treat the profile as low confidence."]
    },
    intraday_awareness: {
      session_focus: sessionFocus,
      catalyst_priorities: catalystTitles,
      caution_flags: [
        ...bridge.today_catalysts.flatMap((x) => x.killzone_tags || []),
        ...(catalystTitles.length > 1 ? ["clustered_catalysts"] : [])
      ],
      execution_risk_context: catalystTitles.length ? "Heightened around scheduled macro windows." : "Moderate; limited catalyst density."
    },
    bridge_metadata: {
      generated_at_utc: new Date().toISOString(),
      generated_from_weekly_fields: [
        "dominant_theme",
        "dominant_narrative",
        "weekly_delivery_model",
        "weekly_story_arc",
        "macro_timeline",
        "calendar_bias"
      ],
      timezone_policy: "UTC storage, America/New_York market-day semantics"
    }
  };
}

export async function reasonAboutDay(
  bridge: DailyBridgeContext,
  retrieval: { queries: string[]; rag: any }
): Promise<DailyContextProfile> {
  const fallback = buildFallbackProfile(bridge, retrieval);
  const prompt = `
You are an ICT Daily Context Analyst operating inside a NEWS-only system.

Bridge:
${JSON.stringify({
    market_date: bridge.market_date,
    market_weekday: bridge.market_weekday,
    dominant_theme: bridge.dominant_theme,
    dominant_narrative: bridge.dominant_narrative,
    weekly_delivery_model: bridge.weekly_delivery_model,
    today_role: bridge.today_role,
    today_catalysts: bridge.today_catalysts,
    weekly_calendar_bias: bridge.calendar_bias,
    daily_bias: bridge.daily_bias
  }, null, 2)}

Retrieved Chunks (supporting evidence only; must NOT be used to infer direction):
${JSON.stringify((retrieval.rag?.chunks || []).slice(0, 12).map((x: any) => ({
    chunk_id: x.chunk_id,
    text: String(x.text || "").slice(0, 280)
  })), null, 2)}

Rules:
- weekly_calendar_bias is the strategic context.
- daily_bias is the primary daily directional anchor.
- Do NOT infer or change direction based on retrieved chunks.
- Use retrieved chunks only to explain/justify the already-anchored direction and to describe day-structure/liquidity expectations.

Return JSON only with:
- day_type
- day_confidence
- weekly_alignment_state
- liquidity_expectations
- daily_thesis
- key_if_then_paths
- invalidation_conditions
- session_focus
- caution_flags
- execution_risk_context
- supporting_concepts [{ concept, chunk_id, relevance }]

Stay NEWS-only.
Do not include execution signals, entries, risk management, MSS, or FVG logic.
`;


  try {
    const raw = await callLLM(
      prompt,
      "Daily-Context-Reasoner",
      bridge.market_date,
      [{ text: prompt }],
      { responseType: "json" }
    );
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw || {};

    const profile: DailyContextProfile = {
      ...fallback,
      day_type: parsed.day_type || fallback.day_type,
      day_confidence: Number(parsed.day_confidence ?? fallback.day_confidence),
      weekly_alignment_state: parsed.weekly_alignment_state || fallback.weekly_alignment_state,
      liquidity_expectations: {
        expected_conditions: parsed?.liquidity_expectations?.expected_conditions || fallback.liquidity_expectations.expected_conditions,
        expected_liquidity_sequence: parsed?.liquidity_expectations?.expected_liquidity_sequence || fallback.liquidity_expectations.expected_liquidity_sequence,
        high_attention_windows: parsed?.liquidity_expectations?.high_attention_windows || fallback.liquidity_expectations.high_attention_windows,
        expected_displacement_windows: parsed?.liquidity_expectations?.expected_displacement_windows || fallback.liquidity_expectations.expected_displacement_windows,
        expected_reversal_windows: parsed?.liquidity_expectations?.expected_reversal_windows || fallback.liquidity_expectations.expected_reversal_windows
      },
      retrieval_context: {
        ...fallback.retrieval_context,
        supporting_concepts: Array.isArray(parsed.supporting_concepts) && parsed.supporting_concepts.length
          ? parsed.supporting_concepts.map((x: any) => ({
            concept: String(x.concept || ""),
            chunk_id: String(x.chunk_id || ""),
            relevance: Number(x.relevance || 0)
          })).filter((x: any) => x.concept && x.chunk_id)
          : fallback.retrieval_context.supporting_concepts
      },
      narrative_assessment: {
        daily_thesis: parsed.daily_thesis || fallback.narrative_assessment.daily_thesis,
        key_if_then_paths: parsed.key_if_then_paths || fallback.narrative_assessment.key_if_then_paths,
        invalidation_conditions: parsed.invalidation_conditions || fallback.narrative_assessment.invalidation_conditions
      },
      intraday_awareness: {
        session_focus: parsed.session_focus || fallback.intraday_awareness.session_focus,
        catalyst_priorities: fallback.intraday_awareness.catalyst_priorities,
        caution_flags: parsed.caution_flags || fallback.intraday_awareness.caution_flags,
        execution_risk_context: parsed.execution_risk_context || fallback.intraday_awareness.execution_risk_context
      }
    };

    trace("DAILY_REASONER", "Daily reasoning complete", {
      market_date: profile.market_date,
      market_weekday: profile.market_weekday,
      day_type: profile.day_type,
      day_role: profile.day_role_in_week,
      catalyst_count: profile.todays_catalysts.length
    });
    console.log("[DAILY_REASONER]", JSON.stringify({
      market_date: profile.market_date,
      market_weekday: profile.market_weekday,
      day_type: profile.day_type,
      selected_day_role: profile.day_role_in_week,
      retrieved_chunks_count: profile.retrieval_context.retrieved_chunk_ids.length
    }));
    return profile;
  } catch (err) {
    trace("DAILY_REASONER", "Daily reasoning fallback", {
      market_date: fallback.market_date,
      error: String(err)
    }, "WARN");
    console.log("[DAILY_REASONER]", JSON.stringify({
      market_date: fallback.market_date,
      market_weekday: fallback.market_weekday,
      fallback: true
    }));
    return fallback;
  }
}

export default reasonAboutDay;

