import * as fs from "fs";
import * as path from "path";
import { RetrievalTrace } from "./types";

const TRACE_DIR = path.join(process.cwd(), "data/eval/traces");

export class RetrievalTracer {
  private currentTrace: Partial<RetrievalTrace> | null = null;

  constructor() {
    if (!fs.existsSync(TRACE_DIR)) {
      fs.mkdirSync(TRACE_DIR, { recursive: true });
    }
  }

  public startTrace(queryId: string, originalQuery: string) {
    this.currentTrace = {
      timestamp: new Date().toISOString(),
      query_id: queryId,
      original_query: originalQuery,
      expanded_queries: [],
      steps: {
        vector_results_count: 0,
        bm25_results_count: 0,
        ontology_boosts: []
      },
      pre_rerank_ranking: [],
      post_rerank_ranking: [],
      final_chunks: [],
      rejected_chunks: []
    };
  }

  public logExpandedQueries(queries: string[]) {
    if (this.currentTrace) {
      this.currentTrace.expanded_queries = queries;
    }
  }

  public logStep(vectorCount: number, bm25Count: number) {
    if (this.currentTrace && this.currentTrace.steps) {
      this.currentTrace.steps.vector_results_count = vectorCount;
      this.currentTrace.steps.bm25_results_count = bm25Count;
    }
  }

  public logOntologyBoost(chunkId: string, bonus: number, matchedConcepts: string[]) {
    if (this.currentTrace && this.currentTrace.steps) {
      this.currentTrace.steps.ontology_boosts.push({
        chunk_id: chunkId,
        bonus,
        matched_concepts: matchedConcepts
      });
    }
  }

  public logPreRerank(ranking: Array<{ chunk_id: string; score: number }>) {
    if (this.currentTrace) {
      this.currentTrace.pre_rerank_ranking = ranking;
    }
  }

  public logPostRerank(ranking: Array<{ chunk_id: string; score: number }>) {
    if (this.currentTrace) {
      this.currentTrace.post_rerank_ranking = ranking;
    }
  }

  public logFinal(chunks: any[]) {
    if (this.currentTrace) {
      this.currentTrace.final_chunks = chunks;
    }
  }

  public saveTrace(): string | null {
    if (!this.currentTrace) return null;

    const filename = `${this.currentTrace.query_id}_${Date.now()}.json`;
    const filepath = path.join(TRACE_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(this.currentTrace, null, 2));
    
    const traceId = this.currentTrace.query_id;
    this.currentTrace = null;
    return filepath;
  }

  public getActiveTrace(): Partial<RetrievalTrace> | null {
    return this.currentTrace;
  }
}

export const retrievalTracer = new RetrievalTracer();
