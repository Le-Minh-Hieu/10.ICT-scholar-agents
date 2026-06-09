#!/usr/bin/env tsx
import buildWeeklyProfile from "../cognition/weekly-profile-builder.js";
import buildDailyContextProfile from "../cognition/daily-context-profile-builder.js";
import MacroContextStore from "../macro-context.js";
import DailyContextStore from "../daily-context.js";
import { trace } from "../trace-utils.js";

async function main() {
  trace('MACRO_PROFILE_TRACE', 'SMOKE_TEST_START', { ts: new Date().toISOString() });
  try {
    const profile = await buildWeeklyProfile();
    if (!profile) {
      console.error('SMOKE_TEST_FAIL: No profile returned');
      process.exit(2);
    }

    // basic assertions
    const ok = typeof profile.week_start === 'string' && typeof profile.narrative_confidence === 'number' && Array.isArray(profile.active_events);

    const saved = await MacroContextStore.load(profile.week_start);
    const daily = await buildDailyContextProfile({ weekStart: profile.week_start });
    const savedDaily = daily ? await DailyContextStore.load(daily.market_date) : null;

    if (!ok) {
      console.error('SMOKE_TEST_FAIL: Profile shape invalid', { profile });
      process.exit(3);
    }

    if (!saved) {
      console.error('SMOKE_TEST_FAIL: Profile not persisted');
      process.exit(4);
    }

    if (!daily || !savedDaily) {
      console.error('SMOKE_TEST_FAIL: Daily profile not built or persisted');
      process.exit(5);
    }

    console.log('SMOKE_TEST_PASS: profile built and persisted', { week: profile.week_start, events: profile.active_events.length, market_date: daily.market_date });
    trace('MACRO_PROFILE_TRACE', 'SMOKE_TEST_PASS', { week: profile.week_start });
    process.exit(0);
  } catch (e: any) {
    trace('MACRO_PROFILE_TRACE', 'SMOKE_TEST_ERROR', { error: String(e) });
    console.error('SMOKE_TEST_ERROR', e);
    process.exit(6);
  }
}

if (require.main === module) main();
