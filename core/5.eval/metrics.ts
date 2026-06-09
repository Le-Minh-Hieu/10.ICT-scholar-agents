
import { Chunk } from "../3.query/retrieval-core.js";
import { BenchmarkQuery } from "./types.js";
import { ontologyLoader } from "../3.query/ontology/loader.js";
import { ScenarioMemory } from "../../shared/knowledge/scenario-types.js";

export class MetricsEngine {
  /**
   * Precision@K: Fraction of top K results that are relevant.
   */
  public static calculatePrecisionAtK(chunks: Chunk[], benchmark: BenchmarkQuery, k: number = 5): number {
    const topK = chunks.slice(0, k);
    if (topK.length === 0) return 0;
    let relevantCount = 0;
    for (const chunk of topK) {
      if (this.isRelevant(chunk, benchmark)) relevantCount++;
    }
    return relevantCount / k;
  }

  /**
   * nDCG@K: Normalized Discounted Cumulative Gain.
   */
  public static calculateNDCGAtK(chunks: Chunk[], benchmark: BenchmarkQuery, k: number = 5): number {
    const topK = chunks.slice(0, k);
    if (topK.length === 0) return 0;
    let dcg = 0;
    for (let i = 0; i < topK.length; i++) {
      const relevance = this.isRelevant(topK[i], benchmark) ? 1 : 0;
      dcg += relevance / Math.log2(i + 2);
    }
    let idcg = 0;
    for (let i = 0; i < k; i++) idcg += 1 / Math.log2(i + 2);
    return idcg === 0 ? 0 : dcg / idcg;
  }

  /**
   * Concept Alignment: % of top K results that contain the required concepts.
   */
  public static calculateConceptAlignment(chunks: Chunk[], requiredConcepts: string[], k: number = 5): number {
    const topK = chunks.slice(0, k);
    if (topK.length === 0 || requiredConcepts.length === 0) return 1.0;
    let totalMatches = 0;
    for (const chunk of topK) {
      const ann = ontologyLoader.getAnnotation(chunk.chunk_id);
      if (!ann) continue;
      const chunkConcepts = ann.concepts.map(c => c.canonical);
      if (requiredConcepts.every(rc => chunkConcepts.includes(rc))) totalMatches++;
    }
    return totalMatches / topK.length;
  }

  /**
   * Narrative Coherence: Measures logical ICT phase progression in the sequence.
   */
  public static calculateNarrativeCoherence(chunks: Chunk[], k: number = 5): number {
    const topK = chunks.slice(0, k);
    if (topK.length <= 1) return 1.0;
    let validTransitions = 0;
    const TRANSITION_RULES: Record<string, string[]> = {
      "ACCUMULATION": ["MANIPULATION", "EXPANSION", "CONSOLIDATION"],
      "MANIPULATION": ["EXPANSION", "REVERSAL"],
      "EXPANSION": ["REBALANCE", "CONTINUATION", "REVERSAL", "CONSOLIDATION"],
      "REBALANCE": ["CONTINUATION", "EXPANSION"],
      "CONTINUATION": ["EXPANSION", "REBALANCE", "REVERSAL"],
      "REVERSAL": ["EXPANSION", "REBALANCE", "CONSOLIDATION"],
      "CONSOLIDATION": ["ACCUMULATION", "MANIPULATION"]
    };
    for (let i = 0; i < topK.length - 1; i++) {
      const currentAnn = ontologyLoader.getAnnotation(topK[i].chunk_id);
      const nextAnn = ontologyLoader.getAnnotation(topK[i+1].chunk_id);
      const currentState = currentAnn?.narrative_metadata?.state?.value;
      const nextState = nextAnn?.narrative_metadata?.state?.value;
      if (!currentState || !nextState) {
        validTransitions += 0.5;
        continue;
      }
      if (currentState === nextState || (TRANSITION_RULES[currentState]?.includes(nextState))) {
        validTransitions += 1.0;
      }
    }
    return validTransitions / (topK.length - 1);
  }

  /**
   * Session Accuracy: % of top K results that match the required sessions.
   */
  public static calculateSessionAccuracy(chunks: Chunk[], requiredSessions: string[], k: number = 5): number {
    const topK = chunks.slice(0, k);
    if (topK.length === 0 || requiredSessions.length === 0) return 1.0;
    let totalMatches = 0;
    for (const chunk of topK) {
      const ann = ontologyLoader.getAnnotation(chunk.chunk_id);
      if (!ann) continue;
      const hasMatchingSession = requiredSessions.some(rs => 
        ann.session_tags.some(st => st.toUpperCase() === rs.toUpperCase()) ||
        ann.source_context.session?.toUpperCase() === rs.toUpperCase()
      );
      if (hasMatchingSession) totalMatches++;
    }
    return totalMatches / topK.length;
  }

