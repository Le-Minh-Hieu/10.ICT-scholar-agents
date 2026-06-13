import { PMSO, ProbabilisticValue, VisionFact } from "../../shared/contracts/pmso";
import { StorageService } from "../../shared/services/storage-service.js";
import { HierarchicalMemory, Timeframe, AlignmentResolution } from "../../shared/knowledge/hierarchical-types";
import { TemporalState } from "../../shared/knowledge/temporal-types";
import { RelationalContext, SMTSignal } from "../../shared/knowledge/relational-types";
import { ScenarioMemory, MarketScenario } from "../../shared/knowledge/scenario-types";
import { log } from "../../shared/utils/logger";

export interface IntermarketResolution {
  smt_detected: boolean;
  smt_signal?: SMTSignal;
  correlation_state: "STABLE" | "DIVERGING" | "COLLAPSED";
  macro_pressure: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
}



export class PMSOReconciler {
  /**
   * Helper to extract facts from current agent outputs (migration compatibility)
   */
  public static extractFactsFromOutputs(outputs: any[]): VisionFact[] {
    const allFacts: VisionFact[] = [];
    let synthesizedCount = 0;

    for (const output of outputs) {
      if (!output) continue;

      if (Array.isArray(output.facts) && output.facts.length > 0) {
        allFacts.push(...output.facts);
        continue;
      }

      const synthesizedFacts: VisionFact[] = [];
      const confidence = output.confidence || 0.5;
      const reasoning = output.reasoning || "";

      // HTF Bias
      if (output.htf_bias) {
        synthesizedFacts.push({
          type: "HigherTimeframeBias",
          timeframe: "HTF",
          confidence,
          anchor: `HTF bias is ${output.htf_bias}`,
          raw_output: output
        });
      }

      // ITF Bias
      if (output.itf_bias) {
        synthesizedFacts.push({
          type: "IntermediateBias",
          timeframe: "ITF",
          confidence,
          anchor: `ITF bias is ${output.itf_bias}`,
          raw_output: output
        });
      }

      // LTF Direction
      if (output.direction) {
        synthesizedFacts.push({
          type: "ExecutionDirection",
          timeframe: "LTF",
          confidence,
          anchor: `LTF direction is ${output.direction}`,
          raw_output: output
        });
      }

      // Narrative Inference
      const narrative = reasoning.toLowerCase();
      if (narrative.includes("displacement") || narrative.includes("market structure shift") || narrative.includes("mss") || narrative.includes("bos")) {
        synthesizedFacts.push({ type: "MarketStructureShift", confidence: 0.7, timeframe: "UNKNOWN", anchor: "Inferred from narrative", raw_output: output });
      }
      if (narrative.includes("expansion")) {
        synthesizedFacts.push({ type: "Expansion", confidence: 0.7, timeframe: "UNKNOWN", anchor: "Inferred from narrative", raw_output: output });
      }
      if (narrative.includes("liquidity sweep") || narrative.includes("liquidity run")) {
        synthesizedFacts.push({ type: "LiquiditySweep", confidence: 0.7, timeframe: "UNKNOWN", anchor: "Inferred from narrative", raw_output: output });
      }

      if (
        narrative.includes("smt divergence") ||
        narrative.includes("bearish smt") ||
        narrative.includes("bullish smt")
      ) {
        synthesizedFacts.push({
          type: "SMTDivergence",
          confidence: 0.8,
          timeframe: "UNKNOWN",
          anchor: "Inferred SMT divergence from narrative",
          raw_output: output
        });
      }

      if (synthesizedFacts.length > 0) {
        synthesizedCount += synthesizedFacts.length;
        allFacts.push(...synthesizedFacts);
      }

    }

    log({
      stage: "FACT_BRIDGE",
      message: `Fact extraction complete. Found ${allFacts.length} total facts.`,
      data: {
        extracted: allFacts.length - synthesizedCount,
        synthesized: synthesizedCount
      }
    });

    return allFacts;
  }
  /**
   * Conservative confidence aggregation using diminishing returns.
   * Logic: 1 - product(1 - dampened_confidences)
   */
  public static dampenAggregate(confidences: number[], dampening = 0.8): number {
    if (confidences.length === 0) return 0;
    const result = 1 - confidences.reduce((acc, c) => acc * (1 - c * dampening), 1);
    return Math.min(result, 0.95); // Never allow absolute 1.0
  }

