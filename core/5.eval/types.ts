import { Chunk } from "../3.query/retrieval-core";

/**
 * Hierarchical Benchmark Definition
 * Moves beyond simple chunk IDs to technical requirements.
 */
export interface BenchmarkQuery {
  id: string;
  query: string;
  category: "concept" | "session" | "temporal" | "execution" | "bias";
  
  // Hierarchical Requirements
  requirements: {
    required_concepts: string[];     // Must be present in top results
    preferred_concepts?: string[];   // Good to have
    forbidden_concepts?: string[];   // Penalize if present
    required_sessions?: string[];    // e.g., "LONDON", "NY_AM"
    required_temporal?: string[];    // e.g., "10AM-11AM"
  };

  // Known Good Targets (for legacy/absolute metric comparison)
  expected_chunk_ids?: string[];
  
  // Human metadata
  notes?: string;
  strategically_valuable?: boolean;
}

/**
 * Full Retrieval Trace
 * Captures the "Why" behind every retrieval result.
 */
export interface RetrievalTrace {
  timestamp: string;
  query_id: string;
  original_query: string;
  expanded_queries: string[];
  
  // Scoring steps
  steps: {
    vector_results_count: number;
    bm25_results_count: number;
    ontology_boosts: Array<{
      chunk_id: string;
      bonus: number;
      matched_concepts: string[];
    }>;
  };

  // Ranking states
  pre_rerank_ranking: Array<{
    chunk_id: string;
    score: number;
  }>;
  
  post_rerank_ranking: Array<{
    chunk_id: string;
    score: number;
  }>;

  // Final Output
  final_chunks: Chunk[];
  
  // Rejected but relevant-looking (for drift analysis)
  rejected_chunks: string[];
}

/**
 * Failure Taxonomy Tags
 */
export type FailureTag = 
  | "ALIAS_MISS"      // alias expansion failed
  | "SESSION_MISS"    // wrong session retrieved
  | "TEMPORAL_MISS"   // wrong timing
  | "EXECUTION_MISS"  // theory instead of execution
  | "DRIFT"           // noisy ontology
  | "CHUNK_SPLIT"     // chunk boundary issue
  | "RERANK_FAIL"     // reranker promoted wrong chunk
  | "OVER_EXPANSION"; // ontology expansion polluted retrieval

/**
 * Evaluation Metrics Result
 */
export interface EvaluationReport {
  timestamp: string;
  summary: {
    precision_at_5: number;
    ndcg_at_5: number;
    concept_alignment_rate: number;
    session_accuracy: number;
    rerank_delta: number; // Improvement in precision due to rerank
  };
  details: Array<{
    query_id: string;
    passed: boolean;
    metrics: {
      p5: number;
      ndcg5: number;
      concepts_matched: string[];
      concepts_missing: string[];
      forbidden_found: string[];
      failure_tags: FailureTag[];
    };
  }>;
  drift_flags: Array<{
    concept: string;
    issue: "low_utility" | "high_entropy" | "unstable_alias";
    frequency: number;
  }>;
}
