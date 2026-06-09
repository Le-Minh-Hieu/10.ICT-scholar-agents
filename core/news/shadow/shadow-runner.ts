import { MacroCalendarStore } from '../calendar/macro-calendar-state.js';
import { computeActivationDecision } from './event-window-activation.js'
import { computeExecutionConfidence } from '../calendar/conditioning.js';
import { MacroReleaseEvent } from '../../../types/macro';
import { stagingEventStore } from '../staging/staging-event-store.js';
import type { NewsEvent } from '../schemas/news-event.js';
import { log } from '../../../shared/utils/logger.js';
import { buildWeeklyProfile } from '../cognition/weekly-profile-builder.js';
import { buildDailyContextProfile } from '../cognition/daily-context-profile-builder.js';
import { trace } from '../trace-utils.js';

const DEFAULT_INTERVAL_MS = Number(process.env.SHADOW_RUNNER_INTERVAL_MS) || 30_000;
const MAX_CONCURRENT = Number(process.env.SHADOW_RUNNER_MAX_CONCURRENT) || 2;
const MAX_CANDIDATES = Number(process.env.SHADOW_RUNNER_MAX_CANDIDATES) || 5;

let running = false;

// Track last built week to avoid repeated builds within same cached week
const lastBuiltWeek: { [weekStart: string]: number } = {};

// Track processed phase tokens with expiry timestamps to avoid permanent suppression
const PROCESSED_TTL_MS = Number(process.env.SHADOW_PROCESSED_TTL_MS) || 6 * 60 * 60 * 1000; // default 6 hours
const processedIds = new Map<string, number>();

function isProcessed(key: string) {
    const exp = processedIds.get(key);
    if (!exp) return false;
    if (Date.now() > exp) {
        processedIds.delete(key);
        return false;
    }
    return true;
}

function now() { return Date.now(); }

async function defaultEventProvider(): Promise<MacroReleaseEvent[]> {
    // Only provide events that are currently inside PRE_EVENT or POST_EVENT windows
    const decision = await computeActivationDecision(new Date());
    if (!decision.window || (decision.state !== 'PRE_EVENT' && decision.state !== 'POST_EVENT' && decision.state !== 'COOLDOWN')) return [];
    const ev = decision.window.event as MacroReleaseEvent | undefined;
    return ev ? [ev] : [];
}

async function processEvent(ev: MacroReleaseEvent) {
    const start = now();
    try {
        const conf = computeExecutionConfidence(ev, new Date(), 1);
        const result = {
            id: ev.id,
            scheduled_time: ev.scheduled_time,
            impact: ev.impact,
            execution_confidence: conf,
            processed_at: new Date().toISOString()
        };
        const stagedEvent: NewsEvent = {
            id: `macro-${ev.id}`,
            provider_id: 'forexfactory',
            source_id: 'macro-calendar',

            title: ev.name,
            summary: ev.name,
            currency: ev.currency,
            impact: ev.impact,
            affected_assets: ev.affected_assets,

            confidence:
                ev.impact === 'HIGH'
                    ? 0.9
                    : ev.impact === 'MEDIUM'
                        ? 0.7
                        : 0.4,

            category:
                ev.name?.includes('CPI') ? 'CPI' :
                    ev.name?.includes('PPI') ? 'PPI' :
                        ev.name?.includes('NFP') ? 'NFP' :
                            ev.name?.includes('PMI') ? 'PMI' :
                                ev.name?.includes('FOMC') ? 'FOMC' :
                                    ev.name?.includes('Interest Rate') ? 'RATE_DECISION' :
                                        ev.currency === 'EUR' ? 'ECB' :
                                            ev.currency === 'JPY' ? 'BOJ' :
                                                'PMI',
            observed_at: new Date().toISOString(),
            published_at: ev.scheduled_time,

            persistence_class: 'SESSION',

            impact_score:
                ev.impact === 'HIGH'
                    ? 0.9
                    : ev.impact === 'MEDIUM'
                        ? 0.6
                        : 0.3,

            metadata: {
                macro_event: true,
                lifecycle_phase: ev.lifecycle_phase,
                execution_confidence: conf,
                scheduled_time: ev.scheduled_time,
                currency: ev.currency,
                impact: ev.impact
            }
        } as any;
        const appendPayload = {
            is_shadow: true,
            expires_at: new Date(
                Date.now() + 1000 * 60 * 60 * 24
            ).toISOString()
        };

        // SHADOW_STAGE_TRACE: log full staged event shape and append payload (no logic changes)
        log({
            stage: 'SHADOW_STAGE_TRACE', message: 'Staging shadow event', data: {
                staged: {
                    id: stagedEvent.id,
                    provider_id: stagedEvent.provider_id,
                    source_id: stagedEvent.source_id,
                    title: stagedEvent.title,
                    category: stagedEvent.category,
                    currency: stagedEvent.currency,
                    impact: stagedEvent.impact,
                    confidence: stagedEvent.confidence,
                    impact_score: stagedEvent.impact_score,
                    persistence_class: stagedEvent.persistence_class,
                    metadata: stagedEvent.metadata
                },
                appendPayload
            }
        });

        stagingEventStore.append(stagedEvent, appendPayload);
        console.info('SHADOW_EVENT_PROCESSED', result);
        return result;
    } catch (err: any) {
        console.warn('SHADOW_EVENT_PROCESS_FAILED', { id: ev.id, error: String(err) });
        return { id: ev.id, error: String(err) };
    }
}