  /**
   * Hierarchical Coherence: Measures multi-timeframe alignment quality.
   */
  public static calculateHierarchicalCoherence(theses: any[]): number {
    if (theses.length <= 1) return 1.0;
    let coherenceScore = 1.0;
    const absoluteTerms = ["is bullish", "is bearish", "will move", "must go"];
    for (const thesis of theses) {
      const summary = (thesis.summary || "").toLowerCase();
      if (absoluteTerms.some(term => summary.includes(term))) coherenceScore -= 0.2;
    }
    return Math.max(0, coherenceScore);
  }

  /**
   * Intermarket Coherence: Measures alignment between local narrative and intermarket pressure.
   */
  public static calculateIntermarketCoherence(chunks: Chunk[], relational: any): number {
    if (!relational || chunks.length === 0) return 1.0;
    let alignmentCount = 0;
    const influences = relational.external_influences || [];
    for (const chunk of chunks) {
      const text = chunk.text.toLowerCase();
      let hasContradiction = false;
      for (const inf of influences) {
        if (inf.confidence > 0.8) {
          const source = inf.source_asset.toLowerCase();
          if (text.includes(source)) {
            const isBearishChunk = text.includes("bearish") || text.includes("reversal");
            const isBullishChunk = text.includes("bullish") || text.includes("displacement");
            if (inf.direction === "BULLISH_PRESSURE" && isBearishChunk && !text.includes("inverse")) hasContradiction = true;
            else if (inf.direction === "BEARISH_PRESSURE" && isBullishChunk && !text.includes("inverse")) hasContradiction = true;
          }
        }
      }
      if (!hasContradiction) alignmentCount++;
    }
    return alignmentCount / chunks.length;
  }

  /**
   * Irrelevant Contamination: % of chunks that are from an unrelated asset without explaining relationship.
   */
  public static calculateIrrelevantContamination(chunks: Chunk[], primaryAsset: string): number {
    if (chunks.length === 0) return 0;
    let contaminatedCount = 0;
    for (const chunk of chunks) {
      const text = chunk.text.toLowerCase();
      if (!text.includes(primaryAsset.toLowerCase())) {
        const explainsRelationship = text.includes("correlation") || text.includes("smt") || text.includes("divergence") || text.includes("intermarket");
        if (!explainsRelationship) contaminatedCount++;
      }
    }
    return contaminatedCount / chunks.length;
  }

  /**
   * Bias Resistance (Phase 7): Measures if retrieval preserves contradictory evidence.
   */
  public static calculateBiasResistance(chunks: Chunk[], scenarios: ScenarioMemory): number {
    if (!scenarios || scenarios.active_scenarios.length === 0) return 1.0;
    if (chunks.length === 0) return 0;
    let contradictoryCount = 0;
    const activeScenarios = scenarios.active_scenarios.filter(s => s.confidence > 0.6);
    if (activeScenarios.length === 0) return 1.0;
    for (const chunk of chunks) {
      const text = chunk.text.toLowerCase();
      const isContradictory = activeScenarios.some(s => 
        s.contradicting_anchors.some(a => text.includes(a.toLowerCase())) ||
        s.contradicting_evidence.includes(chunk.chunk_id)
      );
      if (isContradictory) contradictoryCount++;
    }
    return contradictoryCount / chunks.length;
  }

  /**
   * Decay Integrity (Phase 7): Verifies that old scenarios lose confidence.
   */
  public static calculateDecayIntegrity(scenarios: ScenarioMemory, currentCaptureId: string): number {
    const expiredCount = scenarios.active_scenarios.filter(s => 
      s.metadata.created_at_capture !== currentCaptureId && s.temporal_decay === 1.0
    ).length;
    return expiredCount === 0 ? 1.0 : 0.0;
  }

  private static isRelevant(chunk: Chunk, benchmark: BenchmarkQuery): boolean {
    if (benchmark.expected_chunk_ids?.includes(chunk.chunk_id)) return true;
    const ann = ontologyLoader.getAnnotation(chunk.chunk_id);
    if (!ann) return false;
    const chunkConcepts = ann.concepts.map(c => c.canonical);
    if (benchmark.requirements?.forbidden_concepts?.some(fc => chunkConcepts.includes(fc))) return false;
    const hasRequiredConcepts = benchmark.requirements?.required_concepts?.every(rc => chunkConcepts.includes(rc)) ?? true;
    let hasRequiredSession = true;
    if (benchmark.requirements?.required_sessions?.length) {
      hasRequiredSession = benchmark.requirements.required_sessions.some(rs => 
        ann.session_tags.some(st => st.toUpperCase() === rs.toUpperCase()) ||
        ann.source_context.session?.toUpperCase() === rs.toUpperCase()
      );
    }
    return hasRequiredConcepts && hasRequiredSession;
  }
}