  /**
   * Calculates a contradiction penalty based on opposing signals.
   */
  public static calculatePenalty(primaryConf: number, opposingConf: number): number {
    if (opposingConf === 0) return 1.0;
    // Penalty is stronger as opposing confidence grows
    return Math.max(0.2, 1.0 - (opposingConf * primaryConf * 0.7));
  }

  /**
   * Builds PMSO from raw vision facts and existing memory.
   */
  public static reconcile(
    facts: VisionFact[],
    memory: HierarchicalMemory,
    captureId: string,
    temporalState: TemporalState | null = null,
    newsModifier?: {
      uncertainty_pressure?: number;
      volatility_pressure?: number;
      directional_alignment?: "ALIGNS" | "CONFLICTS" | "NEUTRAL";
      macro_ire?: any;
      macro_context?: any;
      event_windows?: any;
      execution_modifiers?: any;
      narrative_metadata?: any;
    }
  ): PMSO {
    log({
      stage: "PMSO_RECONCILER", message: "Starting probabilistic reconciliation", data: {
        factCount: facts.length,
        hasTemporal: !!temporalState
      }
    });

    // 1. Separate facts by timeframe
    const htfFacts = facts.filter(f => ["MONTHLY", "WEEKLY", "DAILY"].includes(f.timeframe));
    const ltfFacts = facts.filter(f => ["M15", "M5", "M1"].includes(f.timeframe));

    const htfThesis = memory.theses.DAILY;
    const biasValue = htfThesis?.bias.includes("bullish") ? "bullish" : htfThesis?.bias.includes("bearish") ? "bearish" : "neutral";
    let biasConf = htfThesis?.confidence || 0;
    const opposing: string[] = [];

    // 3. Intermarket Reconciliation
    const intermarket = reconcileIntermarket(memory);

    // Adjust confidence based on temporal state
    if (temporalState) {
      const invalidationCount = temporalState.structures.filter(s => s.status === 'INVALIDATED').length;
      if (invalidationCount > 0) {
        biasConf *= (1 - (invalidationCount * 0.2)); // Reduce confidence by 20% for each invalidated structure
      }
    }

    // Surgical hardening: ensure bounded confidence after temporal adjustment
    biasConf = Math.max(0, Math.min(1, biasConf));

    // 4. Build the PMSO
    // Integrate macro/news directional cognition into HTF bias reconciliation (minimal, bounded blend)
    // Missing before: newsModifier.directional_alignment/macro_context.macro_bias were computed but not consumed.
    // Preserve ICT thesis as dominant authority; apply reinforcement/dampening based on macro alignment.
    const macroDirectional = newsModifier?.macro_context?.directional_alignment;
    const macroBias = newsModifier?.macro_context?.macro_bias;
    const executionWindows = newsModifier?.event_windows || {};
    const activeUpcomingEvents = [
      ...(Array.isArray(executionWindows?.active) ? executionWindows.active : []),
      ...(Array.isArray(executionWindows?.upcoming) ? executionWindows.upcoming : []),
    ];
    const scenarioConflictAnchors = (memory.scenarios?.active_scenarios || [])
      .flatMap((scenario: any) => scenario?.contradicting_anchors || [])
      .filter(Boolean);
    const scenarioConflictEvidence = (memory.scenarios?.active_scenarios || [])
      .flatMap((scenario: any) => scenario?.contradicting_evidence || [])
      .filter(Boolean);

    if (Array.isArray(htfThesis?.opposing_evidence)) {
      opposing.push(...htfThesis.opposing_evidence);
    }
    if (macroBias && macroBias !== 'neutral' && macroBias !== biasValue) {
      opposing.push(`Hydrated macro bias ${macroBias} conflicts with HTF thesis ${biasValue}.`);
    }
    if (activeUpcomingEvents.length > 0) {
      const nearest = activeUpcomingEvents[0];
      opposing.push(`Execution timing constrained by catalyst ${nearest?.title || nearest?.id || "unknown"}${nearest?.impact ? ` (${nearest.impact})` : ""}.`);
    }
    if (scenarioConflictAnchors.length > 0) {
      opposing.push(...scenarioConflictAnchors.slice(0, 3).map((anchor: string) => `Scenario contradiction: ${anchor}`));
    }

    // Map macro fields into bullish/bearish/neutral.
    const macroDirectionalBias =
      macroDirectional === 'ALIGNS' ? 'bullish' :
      macroDirectional === 'CONFLICTS' ? 'bearish' :
      'neutral';

    const macroReconBias = (macroBias && (macroBias === 'bullish' || macroBias === 'bearish' || macroBias === 'neutral'))
      ? macroBias
      : macroDirectionalBias;

    // Determine reinforcement factor using macro confidence via the existing news uncertainty/volatility pressures.
    // This stays bounded and avoids overriding HTF thesis.
    const macroStrength = Math.min(1, (newsModifier?.uncertainty_pressure || 0) + (newsModifier?.volatility_pressure || 0));
    const reinforce = macroReconBias === biasValue
      ? (0.15 + 0.25 * macroStrength)
      : macroReconBias === 'neutral'
        ? 0
        : (0.15 + 0.35 * macroStrength); // dampening when macro conflicts with HTF thesis

    // Adjust confidence; keep biasValue unchanged unless confidence becomes extremely low.
    // (Backward compatible default behavior when macro is neutral or absent.)
    const adjustedBiasConf = (() => {
      if (!newsModifier) return biasConf;
      if (macroReconBias === 'neutral') return biasConf;
      const next = macroReconBias === biasValue
        ? biasConf + reinforce
        : biasConf - reinforce;
      return Math.max(0, Math.min(1, next));
    })();

    const pmso: PMSO = {
      temporal_context: temporalState ? {
        active_structures: temporalState.structures.filter(s => s.status !== 'INVALIDATED'),
        narrative: temporalState.narrative_continuity
      } : undefined,
      market_context: {
        htf_bias: {
          value: biasValue,
          confidence: adjustedBiasConf,
          source: "PMSOReconciler:HTF",
          opposing_evidence: opposing,
          invalidation_triggers: htfFacts.filter(f => f.type === "invalidation").map(f => f.anchor)
        },

        current_session: {
          value: (global as any).currentSession || "UNKNOWN",
          confidence: 1.0,
          source: "System:Time",
          opposing_evidence: activeUpcomingEvents.slice(0, 3).map((event: any) => `Upcoming/active catalyst ${event?.title || event?.id} may distort current session behavior.`),
          invalidation_triggers: []
        },
        liquidity_state: this.reconcileLiquidityState(facts),
        market_mode: this.reconcileMarketMode(facts),
      },
      tensions: {
        contradiction_score: Math.min(
          1,
          (opposing.length > 0 ? 0.25 : 0) +
          (memory.scenarios?.active_scenarios.length || 0) * 0.1 +
          (scenarioConflictEvidence.length > 0 ? 0.2 : 0)
        ),
        alternative_scenarios: memory.scenarios?.active_scenarios || []
      },
      intermarket: {
        smt_detected: {
          value: intermarket.smt_detected,
          confidence: intermarket.confidence,
          source: "Reconciler:Intermarket",
          opposing_evidence: scenarioConflictAnchors.slice(0, 2),
          invalidation_triggers: []
        },
        macro_pressure: {
          value: intermarket.macro_pressure.toLowerCase() as "bullish" | "bearish" | "neutral",
          confidence: intermarket.confidence,
          source: "Reconciler:Intermarket",
          opposing_evidence:
            macroBias && macroBias !== intermarket.macro_pressure.toLowerCase()
              ? [`Hydrated macro bias ${macroBias} disagrees with relational macro pressure ${intermarket.macro_pressure.toLowerCase()}.`]
              : [],
          invalidation_triggers: []
        },
        macro_news_modifier: newsModifier?.macro_context
          ? {
            volatility_pressure: newsModifier?.volatility_pressure ?? (newsModifier?.macro_context?.risk_modifiers?.volatility_pressure ?? 0),
            uncertainty_pressure: newsModifier?.uncertainty_pressure ?? (newsModifier?.macro_context?.risk_modifiers?.uncertainty_pressure ?? 0),
            directional_alignment:
              newsModifier?.directional_alignment ??
              "NEUTRAL"
            ,
            macro_context: newsModifier?.macro_context,
            macro_ire: newsModifier?.macro_ire,
            event_windows: newsModifier?.event_windows,
            execution_modifiers: newsModifier?.execution_modifiers ?? newsModifier?.macro_ire?.execution_modifier ?? newsModifier?.macro_context?.execution_modifier,
            narrative_metadata: newsModifier?.narrative_metadata,
          }
          : newsModifier?.macro_ire
            ? {
              volatility_pressure: newsModifier?.volatility_pressure ?? 0,
              uncertainty_pressure: newsModifier?.uncertainty_pressure ?? 0,
              directional_alignment: "NEUTRAL",
              macro_context: newsModifier?.macro_context,
              macro_ire: newsModifier?.macro_ire,
              event_windows: newsModifier?.event_windows,
              execution_modifiers: newsModifier?.execution_modifiers ?? newsModifier?.macro_ire?.execution_modifier,
              narrative_metadata: newsModifier?.narrative_metadata,
            }
            : {
              volatility_pressure: 0,
              uncertainty_pressure: 0,
              directional_alignment: "NEUTRAL"
            },
      },
      metadata: {
        last_updated: new Date().toISOString(),
        capture_id: captureId
      }
    };

    // Attach a stable cognition id for trace lineage inside metadata (preserve type contracts)
    pmso.metadata = pmso.metadata || {} as any;
    (pmso.metadata as any).cognition_id = `pmso_${captureId}`;

    // Persist canonical PMSO snapshot for observability and lineage
    try {
      StorageService.persistAnalysisOutput("pmso", captureId, pmso);
      log({ stage: "MACRO_PMSO_TRACE", message: "Persisted PMSO snapshot", data: { captureId, cognition_id: (pmso.metadata as any).cognition_id } });
    } catch (err: any) {
      log({ stage: "MACRO_PMSO_TRACE", message: "Failed to persist PMSO snapshot", data: { error: err?.message }, level: "WARN" });
    }

    return pmso;
  }

