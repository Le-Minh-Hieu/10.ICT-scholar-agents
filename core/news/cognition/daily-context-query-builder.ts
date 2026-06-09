import type { DailyBridgeContext, DailyQueryCandidate } from "../daily-context.js";
import { trace } from "../trace-utils.js";

function pushQuery(
  out: DailyQueryCandidate[],
  family: DailyQueryCandidate["family"],
  query: string | undefined,
  rank: number,
  rationale: string
) {
  const clean = String(query || "").replace(/\s+/g, " ").trim();
  if (!clean) return;
  out.push({ family, query: clean, rank, rationale });
}

function dedupeQueries(candidates: DailyQueryCandidate[]) {
  const byQuery = new Map<string, DailyQueryCandidate>();
  for (const candidate of candidates) {
    const key = candidate.query.toLowerCase();
    const prev = byQuery.get(key);
    if (!prev || candidate.rank > prev.rank) {
      byQuery.set(key, candidate);
    }
  }
  return Array.from(byQuery.values()).sort((a, b) => b.rank - a.rank || a.query.localeCompare(b.query));
}

export function buildDailyContextQueries(bridge: DailyBridgeContext): DailyQueryCandidate[] {
  const out: DailyQueryCandidate[] = [];
  const role = bridge.today_role?.role;
  const weekday = bridge.market_weekday;
  const weeklyModel = bridge.weekly_delivery_model?.model || "";

  pushQuery(out, "WEEKLY_ROLE", `${weekday} daily profile intraday ICT`, 102, "Daily intraday profile anchor");
  pushQuery(out, "WEEKLY_ROLE", `${weekday} ${role || "daily profile"} ICT weekly delivery model`, 100, "Weekly role query");
  const catalysts =
    bridge.today_catalysts.filter(c => {
      const impact =
        String(c.impact || "").toUpperCase();

      return (
        impact === "HIGH" ||
        impact === "MEDIUM"
      );
    });
  for (const catalyst of catalysts.slice(0, 3)) {
    pushQuery(out, "CATALYST", `${catalyst.title} ${catalyst.impact || "high impact"} ${catalyst.market_time_hhmm} New York ICT profile`, 96, "Catalyst impact-time query");
    pushQuery(out, "CATALYST", `${catalyst.title} ${catalyst.impact || "high impact"} liquidity behavior`, 90, "Catalyst impact-liquidity query");
    const isTradingDay =
      [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday"
      ].includes(
        bridge.market_weekday
      );
    for (const tag of catalyst.killzone_tags || []) {

      if (!isTradingDay) continue;
      pushQuery(out, "KILLZONE", `${catalyst.title} ${catalyst.impact || "high impact"} ${tag.replace(/_/g, " ")} New York`, 92, "Killzone-specific query");
      if (catalyst.market_time_hhmm) {
        pushQuery(out, "KILLZONE", `${catalyst.market_time_hhmm} ${tag.replace(/_/g, " ")} macro release ICT`, 89, "Time-killzone query");
      }
    }
    for (const tag of catalyst.session_tags || []) {
      if (!isTradingDay) continue;
      pushQuery(out, "KILLZONE", `${catalyst.title} ${catalyst.impact || "high impact"} ${catalyst.market_time_hhmm} ${tag.replace(/_/g, " ")} macro event profile`, 86, "Session-window query");
    }
    if (weeklyModel && weeklyModel !== "INSUFFICIENT_EVIDENCE") {
      pushQuery(out, "WEEKLY_ROLE", `${weeklyModel} ${catalyst.title} ${catalyst.impact || "high impact"} ${weekday}`, 94, "Weekly model catalyst query");
    }
  }

  const deduped = dedupeQueries(out);
  trace("DAILY_QUERY_BUILDER", "Built daily retrieval queries", {
    market_date: bridge.market_date,
    market_weekday: bridge.market_weekday,
    query_count: deduped.length,
    queries: deduped.slice(0, 12).map((x) => ({ family: x.family, rank: x.rank, query: x.query }))
  });
  console.log("[DAILY_QUERY_BUILDER]", JSON.stringify({
    market_date: bridge.market_date,
    market_weekday: bridge.market_weekday,
    generated_queries: deduped.slice(0, 12)
  }));
  return deduped;
}

export default buildDailyContextQueries;
