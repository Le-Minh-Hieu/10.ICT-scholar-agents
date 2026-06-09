import { MacroCalendarStore } from "../calendar/macro-calendar-state.js";
import MacroContextStore from "../macro-context.js";
import DailyContextStore from "../daily-context.js";
import type { DailyContextProfile } from "../daily-context.js";
import { deriveMarketTimeContext, enrichWithMarketTime, groupByMarketDate } from "./daily-context-temporal.js";
import buildDailyBridgeContext from "./daily-context-bridge.js";
import retrieveForDailyContext from "./daily-context-retrieval-adapter.js";
import reasonAboutDay from "./daily-context-reasoner.js";
import { trace } from "../trace-utils.js";

export async function buildDailyContextProfile(opts?: {
  marketDate?: string;
  weekStart?: string;
  asOf?: string | Date;
  pmso?: any;
}): Promise<DailyContextProfile | null> {
  const asOfIso = opts?.asOf instanceof Date ? opts.asOf.toISOString() : typeof opts?.asOf === "string" ? opts.asOf : new Date().toISOString();
  const marketDate = opts?.marketDate || deriveMarketTimeContext(asOfIso).market_date;

  const weekly = opts?.weekStart
    ? await MacroContextStore.load(opts.weekStart)
    : await (async () => {
      const weeks = await MacroContextStore.listProfiles();
      const latest = weeks.slice().sort().slice(-1)[0];
      return latest ? MacroContextStore.load(latest) : null;
    })();

  if (!weekly) {
    trace("DAILY_PROFILE", "No weekly profile available for daily build", { market_date: marketDate }, "WARN");
    return null;
  }

  const calendarState = await MacroCalendarStore.load(weekly.week_start);
  const allEvents = ((calendarState?.events || []) as any[]).map((x: any) => enrichWithMarketTime(x));
  const grouped = groupByMarketDate(allEvents);
  const todayCalendarSlice = grouped.get(marketDate) || [];

  const bridge = buildDailyBridgeContext(weekly, todayCalendarSlice, { asOf: asOfIso });
  const retrieval = await retrieveForDailyContext(bridge, { pmso: opts?.pmso });
  const profile = await reasonAboutDay(bridge, retrieval);

  await DailyContextStore.save(profile);

  trace("DAILY_PROFILE", "Daily profile built", {
    market_date: profile.market_date,
    market_weekday: profile.market_weekday,
    day_type: profile.day_type,
    catalyst_count: profile.todays_catalysts.length
  });
  console.log("[DAILY_PROFILE]", JSON.stringify({
    market_date: profile.market_date,
    market_weekday: profile.market_weekday,
    selected_day_role: profile.day_role_in_week,
    selected_catalysts: profile.todays_catalysts.map((x) => x.title)
  }));

  return profile;
}

export default buildDailyContextProfile;
