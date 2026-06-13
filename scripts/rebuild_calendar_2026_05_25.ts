import { fetchForexFactoryCalendar } from "../core/news/ingestion/adapter-forexfactory.ts";
import { preloadWeek } from "../core/news/calendar/ingest_service.ts";
import { MacroCalendarStore } from "../core/news/calendar/macro-calendar-state.ts";

const WEEK_START = "2026-05-25";

async function rebuild() {
  const anchor = WEEK_START;

  const incoming = await fetchForexFactoryCalendar(anchor);

  const existing = await MacroCalendarStore.load(anchor);
  // IMPORTANT: do not modify business logic. We use the existing preloadWeek merge/save path.
  // preloadWeek will fetch again, but that is the most reliable way to match CURRENT merge behavior.
  const result = await preloadWeek(anchor);

  const mergedEvents = (result as any)?.events ?? [];

  const savedEvents = (await MacroCalendarStore.load(anchor))?.events ?? [];

  console.log(
    JSON.stringify(
      {
        incoming: incoming.length,
        mergedEvents: mergedEvents.length,
        savedEvents: savedEvents.length,
      },
      null,
      2
    )
  );

  const file = await MacroCalendarStore.save({
    ...(result as any),
    events: mergedEvents,
  } as any);

  console.log("file created:", file);
}

await rebuild();

