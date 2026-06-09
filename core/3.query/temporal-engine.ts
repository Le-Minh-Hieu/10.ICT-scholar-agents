import { VisionFact } from "../../shared/contracts/pmso";
import { ActiveStructure, TemporalState, StructureStatus } from "../../shared/knowledge/temporal-types";
import { log } from "../../shared/utils/logger";

export class TemporalEngine {
  private static DECAY_RATE = 0.1; // Confidence lost per capture if not validated
  private static MITIGATION_THRESHOLD = 0.5; // 50% fill is considered mitigated
  private static PRUNE_THRESHOLD = 0.2; // Confidence below this means remove

  /**
   * Reconciles current vision facts with inherited temporal state.
   * Current market evidence ALWAYS overrides inherited state.
   */
  public static reconcile(
    currentFacts: VisionFact[],
    inheritedState: TemporalState | null,
    captureId: string,
    currentPrice?: number,
    newsModifier?: {
      uncertainty_pressure?: number;
      volatility_pressure?: number;
    }
  ): TemporalState {
    log("TEMPORAL_ENGINE", "Starting temporal reconciliation", {
      factCount: currentFacts.length,
      hasInherited: !!inheritedState
    });

    log({
      stage: "TEMPORAL_TRACE_4",
      message: "TemporalEngine.reconcile entry",
      data: {
        inherited_exists: !!inheritedState,
        capture_count: inheritedState?.capture_count,
        structures: inheritedState?.structures?.length
      }
    });

    // PMSO_MACRO_TRACE: record newsModifier consumption (no logic changes)
    log({ stage: 'PMSO_MACRO_TRACE', message: 'TemporalEngine.reconcile newsModifier snapshot', data: {
      uncertainty_pressure: newsModifier?.uncertainty_pressure,
      volatility_pressure: newsModifier?.volatility_pressure
    } });

    if (
      inheritedState?.last_reconciled_capture_id ===
      captureId
    ) {
      log(
        "TEMPORAL_IDEMPOTENCE",
        "Skipping duplicate reconciliation",
        { captureId }
      );

      log({
        stage: "TEMPORAL_TRACE_5",
        message: "TemporalEngine idempotent return",
        data: {
          output_capture_count: inheritedState?.capture_count,
          output_structures: inheritedState?.structures?.length
        }
      });

      return inheritedState;
    }

    const newState: TemporalState = {
      regime_state: "STABLE",
      invalidation_summary:
        inheritedState?.invalidation_summary || {
          total_invalidations: 0,
          last_invalidated_at: null
        },
      structures: [],
      narrative_continuity: inheritedState?.narrative_continuity || "Initial session state.",
      session_id: inheritedState?.session_id || `session_${Date.now()}`,
      last_updated: new Date().toISOString(),
      capture_count: (inheritedState?.capture_count || 0) + 1
    };

    const inheritedStructures = inheritedState?.structures || [];
    const matchedFactIndices = new Set<number>();

    // 1. Process Inherited Structures
    for (const structure of inheritedStructures) {
      // Find matching current facts
      const matchingFactIndex = currentFacts.findIndex((f, idx) =>
        !matchedFactIndices.has(idx) &&
        f.anchor === structure.anchor &&
        f.timeframe === structure.timeframe
      );

      let updatedStructure: ActiveStructure = { ...structure };

      if (matchingFactIndex !== -1) {
        // VALIDATED by current evidence
        const fact = currentFacts[matchingFactIndex];
        matchedFactIndices.add(matchingFactIndex);

        updatedStructure.status = this.determineNewStatus(structure.status, 'VALIDATED');
        // Weighted average: 70% existing confidence, 30% new fact confidence.
        const newConfidence = (structure.confidence * 0.7) + (fact.confidence * 0.3);
        updatedStructure.confidence = Math.min(1.0, newConfidence);
        updatedStructure.last_validated_at = captureId;
        const persistenceBoost =
          Math.min(
            0.15,
            (newState.capture_count || 0) * 0.005
          );

        updatedStructure.confidence =
          Math.min(
            1,
            updatedStructure.confidence + persistenceBoost
          );
        const contradictionPenalty =
          updatedStructure.metadata?.is_htf_aligned === false
            ? 0.05
            : 0;

        updatedStructure.confidence =
          Math.max(
            this.PRUNE_THRESHOLD,
            updatedStructure.confidence - contradictionPenalty
          );

        // Surgical hardening: ensure bounded confidence
        updatedStructure.confidence = Math.max(
          0,
          Math.min(1, updatedStructure.confidence)
        );
        updatedStructure.decay_score = 0; // Reset decay
      } else {
        // NOT SEEN in current evidence - apply decay
        updatedStructure.decay_score += this.DECAY_RATE;
        updatedStructure.confidence -= this.DECAY_RATE;

        // Surgical hardening: ensure bounded confidence
        updatedStructure.confidence = Math.max(
          0,
          Math.min(1, updatedStructure.confidence)
        );

        if (updatedStructure.confidence < this.PRUNE_THRESHOLD) {
          log("TEMPORAL_ENGINE", `Pruning stale structure: ${structure.anchor}`, { id: structure.id });
          newState.invalidation_summary!.total_invalidations += 1;
          newState.invalidation_summary!.last_invalidated_at =
            new Date().toISOString();
          continue; // Prune
        }
      }

      // 2. Price Validation (if price is provided)
      if (currentPrice && updatedStructure.price_bounds) {
        updatedStructure = this.validateAgainstPrice(updatedStructure, currentPrice);
      }

      if (updatedStructure.status !== 'INVALIDATED') {
        newState.structures.push(updatedStructure);
      }
    }

    // 3. Process New Facts (Discovered)
    for (let i = 0; i < currentFacts.length; i++) {
      if (matchedFactIndices.has(i)) continue;

      const fact = currentFacts[i];
      const newStructure: ActiveStructure = {
        id: `struct_${captureId}_${i}`,
        type: fact.type,
        status: 'DISCOVERED',
        timeframe: fact.timeframe as any,
        anchor: fact.anchor,
        confidence: fact.confidence,
        first_seen_at: captureId,
        last_validated_at: captureId,
        decay_score: 0,
        mitigation_level: 0,
        metadata: {
          strength: fact.confidence,
          is_htf_aligned:
            currentFacts.some(
              f =>
                f.type === 'HigherTimeframeBias' &&
                (
                  (
                    f.anchor.toLowerCase().includes('bearish') &&
                    fact.anchor.toLowerCase().includes('bearish')
                  ) ||
                  (
                    f.anchor.toLowerCase().includes('bullish') &&
                    fact.anchor.toLowerCase().includes('bullish')
                  )
                )
            ) // Default
        }
      };

      // Extract price bounds if available in raw_output
      if (fact.raw_output?.price_bounds) {
        newStructure.price_bounds = fact.raw_output.price_bounds;
      }

      const duplicate = newState.structures.find(
        s =>
          s.anchor === newStructure.anchor &&
          s.timeframe === newStructure.timeframe &&
          s.type === newStructure.type
      );

      if (duplicate) {
        duplicate.confidence = Math.max(
          duplicate.confidence,
          newStructure.confidence
        );

        duplicate.last_validated_at = captureId;

        continue;
      }

      newState.structures.push(newStructure);
    }

    if (newState.structures.length === 0 && currentFacts.length > 0) {
      log({
        stage: "TEMPORAL_RECONCILE",
        message: "No new structures were generated despite receiving facts. Creating a fallback narrative structure.",
        level: "WARN",
        data: { factCount: currentFacts.length }
      });

      const dominantFact = currentFacts.sort((a, b) => b.confidence - a.confidence)[0];
      const fallbackStructure: ActiveStructure = {
        id: `struct_${captureId}_fallback`,
        type: 'NarrativeContinuation',
        status: 'DISCOVERED',
        timeframe: dominantFact.timeframe as any,
        anchor: dominantFact.anchor,
        confidence: dominantFact.confidence,
        first_seen_at: captureId,
        last_validated_at: captureId,
        decay_score: 0,
        mitigation_level: 0,
        metadata: {
          strength: dominantFact.confidence,
          is_htf_aligned: false
        }
      };
      newState.structures.push(fallbackStructure);
    }

    const contradictoryStructures =
      newState.structures.filter(
        s => s.metadata?.is_htf_aligned === false
      ).length;

    const totalStructures =
      newState.structures.length || 1;

    const contradictionRatio = contradictoryStructures / totalStructures;

    // Minimal semantics alignment: regime_state was previously driven by uncertainty only.
    // Integrate directional disagreement into contradiction semantics without changing ICT structure logic.
    const uncertaintyBoost = newsModifier?.uncertainty_pressure || 0;

    // newsModifier runtime object may include macro_context/macro_ire even if TS type here is narrow.
    // Cast to avoid compile-time type errors while preserving runtime behavior.
    const macroBias = (newsModifier as any)?.macro_context?.macro_bias ||
      (newsModifier as any)?.macro_ire?.bias ||
      'neutral';

    // Determine a small additional contradiction term when macro_bias conflicts with dominant (HTF-like) alignment.
    // We use the dominant structure's metadata is_htf_aligned as a lightweight proxy.
    const dominantStructure =
      [...newState.structures]
        .sort((a, b) => b.confidence - a.confidence)[0];

    const dominantIsHtfAligned = dominantStructure?.metadata?.is_htf_aligned === true;
    const dominantMacroLikeBias = dominantIsHtfAligned ? 'bullish' : 'bearish';

    const directionalConflictBoost =
      (macroBias !== 'neutral' && macroBias !== dominantMacroLikeBias)
        ? Math.min(0.2, macroBias === 'bearish' ? 0.15 : 0.15)
        : 0;


    const adjustedContradictionRatio = Math.min(
      1,
      contradictionRatio + uncertaintyBoost + directionalConflictBoost
    );

    if (adjustedContradictionRatio >= 0.6) {
      newState.regime_state = "CHAOTIC";
    } else if (adjustedContradictionRatio >= 0.3) {
      newState.regime_state = "TRANSITIONAL";
    } else {
      newState.regime_state = "STABLE";
    }

    log({
      stage: "TEMPORAL_NEWS_PRESSURE",
      message: "Applied bounded news uncertainty",
      data: {
        base_ratio: contradictionRatio,
        adjusted_ratio: adjustedContradictionRatio,
        uncertainty_boost: uncertaintyBoost
      }
    });

    if (dominantStructure) {
      newState.narrative_continuity =
        `${newState.regime_state} regime | ` +
        `${dominantStructure.type} | ` +
        `${dominantStructure.anchor}`;
    }


    newState.last_reconciled_capture_id =
      captureId;

    log({ stage: "MACRO_TEMPORAL_TRACE", message: "Temporal reconciliation complete", data: { captureId, structureCount: newState.structures.length, narrative: newState.narrative_continuity } });

    log({
      stage: "TEMPORAL_TRACE_5",
      message: "TemporalEngine.reconcile exit",
      data: {
        output_capture_count: newState.capture_count,
        output_structures: newState.structures?.length
      }
    });

    return newState;
  }

