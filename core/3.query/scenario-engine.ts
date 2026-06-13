
import { HierarchicalMemory, TimeframeThesis } from "../../shared/knowledge/hierarchical-types.js";
import { MarketScenario, ScenarioMemory, ScenarioType } from "../../shared/knowledge/scenario-types.js";
import { callLLM } from "../../shared/utils/llm-utils.js";
import { log } from "../../shared/utils/logger.js";
import { sanitizeForOrchestration } from "./agents/shared/base-agent.js";

export class ScenarioEngine {
  /**
   * Generates plausible market scenarios based on hierarchical memory and retrieved context.
   */
  public static async generateScenarios(
    memory: HierarchicalMemory,
    retrievedChunks: any[],
    captureId: string,
    newsModifier?: {
      uncertainty_pressure?: number;
      volatility_pressure?: number;
    }
  ): Promise<ScenarioMemory> {
    log("SCENARIO_ENGINE", "Generating grounded market scenarios", { captureId });
    log({ stage: "MACRO_SCENARIO_TRACE", message: "Scenario generation invoked", data: { captureId, memory_theses: Object.keys(memory.theses || {}), scenario_count: memory.scenarios?.active_scenarios?.length || 0 } });
    const scenarioMacroSummary = newsModifier ? {
      event_phase: (newsModifier as any)?.macro_ire?.event_phase || (newsModifier as any)?.macro_context?.phase || null,
      execution_modifiers: (newsModifier as any)?.macro_ire?.execution_modifier || (newsModifier as any)?.macro_context?.execution_modifier || null,
      macro_catalysts: ((newsModifier as any)?.macro_context?.active_event ? [(newsModifier as any)?.macro_context?.active_event] : []),
      macro_invalidation_hints: (newsModifier as any)?.macro_ire?.why ? [(newsModifier as any).macro_ire.why] : [],
    } : null;
    if (scenarioMacroSummary) {
      log({ stage: "[NEWS][SCENARIO]", message: "Scenario engine received compact macro cognition", data: { captureId, eventPhase: scenarioMacroSummary.event_phase, catalystCount: scenarioMacroSummary.macro_catalysts.length } });
    }

    const compactTheses = sanitizeForOrchestration(memory.theses || {});
    const compactRelational = sanitizeForOrchestration(memory.relational || {});
    const compactEvidence = retrievedChunks.slice(0, 10).map(c => ({
      chunk_id: c.chunk_id,
      text: c.text,
    }));
    const fullPromptEstimate = Math.ceil(
      JSON.stringify({
        theses: memory.theses,
        relational: memory.relational,
        macro: scenarioMacroSummary,
        evidence: compactEvidence,
      }).length / 4
    );
    const compactPromptEstimate = Math.ceil(
      JSON.stringify({
        theses: compactTheses,
        relational: compactRelational,
        macro: scenarioMacroSummary,
        evidence: compactEvidence,
      }).length / 4
    );
    log({
      stage: "[ORCHESTRATION][SANITIZE]",
      message: "Sanitized scenario orchestration payload",
      data: {
        removed_debug_keys: ["_debug", "_raw"],
        full_estimated_tokens: fullPromptEstimate,
        compact_estimated_tokens: compactPromptEstimate,
      }
    });

    const prompt = `You are an ICT Scenario Simulation Engineer. 
Your task is to generate 2-3 PLAUSIBLE market scenarios based on the provided hierarchical market state.

## INPUT DATA
HIERARCHICAL THESES:
${JSON.stringify(compactTheses, null, 2)}

INTERMARKET CONTEXT:
${JSON.stringify(compactRelational, null, 2)}

MACRO CONTEXT:
${JSON.stringify(scenarioMacroSummary, null, 2)}

KEY RETRIEVED EVIDENCE:
${compactEvidence.map(c => `[${c.chunk_id}] ${c.text}`).join("\n\n")}

## MANDATORY GUIDELINES
1. GROUNDING: Every scenario MUST be derived from the provided evidence. Cite chunk_ids.
2. BRANCHING: Focus on the tension between HTF bias and LTF displacement.
3. DEVIL'S ADVOCATE: For every scenario, you MUST identify exactly what evidence contradicts it and what specific price action would invalidate it.
4. PROBABILISTIC: Use language of uncertainty. Avoid "the market will".
5. NO HALLUCINATION: Do not invent levels or concepts not present in the input.

## SCENARIO TYPES
- CONTINUATION: HTF bias prevails.
- REVERSAL: Structural shift against HTF.
- RETRACEMENT: LTF move against HTF but within bounds.
- LIQUIDITY_SWEEP: Manipulation before move.

## OUTPUT FORMAT (JSON ONLY)
{
  "scenarios": [
    {
      "name": "short_descriptive_name",
      "type": "CONTINUATION" | "REVERSAL" | "RETRACEMENT" | "LIQUIDITY_SWEEP",
      "plausibility": 0.0 - 1.0,
      "description": "1-2 sentence description",
      "narrative_continuation": "What happens next if this plays out?",
      "supporting_evidence": ["chunk_ids"],
      "contradicting_evidence": ["chunk_ids"],
      "supporting_anchors": ["Specific ICT levels"],
      "contradicting_anchors": ["Opposing levels"],
      "invalidated_by": ["Specific price action conditions"]
    }
  ],
  "uncertainty_notes": "Summary of why the market is currently difficult to read"
}

IMPORTANT: Be critical. If evidence is conflicting, reflect that in lower plausibility scores.`;

    try {
      const rawLlmResult: any = await callLLM(prompt, "Scenario-Engine", Date.now().toString(), [{ text: prompt }], {
        useStructured: true,
        returnTelemetry: true
      });
      const result: any = rawLlmResult.data;
      const telemetry = rawLlmResult.telemetry;

      const active_scenarios: MarketScenario[] = (result?.scenarios || []).map((s: any, index: number) => {

        const uncertaintyPenalty = Math.min(
          0.2,
          (newsModifier as any)?.uncertainty_pressure || 0
        );

        // Minimal directional integration: steer scenario plausibility based on macro/news bias.
        // We do NOT rebuild scenario branching logic; we only rank/weight plausibility.
        // Missing before: directional_alignment/macro_bias were computed but never applied in scenario ranking.
        const macroBias =
          (newsModifier as any)?.macro_context?.macro_bias ||
          (newsModifier as any)?.macro_ire?.bias;

        const macroDirectional = (newsModifier as any)?.macro_context?.directional_alignment;

        const macroReconBias =
          macroBias === 'bullish' || macroBias === 'bearish' || macroBias === 'neutral'
            ? macroBias
            : (macroDirectional === 'ALIGNS' ? 'bullish' : macroDirectional === 'CONFLICTS' ? 'bearish' : 'neutral');

        // Heuristic mapping from scenario type to continuation-vs-reversal preference.
        // Keeps ICT structure as authority; macro only perturbs ranking within bounds.
        const scenarioPref = (() => {
          if (s.type === 'CONTINUATION') return 'continuation';
          if (s.type === 'REVERSAL') return 'reversal';
          if (s.type === 'RETRACEMENT') return 'retrace';
          return 'liquidity_sweep';
        })();

        const directionalDelta = (() => {
          if (!macroReconBias || macroReconBias === 'neutral') return 0;
          if (macroReconBias === 'bearish') {
            // bearish macro prefers bearish-aligned outcomes.
            // Scenario engine already grounds evidence; we only bias likelihood.
            // Apply small boost/damp based on whether the scenario type implies continuing bearishness.
            return scenarioPref === 'continuation' || scenarioPref === 'reversal' ? 1 : 0;
          }
          if (macroReconBias === 'bullish') {
            return scenarioPref === 'continuation' || scenarioPref === 'reversal' ? 1 : 0;
          }
          return 0;
        })();

        const macroStrength = Math.min(0.2, (newsModifier?.volatility_pressure || 0) * 0.1 + (newsModifier?.uncertainty_pressure || 0) * 0.05);
        const macroPenaltyOrBoost = directionalDelta === 1
          ? (macroReconBias ? macroStrength : 0)
          : -macroStrength;

        const adjustedPlausibility = Math.max(
          0.05,
          Math.min(
            1,
            s.plausibility - uncertaintyPenalty + macroPenaltyOrBoost
          )
        );

        let conditional_invalidation_windows: {start: string, end: string}[] = [];
        let fundamental_invalidation_triggers: string[] = [];
        try {
          const upcomingEvents = (newsModifier as any)?.event_windows?.upcoming || [];
          const activeEvents = (newsModifier as any)?.event_windows?.active || [];
          const allEvents = [...upcomingEvents, ...activeEvents];
          
          allEvents.forEach((ev: any) => {
            if (ev.impact === 'HIGH' || ev.volatility_risk >= 0.8) {
              if (ev.window_boundaries?.pre_start && ev.window_boundaries?.cooldown_end) {
                conditional_invalidation_windows.push({
                  start: ev.window_boundaries.pre_start,
                  end: ev.window_boundaries.cooldown_end
                });
              }
              fundamental_invalidation_triggers.push(`If ${ev.name || ev.id} Actual strongly deviates from Forecast`);
            }
          });
        } catch (err) {}

        log({
          stage: "SCENARIO_NEWS_DEFORMATION",
          message: "Applied bounded plausibility deformation",
          data: {
            original: s.plausibility,
            adjusted: adjustedPlausibility,
            uncertainty_penalty: uncertaintyPenalty,
            windows_added: conditional_invalidation_windows.length
          }
        });

        return {
          id: `scenario_${captureId}_${index}`,
          ...s,

          confidence: adjustedPlausibility,
          plausibility: adjustedPlausibility,

          temporal_decay: 1.0,
          conditional_invalidation_windows,
          fundamental_invalidation_triggers,

          metadata: {
            created_at_capture: captureId,
            last_updated_capture: captureId,
            birth_timeframe: memory.active_context || "M15"
          }
        };
      });

      return {
        active_scenarios,
        archived_scenarios: [],
        uncertainty_notes: result?.uncertainty_notes || "Normal market uncertainty.",
        telemetry,
      };

    } catch (error) {
      log("SCENARIO_ENGINE_ERROR", "Failed to generate scenarios", { error }, "ERROR");
      return {
        active_scenarios: [],
        archived_scenarios: [],
        uncertainty_notes: "Error during scenario simulation."
      };
    }
  }
}