  public static reconcileMarketMode(facts: VisionFact[]): ProbabilisticValue<string> {
    const expansionFacts = facts.filter(f =>
      f.type.includes("Displacement") ||
      f.type.includes("Expansion") ||
      f.type.includes("MarketStructureShift")
    );

    if (expansionFacts.length > 0) {
      const confidence = this.dampenAggregate(expansionFacts.map(f => f.confidence));
      return {
        value: "expansion",
        confidence: confidence,
        source: "PMSOReconciler:Derived",
        opposing_evidence: facts
          .filter(f => String(f.anchor || "").toLowerCase().includes("retracement") || String(f.anchor || "").toLowerCase().includes("consolidation"))
          .slice(0, 3)
          .map(f => f.anchor),
        invalidation_triggers: []
      };
    }

    // Default to consolidation with low confidence if no expansion facts are found
    return {
      value: "consolidation",
      confidence: 0.4, // Lower default confidence
      source: "PMSOReconciler:Default",
      opposing_evidence: facts
        .filter(f => f.type.includes("Expansion") || f.type.includes("MarketStructureShift"))
        .slice(0, 3)
        .map(f => f.anchor),
      invalidation_triggers: []
    };
  }

  public static reconcileLiquidityState(facts: VisionFact[]): ProbabilisticValue<string> {
    const sweepFacts = facts.filter(f => f.type.includes("LiquiditySweep") || f.type.includes("RunOnLiquidity"));

    if (sweepFacts.length > 0) {
      const strongestSweep = sweepFacts.sort((a, b) => b.confidence - a.confidence)[0];
      const isExternal = strongestSweep.anchor.toLowerCase().includes("external");
      const value = isExternal ? "external_range_liquidity_taken" : "internal_range_liquidity_taken";

      return {
        value: value,
        confidence: strongestSweep.confidence,
        source: "PMSOReconciler:Derived",
        opposing_evidence: facts
          .filter(f => f.type.includes("Expansion"))
          .slice(0, 2)
          .map(f => f.anchor),
        invalidation_triggers: [`Price fails to displace after sweeping ${strongestSweep.anchor}`]
      };
    }

    return {
      value: "internal_range",
      confidence: 0.4, // Lower default confidence
      source: "PMSOReconciler:Default",
      opposing_evidence: facts
        .filter(f => f.type.includes("LiquiditySweep"))
        .slice(0, 2)
        .map(f => f.anchor),
      invalidation_triggers: []
    };
  }
}

