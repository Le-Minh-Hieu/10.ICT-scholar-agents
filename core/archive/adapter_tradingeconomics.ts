import fs from "fs";
import path from "path";
import { MacroCalendarState, MacroReleaseEvent } from "../../types/macro";

const TE_API_BASE = "https://api.tradingeconomics.com";

function isoDateOnly(dt: Date) {
  return dt.toISOString().split("T")[0];
}

function computeDefaultWindows(scheduledIso: string): MacroReleaseEvent["window_boundaries"] {
  const scheduled = new Date(scheduledIso).getTime();
  const preStart = new Date(scheduled - 30 * 60 * 1000).toISOString();
  const preEnd = new Date(scheduled).toISOString();
  const postStart = new Date(scheduled).toISOString();
  const postEnd = new Date(scheduled + 30 * 60 * 1000).toISOString();
  const cooldownEnd = new Date(scheduled + 90 * 60 * 1000).toISOString();
  return { pre_start: preStart, pre_end: preEnd, post_start: postStart, post_end: postEnd, cooldown_end: cooldownEnd };
}

export async function fetchTradingEconomicsCalendar(weekStartIso: string, weekEndIso?: string): Promise<MacroCalendarState> {
  const apiKey = process.env.TRADING_ECONOMICS_KEY;
  const start = weekStartIso.split("T")[0];
  const end = weekEndIso ? weekEndIso.split("T")[0] : isoDateOnly(new Date(new Date(weekStartIso).getTime() + 6 * 24 * 3600 * 1000));

  if (!apiKey) {
    // DEPRECATED: TradingEconomics adapter is deprecated — prefer ForexFactory. Returning empty state.
    return {
      week_start: weekStartIso,
      week_end: (new Date(end)).toISOString(),
      last_updated: new Date().toISOString(),
      source: "tradingeconomics:mock",
      refresh_hours: 12,
      events: [],
      version: "0.1.0-mock"
    };
  }

  const endpoint = `${TE_API_BASE}/calendar?start_date=${start}&end_date=${end}&c=${apiKey}`;

  const resp = await fetch(endpoint, { headers: { "User-Agent": "MacroCalendarAdapter/1.0" } });
  if (!resp.ok) {
    throw new Error(`TE HTTP ${resp.status} ${resp.statusText}`);
  }

  const json = await resp.json();

  // TE calendar shape varies; we defensively map known fields if present.
  const events: MacroReleaseEvent[] = (Array.isArray(json) ? json : []).map((item: any) => {
    const nativeId = item.id ?? item.eventId ?? item.gmt ?? `${item.country}_${item.event}`;
    const scheduled = item.date ?? item.date_time_utc ?? item.datetime ?? item.date_time || item.date_local || item.date;
    const scheduledIso = scheduled ? new Date(scheduled).toISOString() : new Date().toISOString();

    const ev: MacroReleaseEvent = {
      id: `te:${String(nativeId)}`,
      native_id: String(nativeId),
      name: item.event ?? item.description ?? item.title ?? String(item?.category ?? ""),
      category: item.category ?? item.event ?? null,
      currency: item.currency ?? item.country ?? "",
      impact: (item.impact && String(item.impact).toUpperCase()) as any,
      impact_score: typeof item.impact === "number" ? Math.min(1, Math.max(0, item.impact)) : undefined,
      timezone: item.timezone ?? "UTC",
      scheduled_time: scheduledIso,
      forecast: item.actual_forecast ?? item.forecast ?? null,
      previous: item.previous ?? null,
      actual: item.actual ?? null,
      window_boundaries: computeDefaultWindows(scheduledIso),
      volatility_risk: undefined,
      confidence: null,
      provenance: { source: "tradingeconomics", payload_hash: '' },
      affected_assets: []
    };

    return ev;
  });

  const state: MacroCalendarState = {
    week_start: weekStartIso,
    week_end: new Date(end).toISOString(),
    last_updated: new Date().toISOString(),
    source: "tradingeconomics",
    refresh_hours: 12,
    events,
    version: "0.1.0"
  };

  return state;
}
