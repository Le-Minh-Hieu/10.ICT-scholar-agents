import { RetrievalTrace } from "./types";
import { MetricsEngine } from "./metrics";
import { BenchmarkQuery } from "./types";
import { Chunk } from "../3.query/retrieval-core";

export class RerankAnalyzer {
  /**
   * Compares pre-rerank and post-rerank metrics using a captured trace.
   */
  public static analyzeDelta(trace: RetrievalTrace, benchmark: BenchmarkQuery) {
    // Reconstruct pre-rerank chunks (partially, just enough for metrics)
    // In a real scenario, we'd need the full chunk objects. 
    // For this simulation, we'll assume we have them or use IDs.
    
    // Let's assume MetricsEngine can work with just chunk IDs if we mock the text.
    const preRerankChunks: Chunk[] = trace.pre_rerank_ranking.map(r => ({
      chunk_id: r.chunk_id,
      text: "", // Text not needed for concept/session metrics
      score: r.score
    }));

    const postRerankChunks: Chunk[] = trace.post_rerank_ranking.map(r => ({
      chunk_id: r.chunk_id,
      text: "",
      score: r.score
    }));

    const preP5 = MetricsEngine.calculatePrecisionAtK(preRerankChunks, benchmark, 5);
    const postP5 = MetricsEngine.calculatePrecisionAtK(postRerankChunks, benchmark, 5);

    const preNDCG5 = MetricsEngine.calculateNDCGAtK(preRerankChunks, benchmark, 5);
    const postNDCG5 = MetricsEngine.calculateNDCGAtK(postRerankChunks, benchmark, 5);

    return {
      precision_delta: postP5 - preP5,
      ndcg_delta: postNDCG5 - preNDCG5,
      pre: { p5: preP5, ndcg5: preNDCG5 },
      post: { p5: postP5, ndcg5: postNDCG5 }
    };
  }
}
