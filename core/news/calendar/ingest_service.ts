import { fetchForexFactoryCalendar } from "../ingestion/adapter-forexfactory.ts";
import { fileURLToPath } from 'url';
import path from 'path';
import { MacroCalendarStore } from "./macro-calendar-state.ts";
import { mergeEventLists, stableIdForEvent } from "./dedupe.ts";
import * as tz from 'date-fns-tz';

const NY_ZONE = 'America/New_York';

function weekStartIsoFor(date = new Date()): string {
  // Compute Monday date aligned to America/New_York and return YYYY-MM-DD
  const zoned = new Date(date.toLocaleString('en-US', { timeZone: NY_ZONE }));
  const day = zoned.getDay(); // 0 Sun .. 6 Sat
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(zoned);
  monday.setDate(zoned.getDate() - daysSinceMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export async function preloadWeek(weekStartIso?: string) {
  const anchor = weekStartIso ?? weekStartIsoFor(new Date());
  console.log("MacroCalendar: preload starting for week:", anchor);
  let incoming = [] as any[];
  try {
    incoming = await fetchForexFactoryCalendar(anchor);
    console.log(
      '[INGEST_COUNT]',
      JSON.stringify({
        incoming: incoming.length
      })
    );
  } catch (err: any) {
    console.warn('MacroCalendar: failed to fetch calendar:', err?.message ?? err);
    incoming = [];
  }
  // Load existing cached state if present and merge to preserve stable ids and previously captured values
  const existing = await MacroCalendarStore.load(anchor);
  const mergedEvents = mergeEventLists(existing?.events ?? [], incoming, 'forexfactory');
  console.log(
    '[MERGE_IMPACT_COUNTS]',
    {
      HIGH:
        mergedEvents.filter(
          e => e.impact === 'HIGH'
        ).length,

      MEDIUM:
        mergedEvents.filter(
          e => e.impact === 'MEDIUM'
        ).length,

      LOW:
        mergedEvents.filter(
          e => e.impact === 'LOW'
        ).length
    }
  );
  console.log(
    '[MERGE_COUNT]',
    JSON.stringify({
      existing: existing?.events?.length ?? 0,
      incoming: incoming.length,
      merged: mergedEvents.length
    })
  );
  const state = {
    week_start: anchor,
    week_end: new Date(new Date(anchor).getTime() + 6 * 24 * 3600 * 1000).toISOString(),
    last_updated: new Date().toISOString(),
    source: 'forexfactory',
    refresh_hours: 12,
    events: mergedEvents,
    version: '0.1.0'
  } as any;
  console.log(
    '[SAVE_COUNT]',
    JSON.stringify({
      events: state.events.length
    })
  );
  const file = await MacroCalendarStore.save(state as any);
  console.log("MacroCalendar: saved state to", file);
  return state;
}

export function schedulePeriodicRefresh(hours = 12) {
  const ms = Math.max(1, hours) * 3600 * 1000;
  console.log(`MacroCalendar: scheduling periodic refresh every ${hours}h`);
  let stopped = false;
  async function loop() {
    if (stopped) return;
    try {
      await preloadWeek();
    } catch (err) {
      console.error("MacroCalendar refresh failed:", (err as any)?.message ?? err);
    } finally {
      setTimeout(loop, ms);
    }
  }
  // start loop
  loop();
  return () => { stopped = true; };
}

// Allow running directly via ts-node: `npx ts-node-esm core/calendar/ingest_service.ts`
// ESM-safe entrypoint: run only when invoked directly
const __thisFile = fileURLToPath(import.meta.url);
const __isDirect = process.argv[1] && path.resolve(process.argv[1]) === __thisFile;
if (__isDirect) {
  (async () => {
    try {
      await preloadWeek();
      process.exit(0);
    } catch (err) {
      console.error("Preload failed:", err);
      process.exit(2);
    }
  })();
}
