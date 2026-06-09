import { MacroCalendarStore } from '../calendar/macro-calendar-state.js';
import { computeWindowsForEvent } from '../calendar/windowing.js';
import { log } from '../../../shared/utils/logger.js';

// Minimal local CalendarWindow shape used by shadow activation logic (avoid reintroducing legacy store)
type CalendarWindow = {
  event: any | null;
  phase: 'PRE_EVENT' | 'POST_EVENT' | 'IDLE' | string;
  preWindowStart?: string;
  preWindowEnd?: string;
  postWindowStart?: string;
  postWindowEnd?: string;
};

export type ActivationState = 'IDLE' | 'PRE_EVENT' | 'EVENT_ACTIVE' | 'POST_EVENT' | 'COOLDOWN';

export type ActivationDecision = {
  state: ActivationState;
  window: CalendarWindow | null;
  shouldRun: boolean;
  // how long to sleep before next reevaluation (ms)
  sleepMs: number;
};

const DEFAULT_IDLE_SLEEP_MS = Number(process.env.SHADOW_IDLE_SLEEP_MS ?? 60 * 60 * 1000); // 1 hour
const DEFAULT_ACTIVE_POLL_MS =
  Number(
    process.env.SHADOW_ACTIVE_POLL_MS
    ?? 15 * 60 * 1000
  ); // keep bursts short
const MIN_SLEEP_MS = 5_000;

function clampSleep(ms: number) {
  return Math.max(MIN_SLEEP_MS, Math.floor(ms));
}

function getNowMs(now: Date) {
  return now.getTime();
}

function decideState(window: CalendarWindow | null): ActivationState {
  if (!window) return 'IDLE';

  if (window.phase === 'PRE_EVENT') return 'PRE_EVENT';

  if (window.phase === 'POST_EVENT') return 'POST_EVENT';

  if (window.phase === 'COOLDOWN') return 'COOLDOWN';

  return 'IDLE';
}

function windowSleepHintMs(now: Date, window: CalendarWindow | null): number {
  if (!window) return DEFAULT_IDLE_SLEEP_MS;

  const nowTs = getNowMs(now);
  const preStart = window.preWindowStart
    ? new Date(window.preWindowStart).getTime()
    : 0;

  const preEnd = window.preWindowEnd
    ? new Date(window.preWindowEnd).getTime()
    : 0;

  const postStart = window.postWindowStart
    ? new Date(window.postWindowStart).getTime()
    : 0;

  const postEnd = window.postWindowEnd
    ? new Date(window.postWindowEnd).getTime()
    : 0;

  // choose next boundary based on which phase we are in
  if (window.phase === 'PRE_EVENT') {
    const untilEnd = preEnd - nowTs;
    return Math.min(DEFAULT_ACTIVE_POLL_MS, Math.max(MIN_SLEEP_MS, untilEnd));
  }

  if (window.phase === 'POST_EVENT') {
    const untilEnd = postEnd - nowTs;
    return Math.min(DEFAULT_ACTIVE_POLL_MS, Math.max(MIN_SLEEP_MS, untilEnd));
  }

  if (window.phase === 'COOLDOWN') {
    const cooldownEnd = new Date((window as any).cooldownEnd || window.postWindowEnd).getTime();
    const untilEnd = cooldownEnd - nowTs;
    return Math.min(DEFAULT_ACTIVE_POLL_MS, Math.max(MIN_SLEEP_MS, untilEnd));
  }

  // fallback
  return DEFAULT_ACTIVE_POLL_MS;
}

export async function computeActivationDecision(now: Date = new Date()): Promise<ActivationDecision> {
  // Load canonical macro calendar state and compute active windows from canonical MacroReleaseEvent[]
  const weeks = await MacroCalendarStore.listCachedWeeks();
  let window: CalendarWindow | null = null;

  if (weeks && weeks.length > 0) {
    const latest = weeks.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    const state = await MacroCalendarStore.load(latest);
    const events = (state && state.events) || [];

    for (const ev of events) {
      try {
        const w = computeWindowsForEvent(ev as any) as any;
        // WINDOW_TRACE: log computed boundaries for this event (no logic changes)
        log({
          stage: 'WINDOW_TRACE', message: 'Computed window boundaries for event', data: {
            now: new Date().toISOString(),
            id: ev.id,
            computed: {
              pre_start: w.pre_start,
              pre_end: w.pre_end,
              post_start: w.post_start,
              post_end: w.post_end,
              cooldown_end: w.cooldown_end
            }
          }
        });
        const nowTs = now.getTime();
        const preStart = new Date(w.pre_start).getTime();
        const preEnd = new Date(w.pre_end).getTime();
        const postStart = new Date(w.post_start).getTime();
        const postEnd = new Date(w.post_end).getTime();
        const cooldownEnd = w.cooldown_end ? new Date(w.cooldown_end).getTime() : postEnd;

        if (nowTs >= preStart && nowTs < preEnd) {
          ev.lifecycle_phase = 'PRE_EVENT';
          window = { event: ev, phase: 'PRE_EVENT', preWindowStart: w.pre_start, preWindowEnd: w.pre_end, postWindowStart: w.post_start, postWindowEnd: w.post_end };
          log({ stage: 'WINDOW_TRACE', message: 'Activation decision for event', data: { id: ev.id, lifecycle_phase: ev.lifecycle_phase, decision: 'PRE_EVENT' } });
          break;
        }

        if (nowTs >= postStart && nowTs < postEnd) {
          ev.lifecycle_phase = 'POST_EVENT';
          window = { event: ev, phase: 'POST_EVENT', preWindowStart: w.pre_start, preWindowEnd: w.pre_end, postWindowStart: w.post_start, postWindowEnd: w.post_end };
          log({ stage: 'WINDOW_TRACE', message: 'Activation decision for event', data: { id: ev.id, lifecycle_phase: ev.lifecycle_phase, decision: 'POST_EVENT' } });
          break;
        }

        if (nowTs >= postEnd && nowTs < cooldownEnd) {
          ev.lifecycle_phase = 'COOLDOWN';
          window = { event: ev, phase: 'COOLDOWN', preWindowStart: w.pre_start, preWindowEnd: w.pre_end, postWindowStart: w.post_start, postWindowEnd: w.post_end } as any;
          (window as any).cooldownEnd = w.cooldown_end;
          log({ stage: 'WINDOW_TRACE', message: 'Activation decision for event', data: { id: ev.id, lifecycle_phase: ev.lifecycle_phase, decision: 'COOLDOWN', cooldown_end: w.cooldown_end } });
          break;
        }
      } catch (e) {
        // ignore individual event window failures
      }
    }
  }
  const state = decideState(window);
  const shouldRun = state !== 'IDLE' && !!window;
  const sleepMs = clampSleep(windowSleepHintMs(now, window as any));

  if (state === 'IDLE') {
    log({
      stage: 'SHADOW_ACTIVATION_IDLE',
      message: 'No macro event window active; skipping shadow runner cycle',
      data: { sleepMs }
    });
  } else {
    log({
      stage: 'SHADOW_ACTIVATION_WINDOW',
      message: 'Macro event window active; evaluating shadow runner execution',
      data: { state, event: window?.event?.name, sleepMs }
    });
  }

  return {
    state,
    window,
    shouldRun,
    sleepMs
  };
}