export function reconcileIntermarket(memory: HierarchicalMemory): IntermarketResolution {
  const rel = memory.relational;
  if (!rel) {
    return {
      smt_detected: false,
      correlation_state: "STABLE",
      macro_pressure: "NEUTRAL",
      confidence: 0
    };
  }

  // SMT selection gate: require strong confidence and PD-array location at HTF.
  const smtCandidates = rel.smt_hints || [];
  const acceptedSmt = smtCandidates
    .map(s => {
      const passesConfidence = s.confidence > 0.7;
      const passesPdArray = !!s.is_at_pd_array;
      const accepted = passesConfidence && passesPdArray;
      return { ...s, __passesConfidence: passesConfidence, __passesPdArray: passesPdArray, __accepted: accepted };
    });

  const strongestSmt = acceptedSmt
    .filter(s => s.__accepted)
    .sort((a, b) => b.confidence - a.confidence)[0];

  log({
    stage: "PMSO_RECONCILE_INTERMARKET",
    message: "SMT reconciliation selection",
    data: {
      relationalHasRelational: !!rel,
      smtHintCount: smtCandidates.length,
      candidates: smtCandidates.slice(0, 6).map(s => ({
        type: s.type,
        confidence: s.confidence,
        is_at_pd_array: (s as any).is_at_pd_array,
        accepted: ((s as any).__passesConfidence && (s as any).__passesPdArray) || false
      })),
      strongestSmt: strongestSmt ? { type: strongestSmt.type, confidence: strongestSmt.confidence } : null,
    },
  });

  let bullishPressure = 0;
  let bearishPressure = 0;

  rel.external_influences.forEach(inf => {
    const effectivePower = inf.confidence * inf.temporal_decay;
    if (inf.direction === "BULLISH_PRESSURE") bullishPressure += effectivePower;
    if (inf.direction === "BEARISH_PRESSURE") bearishPressure += effectivePower;
  });

  const pressure = bullishPressure > bearishPressure + 0.2 ? "BULLISH" :
    bearishPressure > bullishPressure + 0.2 ? "BEARISH" : "NEUTRAL";

  const relationalAlignment =
    Math.abs(rel.overall_relational_alignment || 0);

  const boundedConfidence = Math.max(
    pressure === "NEUTRAL" ? 0 : 0.25,
    Math.min(1, relationalAlignment)
  );

  return {
    smt_detected: !!strongestSmt,
    smt_signal: strongestSmt,
    correlation_state: "STABLE",
    macro_pressure: pressure,
    confidence: boundedConfidence
  };
}

