import { RetrievalTrace } from "./types";
import { ontologyLoader } from "../3.query/ontology/loader";

export interface ConceptStats {
  canonical: string;
  retrieval_frequency: number; // How many times it appeared in ANY retrieval result
  utility_count: number;       // How many times it appeared in Top 5
  total_appearances: number;   // How many chunks actually have this concept
}

export class DriftAnalyzer {
  private stats: Map<string, ConceptStats> = new Map();

  /**
   * Process a trace to update concept statistics.
   */
  public processTrace(trace: RetrievalTrace) {
    const allConceptsInTrace = new Set<string>();
    const top5Concepts = new Set<string>();

    // 1. Capture concepts from all final chunks
    trace.final_chunks.forEach((chunk, index) => {
      const ann = ontologyLoader.getAnnotation(chunk.chunk_id);
      if (!ann) return;

      ann.concepts.forEach(c => {
        allConceptsInTrace.add(c.canonical);
        if (index < 5) top5Concepts.add(c.canonical);
      });
    });

    // 2. Update stats
    allConceptsInTrace.forEach(concept => {
      const s = this.getOrCreateStats(concept);
      s.retrieval_frequency++;
      if (top5Concepts.has(concept)) {
        s.utility_count++;
      }
    });
  }

  /**
   * Identifies concepts that might be "junk" or "noisy".
   */
  public detectDrift() {
    const flags: Array<{ concept: string; issue: string; severity: "low" | "high" }> = [];
    
    this.stats.forEach((s, concept) => {
      // Issue 1: High Retrieval Frequency but Low Utility
      const utilityRatio = s.utility_count / s.retrieval_frequency;
      if (s.retrieval_frequency > 10 && utilityRatio < 0.2) {
        flags.push({
          concept,
          issue: `Low utility ratio (${(utilityRatio * 100).toFixed(1)}%). Often retrieved but rarely in Top 5.`,
          severity: "high"
        });
      }

      // Issue 2: Overshadowing (Concept appears in too many results, causing noise)
      // We can compare against total chunks if we had that number here.
      // For now, let's flag concepts that appear in > 80% of all traces processed.
    });

    return flags;
  }

  private getOrCreateStats(concept: string): ConceptStats {
    if (!this.stats.has(concept)) {
      const annCount = ontologyLoader.getChunksByConcept(concept).length;
      this.stats.set(concept, {
        canonical: concept,
        retrieval_frequency: 0,
        utility_count: 0,
        total_appearances: annCount
      });
    }
    return this.stats.get(concept)!;
  }
}
