import type { NewsEventDraft, NewsEvent } from "../schemas/news-event.js";
import { log } from "../../../shared/utils/logger.js";

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}

export async function normalizeProviderPayload(payload: any, meta: { provider_id: string; source_id: string }): Promise<NewsEventDraft> {
  const now = new Date().toISOString();

  const draft: NewsEventDraft = {
    id: genId(),
    provider_id: meta.provider_id,
    source_id: meta.source_id,
    published_at: payload.published_at || payload.pubDate || now,
    observed_at: now,
    title: (payload.title || payload.headline || '').toString(),
    canonical_body: (payload.body || payload.description || payload.content || '').toString(),
    event_type: (payload.event_type || 'OTHER') as any,
    persistence_class: (payload.persistence_class || 'EPHEMERAL') as any,
    importance_score: typeof payload.importance_score === 'number' ? payload.importance_score : 0,
    impact_tags: payload.impact_tags || [],
    confidence: typeof payload.confidence === 'number' ? payload.confidence : 0.5,
    provenance: {
      provider_id: meta.provider_id,
      source_id: meta.source_id,
      original_url: payload.url || payload.link,
      payload_hash: String(payload.id || payload.url || genId()),
      fetched_at: now
    }
  };

  log({ stage: "NEWS_NORMALIZATION", message: "Normalized provider payload", data: { provider: meta.provider_id, source: meta.source_id, id: draft.id } });

  return draft;
}

export default normalizeProviderPayload;
