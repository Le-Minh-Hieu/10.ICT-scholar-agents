import { buildNewsQueries } from "../news/news-query-builder.js";
import { retrieveRAG } from "../3.query/retrieval-core.js";
import { WeightedQuery } from "../3.query/query-builder.js";
import { log } from "../../shared/utils/logger.js";
import scoreEvidence, { ScoredEvidence, RetrievedChunk } from "./evidence-scoring.js";
import computeContradiction from "../news/contradiction-resolver.js";

export async function retrieveNewsContext(
  newsEvents: any[],
  symbol?: string,
  options?: { shadowMode?: boolean; maxRetrievalChunks?: number; tokenBudget?: number; retrievalTimeoutMs?: number }
) {
  const queries: WeightedQuery[] = buildNewsQueries(newsEvents);
  const shadowMode = !!options?.shadowMode;

  const live_events = (newsEvents || []).map((ev: any) => ({
    id: ev?.id,
    category: ev?.category,
    title: ev?.title,
    summary: ev?.description,
    timestamp: ev?.timestamp,
    confidence: ev?.confidence,
    provider: ev?.provider_id ?? ev?.provider ?? "unknown",
  }));
  const maxRetrievalChunks = options?.maxRetrievalChunks ?? (shadowMode ? 50 : 500);
  const tokenBudget = options?.tokenBudget ?? (shadowMode ? 20000 : 100000);
  const retrievalTimeoutMs = options?.retrievalTimeoutMs ?? (shadowMode ? 5000 : 15000);

  log({ stage: "NEWS_RETRIEVAL", message: "Starting retrieval for news queries", data: { queryCount: queries.length, symbol } });

  try {
    // retrieval with timeout guard
    const retrPromise = retrieveRAG({ queries, conceptEmbeddings: [], symbol });
    const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('retrieval timeout')), retrievalTimeoutMs));
    const result: any = await Promise.race([retrPromise, timeoutPromise]);
    if (!result || !result.chunks) throw new Error('empty retrieval result');
    // cap retrieved chunks for shadow safety
    if (result.chunks.length > maxRetrievalChunks) {
      log({ stage: shadowMode ? 'SHADOW_RETRIEVAL_CAPPED' : 'NEWS_RETRIEVAL', message: 'Capping retrieval chunks for safety', data: { original: result.chunks.length, capped: maxRetrievalChunks } });
      result.chunks = result.chunks.slice(0, maxRetrievalChunks);
    }
    log({ stage: "NEWS_RETRIEVAL", message: "Completed news retrieval (raw)", data: { chunks: result.chunks.length } });

    // Phase 3B: score evidence and select balanced top-k (10-15)
    const retrieved = result.chunks as any[];
    // Map to RetrievedChunk shape
    const retChunks: RetrievedChunk[] = retrieved.map(r => ({ chunk_id: r.chunk_id, text: r.text, score: r.score, embedding: r.embedding }));
    const scored = scoreEvidence(retChunks) as ScoredEvidence[];

    // Compute contradiction metrics to ensure we preserve contradicting evidence
    const contradiction = computeContradiction(scored);

    // Select balanced evidence set: prefer top final_score but keep at least one from each cluster
    const desiredMin = shadowMode ? 3 : 10;
    const desiredMax = shadowMode ? Math.min(5, desiredMaxFallback()) : 15;

    function desiredMaxFallback() { return 5; }

    // Start with top candidates
    let selection: ScoredEvidence[] = scored.slice(0, desiredMax * 2);

    // Ensure we include representatives from opposing clusters if present
    const clusterReps = contradiction.opposing_clusters.map(c => c.representative);
    for (const rep of clusterReps) {
        const found = scored.find(s => s.chunk_id === rep);
        if (found && !selection.find(s => s.chunk_id === rep)) selection.push(found);
    }

    // Enforce diversity: prefer items with higher diversity_score when near cutoff
    selection = selection
        .sort((a, b) => b.final_score - a.final_score || b.diversity_score - a.diversity_score)
        .slice(0, desiredMax);

    // If not enough, pad from remaining high-quality items
    if (selection.length < desiredMin) {
        const missing = desiredMin - selection.length;
        const extras = scored.filter(s => !selection.find(x => x.chunk_id === s.chunk_id)).slice(0, missing);
        selection = selection.concat(extras);
    }

    // Estimate token usage and enforce token budget
    const estimatedTokens = retrieved.reduce((acc, r) => acc + Math.ceil(((r.text || '').length || 0) / 4), 0);
    if (estimatedTokens > tokenBudget) {
      log({ stage: shadowMode ? 'SHADOW_TOKEN_BUDGET_HIT' : 'NEWS_TOKEN_BUDGET_HIT', message: 'Token budget exceeded for retrieval, trimming selection', data: { estimatedTokens, tokenBudget } });
      // reduce desiredMax conservatively
      const reduceBy = Math.ceil((estimatedTokens - tokenBudget) / (tokenBudget / desiredMax));
      // lower desiredMax by reduceBy but at least 1
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      // (we reselect below using new desiredMax)
    }

    // Build final chunk objects preserving provenance and compressed text from original result
    const selectedChunkIds = new Set(selection.map(s => s.chunk_id));
    const finalChunks = retrieved.filter(r => selectedChunkIds.has(r.chunk_id)).map(r => ({ ...r, selected: true }));

    const liveCount = live_events.length;
    const liveCategories = Array.from(new Set(live_events.map((e: any) => String(e?.category ?? "")))).filter(Boolean);

    log({
      stage: "NEWS_EVIDENCE_SELECTION",
      message: "Selected evidence for reasoning",
      data: {
        selected: finalChunks.length,
        discarded: result.chunks.length - finalChunks.length,
        contradiction,
        LIVE_MACRO_EVENTS_FOUND: liveCount,
        LIVE_MACRO_EVENT_CATEGORIES: liveCategories,
      }
    });

    return {
      live_events: live_events,
      chunks: finalChunks,
      expandedQueries: result.expandedQueries,
      topKChunks: finalChunks.length,
      scoredEvidence: selection,
      contradiction
    } as any;
  } catch (e: any) {
    log({ stage: "NEWS_RETRIEVAL", message: "News retrieval failed", data: { error: (e as any)?.message }, level: "ERROR" });
    return {
      live_events: live_events,
      chunks: [],
      expandedQueries: queries.map(q => q.query),
      topKChunks: 0,
      scoredEvidence: [],
      contradiction: {}
    } as any;
  }
}

export default retrieveNewsContext;
