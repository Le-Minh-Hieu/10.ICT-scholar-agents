import MacroContextStore from "../macro-context.js";
import DailyContextStore from "../daily-context.js";
import { trace } from "../trace-utils.js";

export async function getLatestMacroHydration() {
  const weeks = await MacroContextStore.listProfiles();
  if (!weeks || weeks.length === 0) {
    trace('MACRO_HYDRATION_TRACE', 'NO_WEEKLY_PROFILE_FOUND', {});
    return null;
  }
  const latest = weeks.sort().slice(-1)[0];
  const profile = await MacroContextStore.load(latest);
  if (!profile) {
    trace('MACRO_HYDRATION_TRACE', 'HYDRATION_EMPTY', { week: latest });
    return null;
  }

  // Expose a compact hydration payload suitable for master orchestrator hydration
  const payload = {
    week_start: profile.week_start,
    regime: profile.regime,
    narrative_state: profile.narrative_state,
    narrative_scope: profile.narrative_scope,
    narrative_as_of: profile.narrative_as_of,
    narrative_event_category: profile.narrative_event_category,
    macro_bias: profile.macro_bias,
    macro_ire: profile.macro_ire || null,
    retrieval_queries: profile.retrieval_queries || [],
    macro_themes: profile.macro_themes || [],
    macro_timeline: profile.macro_timeline || [],
    weekly_delivery_model:
      profile.weekly_delivery_model || {},

    daily_delivery_model:
      profile.daily_delivery_model || {},

    intraday_expectations:
      profile.intraday_expectations || {},
    narrative_confidence: profile.narrative_confidence,
    active_events: profile.active_events,
    price_validation: (profile as any).price_validation || null,
    adaptation_history: profile.adaptation_history || [],
    narrative_history: profile.narrative_history || [],
    confidence_evolution: profile.confidence_evolution || [],
    primary_drivers: profile.primary_drivers || [],
    week_type: profile.week_type || "GENERIC",
  };

  trace('MACRO_HYDRATION_TRACE', 'Loaded macro profile for hydration', { week: profile.week_start, active_events: payload.active_events.length, adaptation_entries: payload.adaptation_history.length });

  // propagation trace for downstream consumers
  trace('MACRO_CONTEXT_PROPAGATION', 'Hydration payload ready', { week: profile.week_start, keys: Object.keys(payload) });

  return payload;
}

export async function getLatestDailyHydration() {
  const profile = await DailyContextStore.getLatestProfile();
  if (!profile) {
    trace('MACRO_HYDRATION_TRACE', 'NO_DAILY_PROFILE_FOUND', {});
    return null;
  }

  const payload = {
    profile_date_utc: profile.profile_date_utc,
    market_date: profile.market_date,
    market_weekday: profile.market_weekday,
    market_timezone: profile.market_timezone,
    day_type: profile.day_type,
    day_confidence: profile.day_confidence,
    day_role_in_week: profile.day_role_in_week,
    weekly_alignment_state: profile.weekly_alignment_state,
    todays_catalysts: profile.todays_catalysts,
    liquidity_expectations: profile.liquidity_expectations,
    retrieval_context: profile.retrieval_context,
    narrative_assessment: profile.narrative_assessment,
    intraday_awareness: profile.intraday_awareness,
    bridge_metadata: profile.bridge_metadata
  };

  trace('MACRO_HYDRATION_TRACE', 'Loaded daily profile for hydration', {
    market_date: profile.market_date,
    market_weekday: profile.market_weekday,
    catalyst_count: payload.todays_catalysts.length
  });

  return payload;
}

export async function getLatestNewsHydration() {
  const [latestWeeklyProfile, latestDailyProfile] = await Promise.all([
    getLatestMacroHydration(),
    getLatestDailyHydration()
  ]);

  trace('MACRO_CONTEXT_PROPAGATION', 'News hydration payload ready', {
    hasWeekly: !!latestWeeklyProfile,
    hasDaily: !!latestDailyProfile
  });

  return {
    latestWeeklyProfile,
    latestDailyProfile
  };
}

export default getLatestMacroHydration;
