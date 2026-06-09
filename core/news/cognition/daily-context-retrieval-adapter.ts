import { retrieveRAG } from "../../3.query/retrieval-core.js";
import type { DailyBridgeContext, DailyQueryCandidate } from "../daily-context.js";
import { trace } from "../trace-utils.js";

function dedupeChunks(chunks: any[]) {
  const byId = new Map<string, any>();
  for (const chunk of chunks || []) {
    const key = String(chunk?.chunk_id || chunk?.id || "");
    if (!key) continue;
    if (!byId.has(key)) {
      byId.set(key, chunk);
    }
  }
  return Array.from(byId.values());
}

export async function retrieveForDailyContext(
  bridge: DailyBridgeContext,
  opts?: { pmso?: any; limit?: number }
) {
  const rankedQueries = (bridge.query_candidates || []).slice(0, opts?.limit || 10);
  const queries = rankedQueries.map((x: DailyQueryCandidate) => x.query);

  trace("DAILY_RETRIEVAL", "Initiating daily retrieval", {
    market_date: bridge.market_date,
    market_weekday: bridge.market_weekday,
    query_count: queries.length,
    queries
  });

  const rag = await retrieveRAG({
    queries,
    conceptEmbeddings: [],
    pmso: opts?.pmso
  });

  const chunks = dedupeChunks(rag?.chunks || []);
  trace("DAILY_RETRIEVAL", "Completed daily retrieval", {
    market_date: bridge.market_date,
    market_weekday: bridge.market_weekday,
    retrieved_count: chunks.length,
    chunk_ids: chunks.slice(0, 20).map((c: any) => c.chunk_id)
  });
  console.log("[DAILY_RETRIEVAL]", JSON.stringify({
    market_date: bridge.market_date,
    market_weekday: bridge.market_weekday,
    generated_queries: queries,
    retrieved_chunks_count: chunks.length
  }));

  return {
    queries,
    rankedQueries,
    rag: {
      ...(rag || {}),
      chunks
    }
  };
}

export default retrieveForDailyContext;