export function reconcileHierarchy(memory: HierarchicalMemory): AlignmentResolution {
  const htf = memory.theses.DAILY;
  const ltf = memory.theses.M15;

  if (!htf || !ltf) {
    return {
      state: "SHIFT_IN_PROGRESS",
      dominant_timeframe: "DAILY",
      resolution_notes: "Insufficient data for full hierarchical reconciliation."
    };
  }

  const htfBearish = htf.bias.includes("bearish");
  const htfBullish = htf.bias.includes("bullish");
  const ltfBearish = ltf.bias.includes("bearish");
  const ltfBullish = ltf.bias.includes("bullish");

  if ((htfBearish && ltfBearish) || (htfBullish && ltfBullish)) {
    return {
      state: "ALIGNED",
      dominant_timeframe: "DAILY",
      resolution_notes: "LTF aligns with HTF anchor. High probability continuation."
    };
  }

  if (ltf.confidence > 0.85) {
    return {
      state: "SHIFT_IN_PROGRESS",
      dominant_timeframe: "M15",
      resolution_notes: "LTF showing high-intensity displacement against HTF anchor. Potential structural reversal in progress."
    };
  }

  return {
    state: "RETRACEMENT",
    dominant_timeframe: "DAILY",
    resolution_notes: "LTF move interpreted as a retracement within HTF structure. Awaiting alignment for execution."
  };
}

