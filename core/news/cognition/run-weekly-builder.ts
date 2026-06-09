#!/usr/bin/env tsx
import buildWeeklyProfile from "./weekly-profile-builder.js";
import buildDailyContextProfile from "./daily-context-profile-builder.js";
import { trace } from "../trace-utils.js";

async function main() {
  trace('MACRO_PROFILE_TRACE', 'CLI invoked', { ts: new Date().toISOString() });
  try {
    const result = await buildWeeklyProfile();
    if (!result) {
      trace('MACRO_PROFILE_TRACE', 'BUILD_EMPTY', {});
      console.error('No profile built');
      process.exit(1);
    }

    const daily = await buildDailyContextProfile({ weekStart: result.week_start });

    // hydrate payload for inspection
    const hydrator = await import('./macro-context-hydrator.js');
    const payload = await hydrator.getLatestMacroHydration();
    const dailyPayload = await hydrator.getLatestDailyHydration();

    trace('MACRO_CONTEXT_FINAL', 'Final MacroContextState', { week: result.week_start, week_type: result.week_type, bias: result.macro_bias, narrative_confidence: result.narrative_confidence, active_events: result.active_events.length });

    console.log(JSON.stringify({ status: 'ok', profile: { week_start: result.week_start, week_type: result.week_type, macro_bias: result.macro_bias, narrative_confidence: result.narrative_confidence }, daily_profile: daily ? { market_date: daily.market_date, day_type: daily.day_type } : null, hydration: payload, daily_hydration: dailyPayload }, null, 2));
    process.exit(0);
  } catch (e: any) {
    trace('MACRO_PROFILE_TRACE', 'BUILD_FAILED', { error: String(e) });
    console.error('Build failed', e);
    process.exit(2);
  }
}
main();
// if (require.main === module) {
//   main();
// }
