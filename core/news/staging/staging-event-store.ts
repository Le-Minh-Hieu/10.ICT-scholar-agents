import type { NewsEvent } from "../schemas/news-event.js";
import { log } from "../../../shared/utils/logger.js";

type StagedEvent = {
  event: NewsEvent;

  expires_at?: string | null;

  is_active: boolean;

  is_shadow?: boolean;

  inserted_at: string;

  shadow_reasoned?: boolean;

  shadow_reasoned_at?: string;
};

export class StagingEventStore {
  private productionEvents: StagedEvent[] = [];
  private shadowEvents: StagedEvent[] = [];
  private prunedProvenance: Array<{ id: string; provenance: any; archived_at: string; partition: 'production' | 'shadow' }> = [];
  public MAX_PRODUCTION_EVENTS = 2000;
  public MAX_SHADOW_EVENTS = 3000;

  append(ev: NewsEvent, opts?: { expires_at?: string | null; is_shadow?: boolean }) {
    const now = new Date().toISOString();
    const staged: StagedEvent = {
      event: ev,
      expires_at: opts?.expires_at ?? null,
      is_active: true,
      is_shadow: opts?.is_shadow ?? false,
      inserted_at: now
    };

    const target = staged.is_shadow ? this.shadowEvents : this.productionEvents;
    target.push(staged);

    // STAGING_TRACE: trace append details (no logic changes)
    log({ stage: 'STAGING_TRACE', message: 'Appended staged event', data: {
      id: staged.event.id,
      is_active: staged.is_active,
      expires_at: staged.expires_at,
      is_shadow: staged.is_shadow,
      category: staged.event?.category,
      confidence: staged.event?.confidence,
      currency: staged.event?.currency,
      impact: staged.event?.impact,
      provider_id: staged.event?.provider_id,
      source_id: staged.event?.source_id
    } });

    // enforce per-partition retention cap (preserve newest events in each partition)
    if (staged.is_shadow) {
      while (this.shadowEvents.length > this.MAX_SHADOW_EVENTS) {
        const removed = this.shadowEvents.shift();
        if (removed) {
          this.prunedProvenance.push({ id: removed.event.id, provenance: removed.event.provenance, archived_at: new Date().toISOString(), partition: removed.is_shadow ? 'shadow' : 'production' });
          log({ stage: 'SHADOW_RETENTION_PRUNE', message: 'Pruned oldest shadow staging event (provenance preserved)', data: { prunedId: removed.event.id } });
          // metrics.recordMetric('shadow_pruned', 1);
          // metrics.setGauge('shadow_memory_size', this.shadowEvents.length as any);
        }
      }
    } else {
      while (this.productionEvents.length > this.MAX_PRODUCTION_EVENTS) {
        const removed = this.productionEvents.shift();
        if (removed) {
          this.prunedProvenance.push({ id: removed.event.id, provenance: removed.event.provenance, archived_at: new Date().toISOString(), partition: 'production' });
          log({ stage: 'PRODUCTION_RETENTION_PRUNE', message: 'Pruned oldest production staging event (provenance preserved)', data: { prunedId: removed.event.id } });
          // metrics.recordMetric('production_pruned', 1);
          // metrics.setGauge('production_memory_size', this.productionEvents.length as any);
        }
      }
    }

    return ev.id;
  }

  getAll(includeShadow = false): NewsEvent[] {
    // return raw events for dedupe/inspection (including inactive). By default, only production events.
    const prod = this.productionEvents.map(s => s.event);
    if (includeShadow) return prod.concat(this.shadowEvents.map(s => s.event));
    return prod;
  }

  getAllProduction(): NewsEvent[] {
    return this.productionEvents.map(s => s.event);
  }

  getAllShadow(): NewsEvent[] {
    return this.shadowEvents.map(s => s.event);
  }

  private processExpiryAndCollect(list: StagedEvent[], includeShadow: boolean): NewsEvent[] {
    const now = new Date();
    const active: NewsEvent[] = [];
    for (const s of list) {
      if (!s.is_active) continue;
      const expired = !!(s.expires_at && new Date(s.expires_at) <= now);
      if (expired) {
        s.is_active = false;
        log({ stage: 'NEWS_EVENT_EXPIRED', message: 'Event expired in staging', data: { id: s.event.id, provider: s.event.provider_id, expires_at: s.expires_at } });
        log({ stage: 'NEWS_EVENT_DEACTIVATED', message: 'Event deactivated in staging', data: { id: s.event.id, provider: s.event.provider_id, is_active: false } });
      } else {
        active.push(s.event);
      }

      // STAGING_TRACE: per-item expiry processing result
      log({ stage: 'STAGING_TRACE', message: 'Processed staging item expiry check', data: {
        id: s.event.id,
        expired,
        expires_at: s.expires_at,
        is_active: s.is_active
      } });
    }
    return active;
  }

  getActiveEvents(includeShadow = false): NewsEvent[] {
    const prodActive = this.processExpiryAndCollect(this.productionEvents, false);
    if (includeShadow) {
      const shadowActive = this.processExpiryAndCollect(this.shadowEvents, true);
      // STAGING_TRACE: return counts per partition
      log({ stage: 'STAGING_TRACE', message: 'getActiveEvents counts', data: { production_active: prodActive.length, shadow_active: shadowActive.length } });
      return prodActive.concat(shadowActive);
    }
    log({ stage: 'STAGING_TRACE', message: 'getActiveEvents counts', data: { production_active: prodActive.length, shadow_active: 0 } });
    return prodActive;
  }

  getActiveShadowEvents(): StagedEvent[] {

    this.processExpiryAndCollect(
      this.shadowEvents,
      true
    );

    return this.shadowEvents.filter(
      s => s.is_active
    );
  }

  getById(id: string): NewsEvent | undefined {
    const found = this.productionEvents.find(e => e.event.id === id) || this.shadowEvents.find(e => e.event.id === id);
    return found ? found.event : undefined;
  }

  getProvenanceOnly(id: string) {
    return this.prunedProvenance.find(p => p.id === id);
  }

  // Partition counters and stats
  getProductionCount() {
    return this.productionEvents.length;
  }

  getShadowCount() {
    return this.shadowEvents.length;
  }
}

export const stagingEventStore = new StagingEventStore();

export default stagingEventStore;
