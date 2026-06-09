import { log } from "../../../shared/utils/logger.js";
import type { NewsEvent } from "../schemas/news-event.js";

// Ingestion-only quality scorer: remains ontology-neutral.
export function scoreQuality(event: Partial<NewsEvent>): { quality_score: number; importance_score: number; confidence: number } {
  const title = (event.title || '').trim();
  const body = (event.canonical_body || '').trim();

  // Completeness measures
  const titleCompleteness = title.length > 0 ? 1 : 0;
  const bodyCompleteness = body.length > 0 ? Math.min(1, body.length / 500) : 0;
  const metadataCompleteness = event.provenance && event.provenance.payload_hash ? 1 : 0;

  // Impact tags presence contributes modestly
  const impactPresence = (event.impact_tags || []).length > 0 ? 0.5 : 0;

  // Duplicate confidence reduces effective quality
  const duplicatePenalty = event.duplicate_group_id ? 0.5 : 1.0;

  // Combine into a neutral quality score
  const completenessScore = 0.5 * titleCompleteness + 0.4 * bodyCompleteness + 0.1 * metadataCompleteness;
  const quality = Math.max(0, Math.min(1, completenessScore * duplicatePenalty + impactPresence * 0.1));

  // Confidence initially relies on provenance+quality; provider trust applied by ingestion controller
  const confidence = typeof event.confidence === 'number' ? event.confidence : quality;

  log({ stage: 'NEWS_EVENT_ACCEPTED', message: 'Quality scored (ingestion-neutral)', data: { id: event.id, quality, confidence } });

  return { quality_score: quality, importance_score: completenessScore, confidence };
}

export default scoreQuality;
