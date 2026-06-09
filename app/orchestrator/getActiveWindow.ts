import { MacroCalendarState, MacroReleaseEvent } from "../../types/macro";
import { MacroCalendarStore } from "../../core/news/calendar/macro-calendar-state";
import { computeExecutionConfidence } from "../../core/news/calendar/conditioning";

function parseIso(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function computeLifecycle(ev: MacroReleaseEvent, now: Date) {
  const wb = ev.window_boundaries || {};
  const preStart = parseIso(wb.pre_start);
  const preEnd = parseIso(wb.pre_end);
  const postStart = parseIso(wb.post_start);
  const postEnd = parseIso(wb.post_end);
  const cooldownEnd = parseIso(wb.cooldown_end);

  if (preStart && now >= preStart && preEnd && now <= preEnd) return "PRE_EVENT";
  if (postStart && now >= postStart && postEnd && now <= postEnd) return "POST_EVENT";
  if (cooldownEnd && now <= cooldownEnd) return "COOLDOWN";
  // default: if scheduled_time in future -> PRE_EVENT else COOLDOWN
  const scheduled = parseIso(ev.scheduled_time);
  if (scheduled && now < scheduled) return "PRE_EVENT";
  return "COOLDOWN";
}

export async function getActiveWindow(now = new Date()): Promise<MacroReleaseEvent[]> {
  // Determine current week anchor (ISO week Monday 00:00 UTC)
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sun=0 -> 7
  const monday = new Date(d.getTime() - (day - 1) * 24 * 3600 * 1000);
  const weekStartIso = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate())).toISOString();

  const state = await MacroCalendarStore.load(weekStartIso);
  if (!state) return [];

  const active: MacroReleaseEvent[] = [];
  for (const ev of state.events) {
    const phase = computeLifecycle(ev, now) as any;
    ev.lifecycle_phase = phase;
    // ensure volatility_risk exists
    if (typeof ev.volatility_risk !== 'number') {
      ev.volatility_risk = ev.impact_score ?? (ev.impact === 'HIGH' ? 1 : ev.impact === 'MEDIUM' ? 0.6 : 0.2);
    }
    // compute execution confidence (clusterSize=1 for now)
    ev.execution_confidence = computeExecutionConfidence(ev as MacroReleaseEvent, now, 1);
    if (phase === "PRE_EVENT" || phase === "POST_EVENT") active.push(ev);
  }

  return active;
}
