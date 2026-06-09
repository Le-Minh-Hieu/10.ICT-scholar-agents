import { MacroReleaseEvent } from "../../../types/macro.ts";
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';

const NY_ZONE = 'America/New_York';

export function computeWindowsForEvent(ev: Partial<MacroReleaseEvent>) {
  // Interpret scheduled_time as a canonical UTC instant and perform arithmetic on that instant.
  // Formatting for display remains America/New_York aligned.
  const base = ev.scheduled_time ? new Date(ev.scheduled_time) : new Date();

  const impact = (ev.impact ?? 'MEDIUM') as string;
  let preMin = 30, postMin = 30, cooldownMin = 90;
  if (impact === 'HIGH') { preMin = 60; postMin = 60; cooldownMin = 180; }
  else if (impact === 'MEDIUM') { preMin = 30; postMin = 30; cooldownMin = 90; }
  else { preMin = 15; postMin = 15; cooldownMin = 60; }

  // Perform arithmetic on UTC-stable Date objects (avoid utcToZonedTime for arithmetic)
  const preStart = addMinutes(base, -preMin);
  const preEnd = base;
  const postStart = base;
  const postEnd = addMinutes(base, postMin);
  const cooldownEnd = addMinutes(base, cooldownMin);

  const fmt = (d: Date) => formatInTimeZone(d, NY_ZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");

  return {
    pre_start: fmt(preStart),
    pre_end: fmt(preEnd),
    post_start: fmt(postStart),
    post_end: fmt(postEnd),
    cooldown_end: fmt(cooldownEnd)
  };
}
