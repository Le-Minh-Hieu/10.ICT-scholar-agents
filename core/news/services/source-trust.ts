import { log } from "../../../shared/utils/logger.js";

const STATIC_TRUST: Record<string, number> = {
  // explicit whitelist of known trusted providers
  'trusted_provider': 0.95,
  'newswire': 0.9,
  'forexfactory': 0.85,
};

const DEFAULT_UNKNOWN_TRUST = 0.3; // conservative default for unknown providers

export function scoreSource(provider_id: string, source_id: string, meta: any = {}): number {
  const base = STATIC_TRUST[provider_id] ?? DEFAULT_UNKNOWN_TRUST;
  let score = base;

  // freshness penalty (preserve)
  if (meta.last_seen_age_seconds && meta.last_seen_age_seconds > 60 * 60 * 24) {
    score *= 0.8;
  }

  // simple dynamic adjustments (placeholder)
  if (meta.retraction_count && meta.retraction_count > 0) score *= 0.7;

  const final = Math.max(0, Math.min(1, score));
  log({ stage: 'NEWS_SOURCE_QUALITY', message: 'Scored source', data: { provider_id, source_id, score: final } });
  return final;
}

export default scoreSource;
