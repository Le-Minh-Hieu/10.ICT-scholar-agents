import type { MacroContextState } from "../macro-context.js";
import type { DailyBridgeContext, DailyBridgeCatalyst } from "../daily-context.js";
import { deriveMarketTimeContext, MARKET_TIMEZONE, enrichWithMarketTime } from "./daily-context-temporal.js";
import buildDailyContextQueries from "./daily-context-query-builder.js";
import { trace } from "../trace-utils.js";

import dailyBiasEngine from "./daily-bias-engine.js";



function normalizeCatalyst(input: any): DailyBridgeCatalyst {
  const scheduled_time_utc = String(input?.scheduled_time || input?.date || "");
  const market = deriveMarketTimeContext(scheduled_time_utc);
  return {
    event_id: String(input?.id || input?.event_id || input?.catalyst || "unknown"),
    title: String(input?.title || input?.name || input?.catalyst || input?.id || "Unknown Catalyst"),
    category: input?.category,
    impact: input?.impact,
    scheduled_time_utc,
    expected_effect: input?.expected_effect,
    ...market
  };
}

function mergeCatalystRecords(existing: DailyBridgeCatalyst | undefined, incoming: DailyBridgeCatalyst): DailyBridgeCatalyst {
  if (!existing) return incoming;

  return {
    ...incoming,
    ...existing,
    category: existing.category ?? incoming.category,
    impact: existing.impact ?? incoming.impact,
    expected_effect: existing.expected_effect ?? incoming.expected_effect,
    session_tags: Array.from(new Set([...(existing.session_tags || []), ...(incoming.session_tags || [])])),
    killzone_tags: Array.from(new Set([...(existing.killzone_tags || []), ...(incoming.killzone_tags || [])]))
  };
}

function deriveRetrievalIntents(weekly: MacroContextState, todayRole: string | undefined, catalysts: DailyBridgeCatalyst[]) {
  const intents = new Set<string>();
  if (todayRole) intents.add(`day_role:${todayRole}`);
  if (weekly.weekly_delivery_model?.model) intents.add(`weekly_model:${weekly.weekly_delivery_model.model}`);
  if (weekly.dominant_theme) intents.add(`dominant_theme:${weekly.dominant_theme}`);
  for (const catalyst of catalysts.slice(0, 3)) {
    if (catalyst.title) intents.add(`catalyst:${catalyst.title}`);
    if (catalyst.market_time_hhmm) intents.add(`time:${catalyst.market_time_hhmm}`);
    for (const tag of catalyst.killzone_tags || []) intents.add(`killzone:${tag}`);
  }
  return Array.from(intents);
}

