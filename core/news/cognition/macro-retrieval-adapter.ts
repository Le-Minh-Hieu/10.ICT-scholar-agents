import { retrieveRAG } from "../../3.query/retrieval-core.js";
import type { MacroContextState } from "../macro-context.js";
import { trace } from "../trace-utils.js";
import buildWeeklyProfileQuery
  from "./weekly-profile-query-builder.js";

export async function retrieveForMacroProfile(profile: MacroContextState, opts?: { pmso?: any }) {
  const queries: string[] = [];
  const profileQuery =
    buildWeeklyProfileQuery({
      active_events:
        profile.active_events,

      upcoming_events:
        profile.upcoming_events
    });

  queries.push(
    profileQuery.weekly_profile_query
  );
  trace('MACRO_RETRIEVAL_TRACE', 'Initiating macro retrieval', {
    week: profile.week_start,
    week_type: profile.week_type,
    drivers: profile.primary_drivers || [],
    regime: profile.regime || {},
    built_queries: queries.slice(0, 20)
  });

  let rag =
    await retrieveRAG({
      queries: [
        profileQuery.weekly_profile_query
      ],
      conceptEmbeddings: [],
      pmso: opts?.pmso
    });

  console.log(
    "[WEEKLY_RETRIEVAL_ADAPTER]",
    JSON.stringify({
      week: profile.week_start,
      query_count: queries.length,
      queries,
      topKChunks: rag?.topKChunks ?? null,
      retrieved_chunks_count: (rag?.chunks || []).length,
      chunk_ids: (rag?.chunks || []).slice(0, 20).map((c: any) => c.chunk_id)
    })
  );

  // Log summary of retrieved chunks
  const chunks = (rag?.chunks || []).slice(0, 10).map((c: any) => ({ id: c.chunk_id, text: (c.text || '').slice(0, 200) }));
  trace('MACRO_RETRIEVAL_TRACE', 'Retrieval completed', { week: profile.week_start, retrieved_count: (rag?.chunks || []).length, top_chunks: chunks });
  return {
    queries,
    rag
  };

}

export default retrieveForMacroProfile;
