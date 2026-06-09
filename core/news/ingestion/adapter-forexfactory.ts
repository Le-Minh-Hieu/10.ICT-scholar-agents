import { MacroReleaseEvent } from '../../../types/macro.ts';

import { computeWindowsForEvent } from '../calendar/windowing.ts';
import crypto from 'crypto';

const NY_ZONE = 'America/New_York';

function normalizeImpact(raw: string | null | undefined): 'HIGH' | 'MEDIUM' | 'LOW' | undefined {
  if (!raw) return undefined;
  const r = String(raw).trim().toLowerCase();
  if (r.includes('high') || r === '3') return 'HIGH';
  if (r.includes('med') || r === '2') return 'MEDIUM';
  return 'LOW';
}

function computeVolatilityByImpact(impact: string | undefined) {
  if (impact === 'HIGH') return 0.9;
  if (impact === 'MEDIUM') return 0.6;
  return 0.2;
}

function stableIdForParts(currency: string, category: string, isoTs: string, title: string, source = 'forexfactory') {
  const normTitle = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const key = `${currency || 'GLOBAL'}|${category || 'OTHER'}|${isoTs || ''}|${normTitle}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
  return `${source}:${hash}`;
}

function tryParseNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[^0-9.\-]/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a ForexFactory week page into MacroReleaseEvent[]
 * - Fetches FairEconomy JSON feed
 * - Normalizes into the existing MacroReleaseEvent shape
 */
export async function fetchForexFactoryCalendar(weekAnchorIso?: string): Promise<MacroReleaseEvent[]> {
  const FEED_URLS = [
    'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
    'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json'
  ];



  let eventsJson: any[] | null = null;

  for (const url of FEED_URLS) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      if (resp.status === 429) {
        const retryAfter =
          Number(
            resp.headers.get('retry-after')
          ) || 60;

        throw new Error(
          `FAIRECONOMY_RATE_LIMIT:${retryAfter}`
        );
      }

      const data = await resp.json();

      if (Array.isArray(data) && data.length > 0) {
        eventsJson = data;
        console.log('[FF_FEED]', url, data.length);
        break;
      }
    } catch (err: any) {
      if (
        String(err?.message).startsWith(
          'FAIRECONOMY_RATE_LIMIT:'
        )
      ) {
        throw err;
      }

      continue;
    }
  }

  if (!eventsJson) {
    throw new Error('Unable to load FairEconomy feed');
  }

  console.log('[FF_FEED_COUNT]', eventsJson.length);

  const items = eventsJson.map((e: any) => {
    return {
      currency: e.country,
      impact: e.impact,
      event: e.title,
      actual: e.actual,
      forecast: e.forecast,
      previous: e.previous,
      scheduled_iso: new Date(e.date).toISOString()
    };
  });

  const evs = items.map(mapItem);

  log({
    stage: 'FF_PAYLOAD_TRACE',
    message: 'Parsed ForexFactory (via FairEconomy) payload',
    data: {
      normalized_events: evs.length
    }
  });

  console.log(
    '[FF_COUNT]',
    JSON.stringify({
      normalized: evs.length
    })
  );

  // weekAnchorIso is currently ignored because FF JSON feed acquisition
  // is fixed to `thisweek`. Kept for signature compatibility.
  void weekAnchorIso;
  console.log(
    '[FF_IMPACT_COUNTS]',
    {
      HIGH: evs.filter(e => e.impact === 'HIGH').length,
      MEDIUM: evs.filter(e => e.impact === 'MEDIUM').length,
      LOW: evs.filter(e => e.impact === 'LOW').length,
      UNDEFINED: evs.filter(e => !e.impact).length
    }
  );

  console.log(
    '[FF_HIGH_MEDIUM]',
    evs
      .filter(
        e =>
          e.impact === 'HIGH' ||
          e.impact === 'MEDIUM'
      )
      .map(e => ({
        title: e.name,
        impact: e.impact,
        currency: e.currency
      }))
  );
  return evs;
}

function mapItem(it: any): MacroReleaseEvent {
  const impact = normalizeImpact(it.impact);
  const scheduled = it.scheduled_iso || null;
  const category = classifyCategory(it.event);
  const ev: MacroReleaseEvent = {
    id: stableIdForParts(it.currency || 'GLOBAL', category, scheduled, it.event),
    native_id: null,
    name: it.event,
    category,
    currency: it.currency || 'GLOBAL',
    impact: impact,
    impact_score: impact === 'HIGH' ? 1 : impact === 'MEDIUM' ? 0.6 : 0.2,
    timezone: NY_ZONE,
    scheduled_time: scheduled,
    forecast: tryParseNumber(it.forecast),
    previous: tryParseNumber(it.previous),
    actual: tryParseNumber(it.actual),
    lifecycle_phase: undefined,
    window_boundaries: undefined,
    volatility_risk: computeVolatilityByImpact(impact),
    confidence: 1,
    provenance: { source: 'forexfactory', payload_hash: '' },
    affected_assets: deriveAffectedAssets(it.event, it.currency),
    execution_confidence: null
  } as MacroReleaseEvent;

  try {
    ev.window_boundaries = computeWindowsForEvent(ev as any) as any;
  } catch {
    // ignore window compute errors
  }

  return ev;
}

function deriveAffectedAssets(event: string, currency: string) {
  const assets: string[] = [];
  if (currency) assets.push(currency);
  if ((currency || '').toUpperCase() === 'USD') assets.push('DXY', 'US10Y');
  void event;
  return assets;
}

function classifyCategory(title: string) {
  const t = (title || '').toLowerCase();
  if (t.includes('cpi') || t.includes('inflation')) return 'CPI';
  if (t.includes('pce')) return 'PCE';
  if (t.includes('gdp')) return 'GDP';
  if (t.includes('unemployment') || t.includes('nfp') || t.includes('jobs')) return 'LABOR';
  if (t.includes('rate') || t.includes('fomc') || t.includes('interest')) return 'RATES';
  return 'OTHER';
}

// Adapter class (kept but hardened: no overlapping setInterval-based recursion)
import { ingestionController } from './ingestion-controller.ts';
import { log } from '../../../shared/utils/logger.ts';
import metrics from '../monitoring/shadow-metrics.ts';

type FFOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
};

export class ForexFactoryAdapter {
  private intervalMs: number;
  private timeoutMs: number;
  private maxRetries: number;
  private timer?: NodeJS.Timeout | null;
  private stopped = false;
  private lastSeenIds: Map<string, number> = new Map();
  private LAST_SEEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private lastSeenPruneTimer?: NodeJS.Timeout | null;
  private adapter_health_score = 1.0;
  private MIN_HEALTH_THRESHOLD = 0.4;

  constructor(opts?: FFOptions) {
    this.intervalMs = opts?.intervalMs ?? 5 * 60 * 1000; // 5 minutes
    this.timeoutMs = opts?.timeoutMs ?? 15 * 1000;
    this.maxRetries = opts?.maxRetries ?? 3;
    this.timer = null;
    this.lastSeenPruneTimer = null;
  }

  start() {
    this.stopped = false;
    this.poll();
    this.schedulePrune();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.lastSeenPruneTimer) clearTimeout(this.lastSeenPruneTimer);
  }

  private schedulePrune() {
    if (this.stopped) return;
    this.lastSeenPruneTimer = setTimeout(() => {
      this.pruneLastSeenIds();
      this.schedulePrune();
    }, this.LAST_SEEN_TTL_MS);
  }

  private async poll(retry = 0) {
    if (this.stopped) return;

    try {
      log({
        stage: 'FOREXFACTORY_FETCH',
        message: 'Polling ForexFactory calendar',
        data: { timestamp: new Date().toISOString() }
      });

      const items = await fetchForexFactoryCalendar();

      const payloads: any[] = [];

      for (const it of items) {
        if (!it) continue;

        const titleVal = it.name;
        if (!titleVal) continue;

        const pid = it.id;

        const nowTs = Date.now();
        const prev = this.lastSeenIds.get(pid);

        if (
          prev &&
          nowTs - prev < this.LAST_SEEN_TTL_MS
        ) {
          continue;
        }

        this.lastSeenIds.set(pid, nowTs);

        payloads.push({
          id: pid,
          title: it.name,
          currency: it.currency,
          impact: it.impact,
          scheduled_time: it.scheduled_time,
          actual: it.actual,
          forecast: it.forecast,
          previous: it.previous,
          raw: it
        });
      }

      if (payloads.length) {
        ingestionController
          .ingest(
            'forexfactory',
            'forexfactory',
            payloads
          )
          .catch((err: any) => {
            log({
              stage: 'FOREXFACTORY_FETCH_ERROR',
              message: 'Ingestion failed',
              data: {
                error: err?.message
              }
            });
          });
      }

      this.timer = setTimeout(
        () => this.poll(),
        this.intervalMs
      );

    } catch (err: any) {

      log({
        stage: 'FOREXFACTORY_FETCH_ERROR',
        message: 'Fetch failed',
        data: {
          error: err?.message,
          retry
        }
      });

      if (retry < this.maxRetries) {
        const backoff = Math.min(
          60000,
          1000 * Math.pow(2, retry)
        );

        setTimeout(
          () => this.poll(retry + 1),
          backoff
        );
      } else {
        this.timer = setTimeout(
          () => this.poll(),
          this.intervalMs
        );
      }
    }
  }

  private pruneLastSeenIds() {
    const now = Date.now();
    let pruned = 0;
    for (const [k, ts] of Array.from(this.lastSeenIds.entries())) {
      if (now - ts > this.LAST_SEEN_TTL_MS) {
        this.lastSeenIds.delete(k);
        pruned++;
      }
    }
    if (pruned > 0)
      log({
        stage: 'FOREXFACTORY_ID_PRUNE',
        message: 'Pruned expired last-seen ids',
        data: { count: pruned }
      });
    metrics.setGauge('adapter_health_score', this.adapter_health_score as any);
    metrics.setGauge('shadow_memory_size', this.lastSeenIds.size as any);
  }
}
export default fetchForexFactoryCalendar;

