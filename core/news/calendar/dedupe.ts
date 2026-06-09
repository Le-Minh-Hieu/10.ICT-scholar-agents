import { MacroReleaseEvent } from "../../../types/macro";
import crypto from 'crypto';

function normalizeTitle(t?: string) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function stableIdForEvent(ev: Partial<MacroReleaseEvent>, source = 'forexfactory'): string {
  if (ev.id && String(ev.id).trim()) return String(ev.id);
  if (ev.native_id) return `${source}:${String(ev.native_id)}`;
  const currency = ev.currency || 'GLOBAL';
  const category = ev.category || 'OTHER';
  const ts = ev.scheduled_time || '';
  const title = normalizeTitle(ev.name);
  const key = `${currency}|${category}|${ts}|${title}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0,12);
  return `${source}:${hash}`;
}

export function mergeEventLists(existing: MacroReleaseEvent[] = [], incoming: MacroReleaseEvent[] = [], source = 'forexfactory') {
  const map = new Map<string, MacroReleaseEvent>();

  for (const e of existing) {
    const id = stableIdForEvent(e, source);
    map.set(id, { ...e, id });
  }

  for (const inc of incoming) {
    const id = stableIdForEvent(inc, source);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, { ...inc, id });
      continue;
    }

    // Reconcile: incoming values take precedence if present; otherwise keep previous.
    const merged: MacroReleaseEvent = {
      id,
      native_id: inc.native_id ?? prev.native_id ?? null,
      name: inc.name ?? prev.name,
      category: inc.category ?? prev.category,
      currency: inc.currency ?? prev.currency,
      impact: inc.impact ?? prev.impact,
      impact_score: typeof inc.impact_score === 'number' ? inc.impact_score : prev.impact_score,
      timezone: inc.timezone ?? prev.timezone,
      scheduled_time: inc.scheduled_time ?? prev.scheduled_time,
      forecast: typeof inc.forecast === 'number' ? inc.forecast : prev.forecast,
      previous: typeof inc.previous === 'number' ? inc.previous : prev.previous,
      actual: typeof inc.actual === 'number' ? inc.actual : prev.actual,
      lifecycle_phase: inc.lifecycle_phase ?? prev.lifecycle_phase,
      window_boundaries: inc.window_boundaries ?? prev.window_boundaries,
      volatility_risk: typeof inc.volatility_risk === 'number' ? inc.volatility_risk : prev.volatility_risk,
      confidence: typeof inc.confidence === 'number' ? inc.confidence : prev.confidence,
      provenance: inc.provenance ?? prev.provenance,
      affected_assets: inc.affected_assets ?? prev.affected_assets,
      execution_confidence: typeof inc.execution_confidence === 'number' ? inc.execution_confidence : prev.execution_confidence
    };

    map.set(id, merged);
  }

  // Preserve any existing-only events that were not in incoming (avoid losing events due to upstream omission)
  return Array.from(map.values()).sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''));
}
