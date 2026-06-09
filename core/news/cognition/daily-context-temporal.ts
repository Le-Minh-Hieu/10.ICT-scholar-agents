import { formatInTimeZone } from "date-fns-tz";
import type { MarketTemporalSemantics } from "../macro-context.js";

export const MARKET_TIMEZONE = "America/New_York";

export type MarketTimeContext = Required<Pick<
  MarketTemporalSemantics,
  "market_timezone" | "market_date" | "market_weekday" | "market_time_hhmm" | "session_tags" | "killzone_tags"
>>;

function parseHourMinute(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map((x) => Number(x));
  return { hh: Number.isFinite(hh) ? hh : 0, mm: Number.isFinite(mm) ? mm : 0 };
}

function minuteOfDay(hhmm: string) {
  const { hh, mm } = parseHourMinute(hhmm);
  return hh * 60 + mm;
}

function deriveSessionTags(hhmm: string): string[] {
  const minutes = minuteOfDay(hhmm);
  const tags: string[] = [];

  if (minutes < 180) tags.push("asia_close");
  if (minutes >= 180 && minutes < 360) tags.push("london_open");
  if (minutes >= 360 && minutes < 480) tags.push("pre_new_york");
  if (minutes >= 480 && minutes < 720) tags.push("new_york_morning");
  if (minutes >= 720 && minutes < 1020) tags.push("new_york_afternoon");
  if (minutes >= 1020) tags.push("after_hours");

  if (minutes >= 480 && minutes < 600) tags.push("us_data_window");
  if (hhmm === "08:30") tags.push("exact_0830");
  if (hhmm === "10:00") tags.push("exact_1000");

  return tags;
}

function deriveKillzoneTags(hhmm: string): string[] {
  const minutes = minuteOfDay(hhmm);
  const tags: string[] = [];

  if (minutes >= 120 && minutes < 300) tags.push("london_killzone");
  if (minutes >= 420 && minutes < 600) tags.push("new_york_killzone");
  if (minutes >= 600 && minutes < 720) tags.push("london_close_window");
  if (hhmm === "08:30") tags.push("ny_0830_macro");
  if (hhmm === "10:00") tags.push("ny_1000_macro");

  return tags;
}

export function deriveMarketTimeContext(timestamp?: string | null): MarketTimeContext {
  const base = timestamp ? new Date(timestamp) : new Date();
  const market_date = formatInTimeZone(base, MARKET_TIMEZONE, "yyyy-MM-dd");
  const market_weekday = formatInTimeZone(base, MARKET_TIMEZONE, "EEEE");
  const market_time_hhmm = formatInTimeZone(base, MARKET_TIMEZONE, "HH:mm");

  return {
    market_timezone: MARKET_TIMEZONE,
    market_date,
    market_weekday,
    market_time_hhmm,
    session_tags: deriveSessionTags(market_time_hhmm),
    killzone_tags: deriveKillzoneTags(market_time_hhmm)
  };
}

export function enrichWithMarketTime<T extends Record<string, any>>(input: T, timestampKey = "scheduled_time"): T & MarketTemporalSemantics {
  const market = deriveMarketTimeContext(input?.[timestampKey]);
  return {
    ...input,
    ...market
  };
}

export function groupByMarketDate<T extends Record<string, any>>(items: T[], timestampKey = "scheduled_time") {
  const grouped = new Map<string, Array<T & MarketTemporalSemantics>>();
  for (const item of items || []) {
    const enriched = enrichWithMarketTime(item, timestampKey);
    const key = String(enriched.market_date || "");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(enriched);
  }
  return grouped;
}

export function isSameMarketDate(timestamp: string | undefined, marketDate: string) {
  if (!timestamp) return false;
  return deriveMarketTimeContext(timestamp).market_date === marketDate;
}

export default {
  MARKET_TIMEZONE,
  deriveMarketTimeContext,
  enrichWithMarketTime,
  groupByMarketDate,
  isSameMarketDate
};
