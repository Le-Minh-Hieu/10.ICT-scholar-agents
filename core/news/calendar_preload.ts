// import { preloadWeek } from "../../core/news/calendar/ingest_service";
import { preloadWeek } from "./calendar/ingest_service.js";
import { MacroReleaseEvent } from "../../types/macro.js";
import { fileURLToPath } from 'url';
import path from 'path';

async function run() {
  try {
    const result = await preloadWeek();
    // preloadWeek should return the saved MacroCalendarState or similar; validate basic invariants
    if (!result) {
      console.error('calendar_preload: preloadWeek returned no result');
      process.exit(2);
    }

    const events: MacroReleaseEvent[] = (result && (result.events || result)) as any;
    const count = Array.isArray(events) ? events.length : 0;
    console.log(`Calendar preload finished. Parsed events: ${count}`);

    // basic validation: ensure scheduled_time parseable and timezone aligned
    for (const ev of events || []) {
      if (!ev || !ev.scheduled_time) {
        console.error('calendar_preload: invalid event without scheduled_time', ev);
        process.exit(3);
      }
      const d = new Date(ev.scheduled_time);
      if (isNaN(d.getTime())) {
        console.error('calendar_preload: parsed event with invalid timestamp', ev.scheduled_time, ev);
        process.exit(4);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error("Calendar preload failed:", err);
    process.exit(1);
  }
}

// ESM-safe invocation: run when executed directly
const thisFile = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === thisFile;
if (isDirectRun) run();