export async function startShadowRunner(opts?: { eventProvider?: () => Promise<MacroReleaseEvent[]> }) {
    const provider = opts?.eventProvider || defaultEventProvider;
    if (running) return;
    running = true;
    console.info('SHADOW_RUNNER_STARTED', { idleSleepMs: process.env.SHADOW_IDLE_SLEEP_MS ?? 60 * 60 * 1000 });

    let active = 0;

    async function cycleOnce(phase: string) {
        const cycleStart = now();
        console.info('SHADOW_RUNNER_CYCLE', { ts: cycleStart });
        let events: MacroReleaseEvent[] = [];
        try {
            events = await provider();
        } catch (err) {
            console.warn('SHADOW_RUNNER_PROVIDER_ERROR', { error: String(err) });
            events = [];
        }

        // processedIds now tracks per-phase tokens: `${event.id}:${phase}` with expiry timestamps
        const toProcess = events.filter(e => e && !isProcessed(`${e.id}:${phase}`)).slice(0, MAX_CANDIDATES);

        for (const ev of toProcess) {
            while (active >= MAX_CONCURRENT && running) {
                await new Promise(r => setTimeout(r, 200));
            }
            if (!running) break;
            active += 1;
            (async () => {
                try {
                    const res = await processEvent(ev);
                    processedIds.set(`${ev.id}:${phase}`, Date.now() + PROCESSED_TTL_MS);
                } finally {
                    active -= 1;
                }
            })();
        }

        const waitStart = now();
        while ((active > 0) && (now() - waitStart < 30_000)) {
            await new Promise(r => setTimeout(r, 200));
        }

        console.info('SHADOW_RUNNER_CYCLE_DONE', { cycleDuration: now() - cycleStart, processed: toProcess.length, active });
        return;
    }

    (async function loop() {
        while (running) {
            try {
                const decision = await computeActivationDecision(new Date());
                if (decision.shouldRun) {
                    // non-blocking: trigger weekly profile builder when activation begins
                    (async () => {
                        try {
                            const weeks = await MacroCalendarStore.listCachedWeeks();
                            const latest = weeks && weeks.length ? weeks.sort().slice(-1)[0] : null;
                            // if (latest && !lastBuiltWeek[latest]) {
                            if (latest) {
                                trace('MACRO_PROFILE_TRACE', 'Triggering weekly profile builder', { week: latest });
                                try {
                                    await buildWeeklyProfile(latest);
                                    try {
                                        await buildDailyContextProfile({ weekStart: latest });
                                        trace('DAILY_PROFILE', 'Daily context profile built', { week: latest });
                                    } catch (dailyErr: any) {
                                        trace('DAILY_PROFILE', 'DAILY_BUILD_FAILED', { week: latest, error: String(dailyErr) });
                                    }
                                    // lastBuiltWeek[latest] = Date.now();
                                    trace('MACRO_PROFILE_TRACE', 'Weekly profile built', { week: latest });
                                } catch (e: any) {
                                    trace('MACRO_PROFILE_TRACE', 'WEEKLY_BUILD_FAILED', { week: latest, error: String(e) });
                                }
                            }
                        } catch (e) {
                            // swallow
                        }
                    })();

                    await cycleOnce(decision.state);
                }
                if (!running) break;
                await new Promise(r => setTimeout(r, decision.sleepMs ?? DEFAULT_INTERVAL_MS));
            } catch (err) {
                console.warn('SHADOW_RUNNER_CYCLE_ERROR', { error: String(err) });
                if (!running) break;
                await new Promise(r => setTimeout(r, DEFAULT_INTERVAL_MS));
            }
        }
        console.info('SHADOW_RUNNER_STOPPED');
    })();
}

export async function stopShadowRunner() { running = false; }

export function isShadowRunnerRunning() { return running; }