  private static determineNewStatus(current: StructureStatus, event: 'VALIDATED' | 'TAPPED' | 'MITIGATED'): StructureStatus {
    if (current === 'DISCOVERED' && event === 'VALIDATED') return 'ACTIVE';
    if (event === 'TAPPED') return 'TAPPED';
    if (event === 'MITIGATED') return 'MITIGATED';
    return current;
  }

  private static validateAgainstPrice(structure: ActiveStructure, price: number): ActiveStructure {
    if (!structure.price_bounds) return structure;

    const { high, low } = structure.price_bounds;
    const isBullish = structure.type.includes('bullish');
    const isBearish = structure.type.includes('bearish');

    // Check for invalidation
    if (isBullish && price < low) {
      structure.metadata = {
        ...structure.metadata,
        invalidated_at: new Date().toISOString()
      };
      structure.status = 'INVALIDATED';
      log("TEMPORAL_ENGINE", `Structure invalidated by price: ${structure.anchor}`, { price, low });
    } else if (isBearish && price > high) {
      structure.metadata = {
        ...structure.metadata,
        invalidated_at: new Date().toISOString()
      };
      structure.status = 'INVALIDATED';
      log("TEMPORAL_ENGINE", `Structure invalidated by price: ${structure.anchor}`, { price, high });
    }

    // Check for Tapped/Mitigated
    if (structure.status === 'ACTIVE' || structure.status === 'DISCOVERED') {
      if (price >= low && price <= high) {
        structure.status = 'TAPPED';

        const range = Math.abs(high - low);

        if (range > 0) {
          const penetration =
            isBullish
              ? (high - price) / range
              : (price - low) / range;

          structure.mitigation_level =
            Math.max(
              structure.mitigation_level || 0,
              penetration
            );

          if (
            structure.mitigation_level >=
            this.MITIGATION_THRESHOLD
          ) {
            structure.confidence =
              Math.max(
                this.PRUNE_THRESHOLD,
                structure.confidence * 0.7
              );

            // Surgical hardening: ensure bounded confidence
            structure.confidence = Math.max(
              0,
              Math.min(1, structure.confidence)
            );

            structure.status = 'MITIGATED';
          }
        }
      }
    }

    return structure;
  }
}
