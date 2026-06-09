import { MacroCalendarStore } from "../calendar/macro-calendar-state.js";
import MacroContextStore from "../macro-context.js";
import { stagingEventStore } from "../staging/staging-event-store.js";
import { retrieveForMacroProfile } from "./macro-retrieval-adapter.js";
import { synthesizeNarrative } from "./macro-narrative-engine.js";
import { validatePrice } from "./macro-validation.js";
import { adaptProfile } from "./macro-adaptation.js";
import { log } from "../../../shared/utils/logger.js";
import { trace } from "../trace-utils.js";
import synthesizeTimeline from "./timeline-synthesizer.js";
import reasonAboutWeek from "./weekly-macro-reasoner.js";
import { deriveMarketTimeContext, enrichWithMarketTime } from "./daily-context-temporal.js";
import {
  calendarBiasEngine
} from "./calendar-bias-engine.js";
export async function buildWeeklyProfile(weekStartIso?: string, opts?: { priceSnapshot?: any; pmso?: any }) {
  trace('MACRO_PROFILE_TRACE', 'BUILD_START', { requested_week: weekStartIso || null });

  // Load canonical week
  let weekState = null as any;
  if (weekStartIso) {
    weekState = await MacroCalendarStore.load(weekStartIso);
  } else {
    weekState = await MacroCalendarStore.getLatestWeek();
  }

  if (!weekState) {
    trace('MACRO_PROFILE_TRACE', 'NO_WEEKLY_PROFILE_FOUND', {});
    log({ stage: 'WEEKLY_PROFILE_ABORT', message: 'No macro calendar week available to build profile' });
    return null;
  }

  const weekStart = weekState.week_start || weekStartIso || new Date().toISOString();

  const ALLOWED_CURRENCIES =
    new Set([
      "USD",
      "EUR",
      "GBP"
    ]);

  const events =
    ((weekState.events || []) as any[])
      .filter((e: any) =>
        ALLOWED_CURRENCIES.has(
          String(e.currency || "")
            .toUpperCase()
        )
      )
      .map((e: any) => enrichWithMarketTime(e));
  console.log(
    '[PROFILE_FIRST_20]',
    events
      .slice(0, 20)
      .map(e => ({
        title: e.name,
        impact: e.impact,
        currency: e.currency,
        scheduled: e.scheduled_time
      }))
  );
  console.log(
    '[WEEK_EVENTS_BY_IMPACT]',
    {
      HIGH: events.filter(
        e => e.impact === 'HIGH'
      ).length,

      MEDIUM: events.filter(
        e => e.impact === 'MEDIUM'
      ).length,

      LOW: events.filter(
        e => e.impact === 'LOW'
      ).length
    }
  );
  trace(
    'MACRO_PROFILE_TRACE',
    'WEEK_EVENTS_LOADED',
    {
      week: weekStart,
      events_count: events.length,
      currencies: ["USD", "EUR", "GBP"]
    }
  );

  const calendarBias =
    calendarBiasEngine(events);

  console.log(
    "[CALENDAR_BIAS]",
    JSON.stringify(calendarBias, null, 2)
  );

  trace(
    "CALENDAR_BIAS",
    "CALENDAR_BIAS_GENERATED",
    {
      weekly_bias:
        calendarBias.weekly_bias,

      confidence:
        calendarBias.confidence
    }
  );

  // classify week type and primary drivers
  const cats = new Set<string>();
  const weekCategories = new Set<string>();

  for (const ev of events) {
    const category = String(ev.category || '').toUpperCase();

    if (category) {
      weekCategories.add(category);
      cats.add(category);
    }
  }

  let week_type = 'MULTI_THEME';

  if (weekCategories.size === 1) {
    week_type = Array.from(weekCategories)[0];
  }

  const primary_drivers = Array.from(cats).slice(0, 6);

  // volatility expectation heuristic
  const maxImpact = events.reduce((m, e) => {
    const impact = (e.impact || '').toString().toUpperCase();
    const score = impact === 'HIGH' ? 3 : impact === 'MEDIUM' ? 2 : 1;
    return Math.max(m, score);
  }, 1);

  const volatility_expectation = maxImpact >= 3 ? 'HIGH' : maxImpact === 2 ? 'MEDIUM' : 'LOW';

  trace('MACRO_PROFILE_TRACE', 'WEEK_CLASSIFIED', { week: weekStart, week_type, primary_drivers, volatility_expectation });
  console.log(
    '[WEEK_EVENTS_TOTAL]',
    events.length
  );

  console.log(
    '[LIFECYCLE_COUNTS]',
    {
      pre: events.filter(
        e => e.lifecycle_phase === 'PRE_EVENT'
      ).length,

      post: events.filter(
        e => e.lifecycle_phase === 'POST_EVENT'
      ).length,

      cooldown: events.filter(
        e => e.lifecycle_phase === 'COOLDOWN'
      ).length,

      undefined: events.filter(
        e => !e.lifecycle_phase
      ).length
    }
  );
  console.log(
    '[TOP_50_EVENTS]',
    events
      .slice(0, 50)
      .map(e => ({
        title: e.name,
        impact: e.impact,
        currency: e.currency,
        lifecycle: e.lifecycle_phase
      }))
  );
  const active_events = events.filter((e: any) => ['PRE_EVENT', 'POST_EVENT', 'COOLDOWN'].includes(e.lifecycle_phase || ''));
  console.log(
    '[ACTIVE_EVENTS]',
    active_events.map(e => ({
      title: e.name,
      impact: e.impact,
      lifecycle: e.lifecycle_phase
    }))
  );
  const impactScore = (impact?: string) => {
    const v = String(impact || '').toUpperCase();

    if (v === 'HIGH') return 3;
    if (v === 'MEDIUM') return 2;
    return 1;
  };

  const upcoming_events =
    events
      .filter(
        (e: any) =>
          !['PRE_EVENT', 'POST_EVENT', 'COOLDOWN']
            .includes(e.lifecycle_phase || '')
      )
      .sort((a: any, b: any) => {

        const impactDiff =
          impactScore(b.impact) -
          impactScore(a.impact);

        if (impactDiff !== 0) {
          return impactDiff;
        }

        return (
          new Date(a.scheduled_time).getTime() -
          new Date(b.scheduled_time).getTime()
        );
      })
      .slice(0, 50);

  // console.log(
  //   '[UPCOMING_AFTER_SORT]',
  //   upcoming_events.map((e: any) => ({
  //     title: e.name,
  //     impact: e.impact,
  //     currency: e.currency
  //   }))
  // );
  console.log(
    '[UPCOMING_IMPACT_COUNTS]',
    {
      HIGH:
        upcoming_events.filter(
          e => e.impact === 'HIGH'
        ).length,

      MEDIUM:
        upcoming_events.filter(
          e => e.impact === 'MEDIUM'
        ).length,

      LOW:
        upcoming_events.filter(
          e => e.impact === 'LOW'
        ).length
    }
  );

  const candidates =
    active_events.length
      ? active_events
      : upcoming_events;
  const baseProfile = {
    week_start: weekStart,
    week_type,
    primary_drivers,
    volatility_expectation,
    delivery_model: 'mixed',
    macro_bias: 'neutral',
    narrative_confidence: 0,
    active_events: active_events.map((e: any) => enrichWithMarketTime({ id: e.id, title: e.name || e.title, scheduled_time: e.scheduled_time, impact: e.impact })),
    upcoming_events: upcoming_events.map((e: any) => enrichWithMarketTime({ id: e.id, title: e.name || e.title, scheduled_time: e.scheduled_time, impact: e.impact })),
    retrieval_context: { expandedQueries: [] },
    narrative_state: '',
    narrative_scope: 'weekly_dominant',
    narrative_as_of: weekStart,
    narrative_event_category: '',
    macro_themes: [],
    macro_timeline: [],
    weekly_delivery_model: {
      expected_weekly_high_day: undefined,
      expected_weekly_low_day: undefined,
      expected_expansion_day: undefined,
      expected_distribution_day: undefined,
      weekly_path: {},
      confidence: 0
    },

    daily_delivery_model: {
      expected_day_type: undefined,
      expected_hod_session: undefined,
      expected_lod_session: undefined,
      expected_liquidity_sequence: [],
      confidence: 0
    },

    intraday_expectations: {
      current_session_bias: undefined,
      expected_next_liquidity_target: undefined,
      expected_displacement_window: [],
      expected_reversal_window: [],
      execution_risk: undefined,
      confidence_modifier: 0
    },
    retrieval_queries: [],
    regime: { volatility: 'MEDIUM', liquidity: 'STABLE', macro_alignment: 'NEUTRAL' },
    calendar_bias: calendarBias,
    narrative_history: []
  } as any;
  // console.log(
  //   '[RETRIEVAL_INPUT]',
  //   {
  //     active: active_events.length,
  //     upcoming: upcoming_events.length,
  //     first10: upcoming_events
  //       .slice(0, 10)
  //       .map(e => ({
  //         title: e.name,
  //         impact: e.impact
  //       }))
  //   }
  // );
  // retrieve supportive evidence using retrieval adapter
  const retrieval = await retrieveForMacroProfile(baseProfile, { pmso: opts?.pmso });

  if (!retrieval || !retrieval.rag || !retrieval.rag.chunks || retrieval.rag.chunks.length === 0) {
    trace('MACRO_RETRIEVAL_TRACE', 'EMPTY_RETRIEVAL_RESULT', { week: weekStart });
  }

  baseProfile.retrieval_context = { expandedQueries: retrieval.queries, top_chunks: (retrieval.rag?.chunks || []).slice(0, 50).map((c: any) => c.chunk_id) };
  baseProfile.retrieval_queries = retrieval.queries || [];
  const reasoningResult =
    await reasonAboutWeek({
      week_type,
      primary_drivers,

      active_events:
        baseProfile.active_events,

      upcoming_events:
        baseProfile.upcoming_events,

      retrieved_chunks:
        retrieval.rag.chunks || [],

      volatility_expectation,
      calendar_bias: calendarBias
    });
  console.log(
    "[WEEKLY_PROFILE_BUILDER_RETRIEVAL]",
    JSON.stringify({
      week: weekStart,
      retrieval_queries_count: (retrieval.queries || []).length,
      retrieval_chunks_count: (retrieval.rag?.chunks || []).length,
      persisted_top_chunks_count: (baseProfile.retrieval_context?.top_chunks || []).length,
      retrieval_chunk_ids: (retrieval.rag?.chunks || []).slice(0, 20).map((c: any) => c.chunk_id),
      persisted_top_chunk_ids: (baseProfile.retrieval_context?.top_chunks || []).slice(0, 20)
    })
  );
  trace(
    "MACRO_REASONING_TRACE",
    "WEEKLY_REASONING_COMPLETE",
    {
      week: weekStart,
      narrative:
        reasoningResult.dominant_theme,
      uncertainty:
        reasoningResult.uncertainty_pressure,
      volatility:
        reasoningResult.volatility_pressure
    }
  );
  const reasoningResults = [
    reasoningResult
  ];
  trace('MACRO_RETRIEVAL_TRACE', 'RETRIEVAL_CONTEXT_ATTACHED', { week: weekStart, query_count: retrieval.queries.length, top_chunks: baseProfile.retrieval_context.top_chunks });

  baseProfile.macro_themes = [
    {
      theme:
        reasoningResult.dominant_theme ||
        "INSUFFICIENT_EVIDENCE",

      confidence:
        reasoningResult.repricing_severity || 0.75,

      supporting_events: [
        "WEEKLY_PROFILE"
      ],

      supporting_evidence:
        (reasoningResult.evidence_summaries || [])
          .slice(0, 3)
          .map(
            (e: any) =>
              `- ${e.chunk_id}: ${e.summary}`
          )
    }
  ];

  baseProfile.narrative_event_category =
    baseProfile.macro_themes
      .map((t: any) => t.theme)
      .slice(0, 3)
      .join(",");

  if (!baseProfile.macro_themes.length) {
    baseProfile.macro_themes =
      primary_drivers.map((driver: string) => ({
        theme: driver,
        confidence: 0.5,
        supporting_events:
          candidates.map((e: any) => e.id)
      }));
  }

  const timelineEvents =
    [
      ...active_events,
      ...upcoming_events
    ].map((e: any) => ({
      ...e,
      title: e.title || e.name || e.id
    })).filter((e: any) => {

      const impact =
        String(e.impact || "")
          .toUpperCase();

      const title =
        String(
          e.title ||
          e.name ||
          ""
        ).toLowerCase();

      return (
        impact === "HIGH" ||
        impact === "MEDIUM" ||
        title.includes("holiday")
      );
    });
  console.log(
    '[TIMELINE_INPUT_SAMPLE]',
    timelineEvents.slice(0, 10).map(e => ({
      id: e.id,
      title: e.title,
      name: e.name,
      impact: e.impact
    }))
  );
  baseProfile.macro_timeline =
    await synthesizeTimeline(
      timelineEvents,
      reasoningResults,
      baseProfile.macro_themes
    );

  if (!baseProfile.macro_timeline.length) {
    baseProfile.macro_timeline = [
      ...active_events.map((e: any) => enrichWithMarketTime({
        date: e.scheduled_time,
        catalyst: e.title || e.id,
        expected_effect: "REPRICING",
        confidence: 0.5
      }, "date"))
    ];
  }
  baseProfile.macro_timeline =
    (baseProfile.macro_timeline || []).map((item: any) =>
      enrichWithMarketTime(item, "date")
    );
  const timelineDays =
    baseProfile.macro_timeline.map((t: any) =>
    (
      t.market_weekday ||
      deriveMarketTimeContext(t.date).market_weekday
    )
    );

  const allowedDays = new Set([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday"
  ]);

  const uniqueDays =
    [...new Set<string>(timelineDays)]
      .filter(day => allowedDays.has(day));

  baseProfile.weekly_delivery_model = {
    model:
      reasoningResult.weekly_delivery_model ||
      "INSUFFICIENT_EVIDENCE",

    expected_weekly_high_day:
      reasoningResult.expected_weekly_high_day,

    expected_weekly_low_day:
      reasoningResult.expected_weekly_low_day,

    expected_expansion_day:
      reasoningResult.expected_expansion_day,

    weekly_path: {},

    confidence:
      reasoningResult.weekly_delivery_model
        ? 0.75
        : 0.25
  };
  baseProfile.weekly_story_arc =
    Array.isArray(reasoningResult.weekly_story_arc)
      ? reasoningResult.weekly_story_arc.map((arc: any) => ({
        ...arc,
        market_timezone: "America/New_York"
      }))
      : [];

  baseProfile.dominant_theme =
    reasoningResult.dominant_theme || "";

  baseProfile.dominant_narrative =
    reasoningResult.dominant_narrative || "";
  console.log(
    "[WEEKLY_PROFILE_MERGE]",
    {
      story_arc_count:
        baseProfile.weekly_story_arc?.length || 0,

      dominant_theme:
        baseProfile.dominant_theme,

      dominant_narrative:
        baseProfile.dominant_narrative
    }
  );
  for (const day of uniqueDays) {
    (baseProfile.weekly_delivery_model.weekly_path as Record<string, string>)[day] =
      "PENDING_MODEL";
  }
  baseProfile.daily_delivery_model = {
    expected_day_type: "UNCLASSIFIED",

    expected_hod_session: undefined,

    expected_lod_session: undefined,

    expected_liquidity_sequence: [],

    confidence: 0.1
  };

  baseProfile.macro_timeline.sort(
    (a: any, b: any) =>
      new Date(a.date).getTime() -
      new Date(b.date).getTime()
  );
  // aggregate pressures
  const agg_uncertainty = reasoningResults.length ? (reasoningResults.reduce((a, b) => a + (b.uncertainty_pressure || 0), 0) / reasoningResults.length) : 0;
  const agg_vol = reasoningResults.length ? (reasoningResults.reduce((a, b) => a + (b.volatility_pressure || 0), 0) / reasoningResults.length) : 0;
  baseProfile.macro_ire = {
    avg_uncertainty: agg_uncertainty,
    avg_volatility: agg_vol,

    execution_risk:
      agg_vol > 0.7
        ? "HIGH"
        : agg_vol > 0.3
          ? "MEDIUM"
          : "LOW",

    liquidity_condition:
      agg_vol > 0.7
        ? "UNSTABLE"
        : "STABLE",

    confidence_modifier:
      -agg_uncertainty
  };
  baseProfile.intraday_expectations = {
    current_session_bias: undefined,

    expected_next_liquidity_target: undefined,

    expected_displacement_window: [],

    expected_reversal_window: [],

    execution_risk:
      baseProfile.macro_ire?.execution_risk,

    confidence_modifier:
      baseProfile.macro_ire?.confidence_modifier ?? 0
  };
  baseProfile.narrative_confidence = Math.max(0, 1 - agg_uncertainty);

  // synthesize narrative and regime
  const enriched = synthesizeNarrative(baseProfile, retrieval, reasoningResults);

  trace('MACRO_REASONING_TRACE', 'NARRATIVE_APPLIED', { week: weekStart, bias: enriched.macro_bias, narrative_confidence: enriched.narrative_confidence });

  // price validation (optional)
  if (opts?.priceSnapshot) {
    validatePrice(enriched, opts.priceSnapshot);
  }

  // adaptation: compare price vs narrative and adjust confidence/regime
  try {
    const adaptation = adaptProfile(enriched, reasoningResults);
    trace('MACRO_ADAPTATION_TRACE', 'Adaptation summary', { week: enriched.week_start, adaptation });
  } catch (e: any) {
    trace('MACRO_RUNTIME_ASSERT', 'ADAPTATION_FAILED', { week: enriched.week_start, error: String(e) });
  }

  await MacroContextStore.save(enriched);

  trace('MACRO_VALIDATION_TRACE', 'PROFILE_PERSISTED', { week: enriched.week_start });

  trace('MACRO_CONTEXT_FINAL', 'FINAL_CONTEXT', { week: enriched.week_start, week_type: enriched.week_type, macro_bias: enriched.macro_bias, narrative_confidence: enriched.narrative_confidence, active_events: enriched.active_events.length });

  log({ stage: 'WEEKLY_PROFILE_BUILT', message: 'Weekly macro profile built', data: { week: enriched.week_start, events: enriched.active_events.length } });

  return enriched;
}

export default buildWeeklyProfile;