export function reconcileScenarios(
  currentMemory: HierarchicalMemory,
  previousScenarios?: ScenarioMemory,
  newsModifier?: any
): ScenarioMemory {
  const DECAY_COEFFICIENT = 0.5;
  const PRUNE_THRESHOLD = 0.2;

  let active: MarketScenario[] = currentMemory.scenarios?.active_scenarios || [];
  let archived: MarketScenario[] = currentMemory.scenarios?.archived_scenarios || [];

  if (previousScenarios) {
    previousScenarios.active_scenarios.forEach(prev => {
      const isUpdated = active.some(s => s.id === prev.id);

      if (!isUpdated) {
        const decayed: MarketScenario = {
          ...prev,
          temporal_decay: prev.temporal_decay * DECAY_COEFFICIENT,
          confidence: prev.confidence * DECAY_COEFFICIENT,
          plausibility: prev.plausibility * DECAY_COEFFICIENT
        };


        // Surgical hardening: ensure bounded scenario confidences
        decayed.confidence = Math.max(0, Math.min(1, decayed.confidence));
        decayed.plausibility = Math.max(0, Math.min(1, decayed.plausibility));

        if (decayed.confidence < PRUNE_THRESHOLD) {
          archived.push(decayed);
        } else {
          active.push(decayed);
        }
      }
    });
  }

  const seenIds = new Set<string>();
  active = active.filter(s => {
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  }).sort((a, b) => b.confidence - a.confidence);

  // Post-News Invalidation Logic
  try {
    const activeEvents = newsModifier?.event_windows?.active || [];
    const postNewsEvents = activeEvents.filter((ev: any) => ev.actual !== undefined && ev.actual !== null && Math.abs(ev.deviation || 0) > 0);
    if (postNewsEvents.length > 0) {
       const newActive: MarketScenario[] = [];
       const macroBias = newsModifier?.macro_context?.macro_bias || 'neutral';
       
       active.forEach(s => {
          let isInvalidated = false;
          if (macroBias === 'bearish' && (s.name.toLowerCase().includes('bullish') || s.description.toLowerCase().includes('bullish'))) {
              isInvalidated = true;
          } else if (macroBias === 'bullish' && (s.name.toLowerCase().includes('bearish') || s.description.toLowerCase().includes('bearish'))) {
              isInvalidated = true;
          }
          
          if (isInvalidated) {
             s.metadata.archived_reason = "INVALIDATED_BY_FUNDAMENTAL";
             archived.push(s);
             log({stage: "SCENARIO_FUNDAMENTAL_INVALIDATION", message: `Archived scenario due to post-news deviation`, data: { id: s.id, macroBias }});
          } else {
             newActive.push(s);
          }
       });
       active = newActive;
    }
  } catch (err) {}

  return {
    active_scenarios: active,
    archived_scenarios: archived,
    uncertainty_notes: currentMemory.scenarios?.uncertainty_notes || ""
  };
}
