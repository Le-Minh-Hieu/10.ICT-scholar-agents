import { log } from "../../../shared/utils/logger.js";
import { normalizeProviderPayload } from "../services/normalizer.js";
import Deduper from "../services/deduper.js";
import { scoreSource } from "../services/source-trust.js";
import { scoreQuality } from "../services/quality-scorer.js";
import stagingEventStore from "../staging/staging-event-store.js";
import metrics from "../monitoring/shadow-metrics.js";
import type { NewsEvent } from "../schemas/news-event.js";

export class IngestionController {
  private acceptedMinTrust = 0.2;
  private maxAcceptedPerCycle = 20;
  private duplicateCooldownSeconds = 300; // 5 minutes
  private lastAcceptedByGroup: Map<string, number> = new Map();
  public SHADOW_MODE = true; // when true, events are staged but marked shadow; excluded from default accepted events
  public MAX_SHADOW_REASONING_EVENTS = 5; // max selected events to reason in shadow per cycle
  private deduperProduction = new Deduper();
  private deduperShadow = new Deduper();
  private sourceScoreCache =
    new Map<
      string,
      {
        score: number;
        expires: number;
      }
    >();

  async ingest(provider_id: string, source_id: string, rawPayloads: any[]) {
    const meta = { provider_id, source_id };
    let acceptedThisCycle = 0;

    for (const p of rawPayloads) {
      if (acceptedThisCycle >= this.maxAcceptedPerCycle) {
        log({
          stage: "NEWS_RATE_LIMIT",
          message: "Max accepted events per cycle reached",
          data: { provider: provider_id, source: source_id, allowed: this.maxAcceptedPerCycle }
        });
        log({
          stage: "NEWS_THROTTLE",
          message: "Throttling remaining payloads for this cycle",
          data: { provider: provider_id, source: source_id, remaining: rawPayloads.length - acceptedThisCycle }
        });
        break;
      }

      const shadow = this.SHADOW_MODE === true;

      try {
        const draft = await normalizeProviderPayload(p, meta);
        const ev = draft as NewsEvent;

        if (!ev || !ev.id) {
          log({
            stage: "NEWS_EVENT_REJECTED",
            message: "Missing event id after normalization",
            data: { provider: provider_id, shadow, event_id: null, reason: "missing_id" },
            level: "ERROR"
          });
          continue;
        }

        // dedupe against partition-specific staging
        let existing: any[] = [];
        if (shadow) {
          existing = stagingEventStore.getAllShadow();
          log({
            stage: "SHADOW_PARTITION_DEDUPE",
            message: "Deduping against shadow partition",
            data: { provider: provider_id }
          });
        } else {
          existing = stagingEventStore.getAllProduction();
          log({
            stage: "PRODUCTION_PARTITION_DEDUPE",
            message: "Deduping against production partition",
            data: { provider: provider_id }
          });
        }

        const dup = (shadow ? this.deduperShadow : this.deduperProduction).dedupe(ev, existing as any[]);
        if (dup.duplicate_group_id) ev.duplicate_group_id = dup.duplicate_group_id;
        if (dup.update_chain && dup.update_chain.length) ev.update_chain = (ev.update_chain || []).concat(dup.update_chain);

        const cacheKey =
          `${provider_id}:${source_id}`;

        const cached =
          this.sourceScoreCache.get(cacheKey);

        let srcScore: number;

        if (
          cached &&
          cached.expires > Date.now()
        ) {

          srcScore = cached.score;

        } else {

          srcScore =
            scoreSource(
              provider_id,
              source_id,
              {}
            );

          this.sourceScoreCache.set(
            cacheKey,
            {
              score: srcScore,
              expires:
                Date.now() +
                1000 * 60 * 60
            }
          );
        }
        const q = scoreQuality(ev);

        ev.confidence = q.confidence * srcScore;
        if (srcScore < this.acceptedMinTrust) ev.rumor_flag = true;

        // Duplicate cooldown: suppress repeated duplicate groups within window
        if (ev.duplicate_group_id) {
          const gid = ev.duplicate_group_id;
          const last = this.lastAcceptedByGroup.get(gid) || 0;
          const nowTs = Date.now();
          if ((nowTs - last) / 1000 < this.duplicateCooldownSeconds) {
            log({
              stage: "NEWS_EVENT_REJECTED",
              message: "Duplicate cooldown active",
              data: { provider: provider_id, shadow, event_id: ev.id, reason: "duplicate_cooldown", group: gid }
            });
            continue;
          }
        }

        // compute TTL / expires_at based on persistence class
        let expiresAt: string | null = null;
        const now = Date.now();
        switch (ev.persistence_class) {
          case "EPHEMERAL":
            expiresAt = new Date(now + 1000 * 60 * 60).toISOString(); // 1 hour
            break;
          case "SESSION":
            expiresAt = new Date(now + 1000 * 60 * 60 * 24).toISOString(); // 24 hours
            break;
          case "MULTI_SESSION":
            expiresAt = new Date(now + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 days
            break;
          case "TRANSITIONAL":
            expiresAt = new Date(now + 1000 * 60 * 60 * 12).toISOString(); // 12 hours
            break;
          case "REGIME":
            expiresAt = new Date(now + 1000 * 60 * 60 * 24 * 365).toISOString(); // 1 year
            break;
          default:
            expiresAt = new Date(now + 1000 * 60 * 60 * 24).toISOString();
        }

        // Append to staging (immutable ledger) with TTL metadata
        const finalConfidence = shadow ? q.confidence : q.confidence * srcScore;
        ev.confidence = finalConfidence;
        stagingEventStore.append(ev, { expires_at: expiresAt, is_shadow: shadow });

        log({
          stage: "NEWS_INGESTION",
          message: "Appended event to staging",
          data: {
            provider: provider_id,
            source: source_id,
            id: ev.id,
            trust: srcScore,
            confidence: ev.confidence,
            duplicate_group: ev.duplicate_group_id,
            expires_at: expiresAt,
            is_active: true
          }
        });

        log({
          stage: "NEWS_EVENT_ACCEPTED",
          message: "News event accepted into staging (shadow partition)",
          data: { provider: provider_id, shadow, event_id: ev.id }
        });

        if (ev.duplicate_group_id) this.lastAcceptedByGroup.set(ev.duplicate_group_id, Date.now());
        acceptedThisCycle++;
        metrics.recordMetric("ingest_count", 1);
      } catch (err: any) {
        const maybeId = (p && (p.id || p.link || p.url)) ? (p.id || p.link || p.url) : null;

        log({
          stage: "NEWS_EVENT_REJECTED",
          message: "Normalization/ingestion failed",
          data: { provider: provider_id, shadow, event_id: maybeId, reason: err?.message || "ingestion_failed" },
          level: "ERROR"
        });

        log({
          stage: "NEWS_INGESTION",
          message: "Normalization/ingestion failed",
          data: { provider: provider_id, source: source_id, error: err?.message },
          level: "ERROR"
        });

        metrics.recordMetric("parse_failures", 1);
      }
    }
  }

  getAcceptedEvents(): NewsEvent[] {
    // return active staging events that pass minimal acceptance criteria (exclude shadow events by default)
    const all = stagingEventStore.getActiveEvents(false);
    return all.filter(e => (e.confidence ?? 0) > 0.05).map(e => ({ ...e }));
  }

  // Shadow-only: select a bounded set of events for shadow reasoning based on prioritization
  selectShadowReasoningCandidates(): { selected: NewsEvent[]; skipped: NewsEvent[] } {
    if (!this.SHADOW_MODE) return { selected: [], skipped: [] };
    const pool =
      stagingEventStore
        .getActiveShadowEvents()
        .filter((ev: any) => !ev.shadow_reasoned)
        .map((s: any) => s.event)
    // precompute duplicate group counts to avoid O(n^2)
    const duplicateGroupCounts: Record<string, number> = {};
    for (const ev of pool) {
      if (ev.duplicate_group_id) duplicateGroupCounts[ev.duplicate_group_id] = (duplicateGroupCounts[ev.duplicate_group_id] || 0) + 1;
    }

    // compute lightweight priority
    const scored = pool.map(ev => {
      const trust = scoreSource(ev.provider_id, ev.source_id, {});
      const quality = typeof ev.confidence === 'number' ? ev.confidence : 0;
      const novelty = (ev.update_chain && ev.update_chain.length) ? 1 / (1 + ev.update_chain.length) : 1;
      const duplicateDensity = ev.duplicate_group_id ? (duplicateGroupCounts[ev.duplicate_group_id] || 0) : 0;
      const duplicatePenalty = Math.min(1, duplicateDensity / 10);
      const ageSeconds = Math.max(0, (Date.now() - (new Date(ev.observed_at || ev.published_at || Date.now()).getTime())) / 1000);
      const freshness = Math.max(0, 1 - Math.min(1, ageSeconds / (60 * 60 * 24)));
      const score = trust * 0.4 + quality * 0.3 + novelty * 0.15 + freshness * 0.15 - duplicatePenalty * 0.2;
      return { ev, score, trust, quality, novelty, duplicateDensity, freshness };
    });

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, this.MAX_SHADOW_REASONING_EVENTS).map(x => x.ev);
    const skipped = scored.slice(this.MAX_SHADOW_REASONING_EVENTS).map(x => x.ev);

    log({
      stage: "SHADOW_CANDIDATE_SELECTED",
      message: "Shadow reasoning candidate set selected",
      data: {
        count: selected.length,
        ids: selected.map(s => s.id),
        providers: Array.from(new Set(selected.map(s => s.provider_id)))
      }
    });

    for (const s of selected) {
      log({
        stage: "SHADOW_REASONING_SELECTED",
        message: "Selected event for shadow reasoning",
        data: { id: s.id, provider: s.provider_id }
      });
      metrics.recordMetric("shadow_selected", 1);
    }
    for (const s of skipped) {
      log({
        stage: "SHADOW_REASONING_SKIPPED",
        message: "Skipped event for shadow reasoning",
        data: { id: s.id, provider: s.provider_id }
      });
      metrics.recordMetric("shadow_skipped", 1);
    }

    // metrics: memory and saturation
    metrics.setGauge('shadow_memory_size', stagingEventStore.getShadowCount() as any);
    metrics.setGauge('production_memory_size', stagingEventStore.getProductionCount() as any);
    metrics.setGauge('shadow_reasoning_saturation', (selected.length / Math.max(1, this.MAX_SHADOW_REASONING_EVENTS)) as any);

    return { selected, skipped };
  }

  // Read-only accessor for shadow reasoning candidates.
  // Returns a bounded set of shadow events intended only for retrieval/reasoning diagnostics.
  getShadowReasoningCandidates(): { selected: NewsEvent[]; skipped: NewsEvent[] } {
    const result = this.selectShadowReasoningCandidates();
    log({ stage: 'SHADOW_REASONING_ACTIVE', message: 'Shadow reasoning accessor used', data: { selected: result.selected.length, skipped: result.skipped.length } });
    log({ stage: 'SHADOW_REASONING_CANDIDATES', message: 'Shadow reasoning candidates', data: { candidates: result.selected.map(s => s.id) } });
    log({ stage: 'SHADOW_REASONING_ISOLATED', message: 'Shadow reasoning is read-only and isolated from production' });
    return result;
  }
}

export const ingestionController = new IngestionController();

export default ingestionController;