export function buildDailyBridgeContext(
  weekly: MacroContextState,
  todayCalendarSlice: any[],

  opts?: { asOf?: string | Date }
): DailyBridgeContext {
  const asOfIso = opts?.asOf instanceof Date ? opts.asOf.toISOString() : typeof opts?.asOf === "string" ? opts.asOf : new Date().toISOString();
  const asOfMarket = deriveMarketTimeContext(asOfIso);
  const marketDate = todayCalendarSlice?.[0]?.market_date || asOfMarket.market_date;
  const marketWeekday = todayCalendarSlice?.[0]?.market_weekday || asOfMarket.market_weekday;
  const timeline = (weekly.macro_timeline || []).map((x: any) => enrichWithMarketTime(x, "date"));
  const todayRole = (weekly.weekly_story_arc || []).find((arc: any) => arc.day === marketWeekday) || null;
  const filteredTodaySlice =
    (todayCalendarSlice || []).filter(x => {
      const impact =
        String(x?.impact || "").toUpperCase();

      return (
        impact === "HIGH" ||
        impact === "MEDIUM"
      );
    });

  const todayCasts =
    filteredTodaySlice.map((item) => normalizeCatalyst(item));
  const sortedTimeline = timeline.slice().sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const todayTimeline = sortedTimeline.filter((x: any) => x.market_date === marketDate);
  const mergedCatalysts = [
    ...todayCasts,
    ...todayTimeline.map((x: any) => normalizeCatalyst({
      id: x.catalyst,
      title: x.catalyst,
      date: x.date,
      expected_effect: x.expected_effect
    }))
  ];

  const uniqueCatalystsMap =
    new Map<string, DailyBridgeCatalyst>();
  for (const catalyst of mergedCatalysts) {
    const key = `${catalyst.title.toLowerCase()}|${catalyst.scheduled_time_utc}`;
    const existing = uniqueCatalystsMap.get(key);
    uniqueCatalystsMap.set(key, mergeCatalystRecords(existing, catalyst));
  }
  const uniqueCatalysts = Array.from(
    uniqueCatalystsMap.values()
  ).sort((a, b) => new Date(a.scheduled_time_utc).getTime() - new Date(b.scheduled_time_utc).getTime());
  const selectedCatalysts =
    uniqueCatalysts.filter(x => {
      const impact =
        String(x.impact || "").toUpperCase();

      return (
        impact === "HIGH" ||
        impact === "MEDIUM" ||
        !x.impact
      );
    }).slice(0, 10);
  const allTimelineCatalysts = sortedTimeline.map((x: any) => normalizeCatalyst({
    id: x.catalyst,
    title: x.catalyst,
    date: x.date,
    expected_effect: x.expected_effect
  }));
  const firstTodayTs = uniqueCatalysts[0]?.scheduled_time_utc;
  const lastTodayTs = uniqueCatalysts[uniqueCatalysts.length - 1]?.scheduled_time_utc;
  const previous_catalyst =
    allTimelineCatalysts.filter((x) => firstTodayTs && new Date(x.scheduled_time_utc).getTime() < new Date(firstTodayTs).getTime()).slice(-1)[0] || null;
  const next_catalyst =
    allTimelineCatalysts.find((x) => lastTodayTs && new Date(x.scheduled_time_utc).getTime() > new Date(lastTodayTs).getTime()) || null;
  const retrieval_intents =
    deriveRetrievalIntents(
      weekly,
      todayRole?.role,
      selectedCatalysts
    );

  const daily_bias = dailyBiasEngine(
    (todayCalendarSlice || []) as any
  );


  const baseBridge: DailyBridgeContext = {
    profile_date_utc: asOfIso,
    market_date: marketDate,
    market_weekday: marketWeekday,
    market_timezone: MARKET_TIMEZONE,
    week_start: weekly.week_start,
    week_type: weekly.week_type,
    dominant_theme: weekly.dominant_theme,
    dominant_narrative: weekly.dominant_narrative,
    calendar_bias: (weekly as any).calendar_bias,
    daily_bias,
    weekly_delivery_model: weekly.weekly_delivery_model,

    today_role: todayRole
      ? { day: todayRole.day, role: todayRole.role, confidence: todayRole.confidence }
      : null,
    today_catalysts: selectedCatalysts,
    previous_catalyst,
    next_catalyst,
    retrieval_intents,
    query_candidates: [],
    timeline_context: todayTimeline.map((x: any) => ({
      catalyst: x.catalyst,
      date: x.date,
      expected_effect: x.expected_effect,
      market_timezone: x.market_timezone,
      market_date: x.market_date,
      market_weekday: x.market_weekday,
      market_time_hhmm: x.market_time_hhmm,
      session_tags: x.session_tags,
      killzone_tags: x.killzone_tags
    }))
  };

  baseBridge.query_candidates = buildDailyContextQueries(baseBridge);

  trace("DAILY_BRIDGE", "Built daily bridge context", {
    market_date: baseBridge.market_date,
    market_weekday: baseBridge.market_weekday,
    role: baseBridge.today_role?.role || null,
    catalysts: baseBridge.today_catalysts.map((x) => x.title),
    query_count: baseBridge.query_candidates.length
  });
  console.log("[DAILY_BRIDGE]", JSON.stringify({
    market_date: baseBridge.market_date,
    market_weekday: baseBridge.market_weekday,
    selected_day_role: baseBridge.today_role?.role || null,
    selected_catalysts: baseBridge.today_catalysts.map((x) => ({ title: x.title, market_time_hhmm: x.market_time_hhmm }))
  }));

  return baseBridge;
}

export default buildDailyBridgeContext;
