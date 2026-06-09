import { MacroCalendarStore } from './calendar/macro-calendar-state.js';

async function run() {
  try {
    const weeks = await MacroCalendarStore.listCachedWeeks();
    if (!weeks || weeks.length === 0) {
      console.log('smoke_migrate: no cached weeks present');
      process.exit(0);
    }
    const latest = weeks.sort().reverse()[0];
    const state = await MacroCalendarStore.load(latest);
    const count = (state && state.events && state.events.length) || 0;
    console.log('smoke_migrate: loaded events from', latest, 'count:', count);
    if (count > 0) console.log('smoke_migrate: sample event', state.events[0]);
    process.exit(0);
  } catch (err) {
    console.error('smoke_migrate failed', err);
    process.exit(2);
  }
}

import { fileURLToPath } from 'url';
import path from 'path';

const thisScript = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === thisScript;
if (isDirectRun) run();
