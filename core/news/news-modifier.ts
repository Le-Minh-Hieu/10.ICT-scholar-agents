import { NewsReasoningResult } from "../3.query/news-reasoner";
import { ScoredEvidence } from "../archive/evidence-scoring.js";
import { log } from "../../shared/utils/logger.js";
import { markDeprecated } from "./deprecation-tracker.js";

type EvidenceInput = { reasoningResultsOrEvents: NewsReasoningResult[] | any[]; scoredEvidence?: ScoredEvidence[]; contradiction?: any };

function isValidGroundedReasoning(
    item: NewsReasoningResult | any,
    allowPartial: boolean = false
): boolean {

    const hasEvidence =
        (Array.isArray(item?.chunk_citations) &&
            item.chunk_citations.length > 0)
        ||
        (Array.isArray(item?.evidence_summaries) &&
            item.evidence_summaries.length > 0);

    const groundedCheck =
        allowPartial
            ? true
            : hasEvidence;

    const hasNonZeroPressure =
        Math.abs(item?.uncertainty_pressure || 0) > 0 ||
        Math.abs(item?.volatility_pressure || 0) > 0 ||
        Math.abs(item?.directional_pressure || 0) > 0 ||
        Math.abs(item?.manipulation_probability || 0) > 0 ||
        Math.abs(item?.expansion_probability || 0) > 0 ||
        Math.abs(item?.repricing_severity || 0) > 0;

    return groundedCheck &&
        (hasEvidence || hasNonZeroPressure);
}


export function buildNewsModifier(
    reasoningResultsOrEvents: NewsReasoningResult[] | any[],
    scoredEvidence?: ScoredEvidence[],
    contradiction?: any
) {
    // If caller passes raw events (legacy), fall back to simple heuristic
    if (!reasoningResultsOrEvents || reasoningResultsOrEvents.length === 0) {
        return {
            volatility_pressure: 0.15,
            uncertainty_pressure: 0.1,
            directional_alignment: "NEUTRAL",

            macro_context: {
                phase: "PERSISTENT_MACRO",

                execution_modifier: {
                    reduce_size: false,
                    avoid_pre_news_entry: false,
                },

                confidence_modifier: -0.1,

                narrative:
                    "Persistent macro cognition active without immediate event window.",

                risk_modifiers: {
                    uncertainty_pressure: 0.1,
                    volatility_pressure: 0.15,
                },

                persistent_context: true
            },

            macro_ire: {
                bias: "neutral",
                volatility_regime: "MILD",
                execution_risk: "MEDIUM",
                liquidity_condition: "STABLE",
                confidence_modifier: -0.1,
                narrative_alignment: "NEUTRAL",
                event_phase: "PERSISTENT_MACRO",

                execution_modifier: {
                    reduce_size: false,
                    avoid_pre_news_entry: false,
                },

                risk_modifiers: {
                    uncertainty_pressure: 0.1,
                    volatility_pressure: 0.15,
                },

                why:
                    "Persistent weekly macro narrative remains active despite no immediate event window."
            }
        };
    }

    // If items look like NewsReasoningResult, aggregate grounded scores
    const sample = reasoningResultsOrEvents[0];
    const looksGrounded = isValidGroundedReasoning(sample, false);

    // NEWS_MODIFIER_TRACE: input snapshot
    log({
        stage: 'NEWS_MODIFIER_TRACE',
        message: 'Grounded check results',
        data: {
            total_items: (reasoningResultsOrEvents || []).length,
            looksGrounded,
        }
    });

    // If no items are fully grounded, allow partial evaluation.
    let results = (reasoningResultsOrEvents as NewsReasoningResult[]).filter(item => isValidGroundedReasoning(item, false));
    const anyGrounded = results.length > 0;
    if (!anyGrounded) {
        // Retry with relaxed partial allowance.
        const partialResults = (reasoningResultsOrEvents as NewsReasoningResult[]).filter(item => isValidGroundedReasoning(item, true));
        if (partialResults.length > 0) {
            log({ stage: 'NEWS_MODIFIER_TRACE', message: 'Partial grounding allowed', data: { count: partialResults.length } });
            // Use partial results for aggregation.
            results = partialResults;
        }
    }

    // Legacy path: events-only. Still produce a useful macro_context.
    if (!looksGrounded && results.length === 0) {
        log({ stage: 'NEWS_MODIFIER_TRACE', message: 'Choosing legacy events-only branch', data: { events_count: (reasoningResultsOrEvents || []).length } });
        // Deprecation tracking: legacy events-only branch
        markDeprecated('news-modifier:legacy-events-only', { reason: 'legacy events-only path used; prefer grounded NewsReasoningResult' });
        const events = reasoningResultsOrEvents as any[];
        const n = Math.max(1, events.length);

        // Pivot legacy event-only semantics toward macro calendar conditioning:
        // - base pressures on event impact and cluster size
        const impactScore = Math.max(...events.map((e: any) => {
            const imp = (e.impact || e.importance || "LOW").toString().toUpperCase();
            return imp === "CRITICAL" || imp === "HIGH" ? 3 : imp === "MEDIUM" ? 2 : 1;
        }));

        const volatility_pressure = Math.min(0.9, 0.12 * impactScore * Math.sqrt(n));
        const uncertainty_pressure = Math.min(0.95, 0.08 * impactScore * Math.log2(1 + n));

        const avoid_pre_news_entry = volatility_pressure >= 0.35;
        const reduce_size = volatility_pressure >= 0.5;

        const phase = (() => {
            const cats = events.map((e: any) => (e.category || "").toString().toUpperCase());
            if (cats.includes("FOMC") || cats.includes("RATE_DECISION")) return "EVENT_DAY";
            if (cats.includes("OPTIONS_EXPIRY") || cats.includes("OPEX")) return "PRE_EVENT";
            return "PRE_EVENT";
        })();

        // For calendar-driven macro conditioning we avoid article-directional reasoning here
        const directional_alignment = "NEUTRAL";
        const macro_bias = "neutral";

        const narrative = `Macro window active. Volatility=${volatility_pressure.toFixed(2)}, uncertainty=${uncertainty_pressure.toFixed(2)}.`;

        const result = {
            volatility_pressure,
            uncertainty_pressure,
            directional_alignment: directional_alignment as any,
            macro_context: {
                active_event: events[0]?.category ?? events[0]?.title ?? "MACRO",
                phase,
                impact: impactScore >= 3 ? "HIGH" : impactScore === 2 ? "MEDIUM" : "LOW",
                expected_volatility:
                    volatility_pressure >= 0.6 ? "ELEVATED" : volatility_pressure >= 0.35 ? "MODERATE_ELEVATED" : "MILD",
                macro_bias,
                execution_modifier: {
                    reduce_size,
                    avoid_pre_news_entry,
                },
                confidence_modifier: -uncertainty_pressure,
                narrative,
                risk_modifiers: {
                    uncertainty_pressure,
                    volatility_pressure,
                }
            }
        };

        // Attach hydration/trace id on macro context for lineage
        try {
            (result.macro_context as any).cognition_id = `macro_${Date.now()}`;
        } catch (_) { }

        log({ stage: 'NEWS_MODIFIER_RESULT', message: 'News modifier (legacy) result', data: { volatility_pressure, uncertainty_pressure, macro_context: result.macro_context } });

        return result;
    }

    const dominantVol = Math.max(...results.map(r => r.volatility_pressure || 0));
    const dominantUncertainty = Math.max(...results.map(r => r.uncertainty_pressure || 0));

    const weightedDirectional = (() => {
        const directionalInputs = results
            .map(r => {
                const sourceWeight = 1;
                const magnitudeWeight = Math.min(
                    1,
                    (Math.abs(r.directional_pressure || 0) * 0.5) +
                    (Math.abs(r.volatility_pressure || 0) * 0.25) +
                    (Math.abs(r.repricing_severity || 0) * 0.25)
                );
                return {
                    weightedPressure: (r.directional_pressure || 0) * sourceWeight * magnitudeWeight,
                    weight: sourceWeight * Math.max(0.1, magnitudeWeight),
                };
            });

        const totalWeight = directionalInputs.reduce((acc, item) => acc + item.weight, 0);
        if (totalWeight === 0) {
            return 0;
        }

        const blended = directionalInputs.reduce((acc, item) => acc + item.weightedPressure, 0) / totalWeight;
        return Math.max(-0.35, Math.min(0.35, blended));
    })();

    // Evidence-weight adjustments: if scoredEvidence provided, lower uncertainty when evidence is strong and agreement high
    let strengthBoost = 0;
    let agreementReduction = 0;

    if (scoredEvidence && scoredEvidence.length) {
        const avgStrength =
            scoredEvidence.reduce((a, b) => a + (b.evidence_strength || 0), 0) / scoredEvidence.length;

        const avgAgreement =
            scoredEvidence.reduce((a, b) => a + (b.semantic_agreement || 0), 0) / scoredEvidence.length;

        strengthBoost = avgStrength * 0.25;
        agreementReduction = avgAgreement * 0.08;
    }

    // Contradiction penalty
    const contradictionDensity = contradiction?.contradiction_density || 0;

    // Bounded and conservative aggregation
    let volatility_pressure = Math.min(0.8, dominantVol + strengthBoost);
    let uncertainty_pressure = Math.min(
        0.95,
        (Math.max(dominantUncertainty, 0.05) * (1 + contradictionDensity * 0.45)) - agreementReduction
    );

    const directional_alignment =
        weightedDirectional > 0.12 ? "ALIGNS" : weightedDirectional < -0.12 ? "CONFLICTS" : "NEUTRAL";

    // Ensure bounds
    volatility_pressure = Math.max(0, volatility_pressure);
    uncertainty_pressure = Math.max(0, uncertainty_pressure);

    const avoid_pre_news_entry = volatility_pressure >= 0.35;
    const reduce_size = volatility_pressure >= 0.5;

    // Prefer the shadow-runner computed lifecycle phase when provided.
    // Fallback to PRE_EVENT only when lifecycle_phase is missing.
    const phase =
        (sample as any)?.metadata?.lifecycle_phase ||
        (sample as any)?.lifecycle_phase ||
        (sample as any)?.phase ||
        "PRE_EVENT";

    const expected_volatility =
        volatility_pressure >= 0.6 ? "ELEVATED" : volatility_pressure >= 0.35 ? "MODERATE_ELEVATED" : "MILD";

    const impact =
        volatility_pressure >= 0.7 || uncertainty_pressure >= 0.7 ? "HIGH" : uncertainty_pressure >= 0.4 ? "MEDIUM" : "LOW";

    const macro_bias =
        directional_alignment === "ALIGNS"
            ? "bullish"
            : directional_alignment === "CONFLICTS"
                ? "bearish"
                : "neutral";

    const narrative = `Macro/news conditioning active (${directional_alignment}). Expected volatility=${volatility_pressure.toFixed(
        2
    )}. Execution confidence damped by uncertainty=${uncertainty_pressure.toFixed(2)}.`;

    const volatility_regime =
        expected_volatility === "ELEVATED"
            ? "ELEVATED"
            : expected_volatility === "MODERATE_ELEVATED"
                ? "MODERATE_ELEVATED"
                : "MILD";

    const execution_risk =
        volatility_pressure >= 0.5 || uncertainty_pressure >= 0.5 ? "HIGH" : "MEDIUM";

    const liquidity_condition =
        avoid_pre_news_entry || reduce_size ? "UNSTABLE" : "STABLE";

    const narrative_alignment =
        directional_alignment === "CONFLICTS" ? "CONFLICTING" : directional_alignment === "ALIGNS" ? "ALIGNED" : "NEUTRAL";

    // Macro IRE normalized artifact for deeper synthesis coupling.
    // Deterministic mapping from bounded news pressures + phase semantics.
    const macro_ire = {
        bias: macro_bias as any,
        volatility_regime,
        execution_risk,
        liquidity_condition,
        confidence_modifier: -uncertainty_pressure,
        narrative_alignment: narrative_alignment,
        event_phase: phase,
        execution_modifier: {
            reduce_size,
            avoid_pre_news_entry,
        },
        risk_modifiers: {
            uncertainty_pressure,
            volatility_pressure,
        },
        // Traceable WHY (short, ICT-aligned)
        why:
            `${phase} macro/news window: expected_volatility=${expected_volatility}; ` +
            `execution_quality_damp=uncertainty(${uncertainty_pressure.toFixed(2)}) ` +
            `with volatility_pressure(${volatility_pressure.toFixed(2)}).`,
    };

    log({
        stage: "MACRO_IRE_GENERATED",
        message: "Built macro/news IRE from event pressures",
        data: {
            event_phase: phase,
            macro_bias,
            directional_alignment,
            weighted_directional: weightedDirectional,
            volatility_pressure,
            uncertainty_pressure,
            execution_risk,
            volatility_regime,
            liquidity_condition,
        }
    });

    log({
        stage: "MACRO_MODIFIERS_APPLIED",
        message: "Applied macro/news modifiers to master layers",
        data: {
            phase,
            macro_bias,
            reduce_size,
            avoid_pre_news_entry,
            volatility_pressure,
            uncertainty_pressure,
            directional_alignment,
        }
    });

    // NEWS_MODIFIER_RESULT: final returned artifact
    const out = {
        volatility_pressure,
        uncertainty_pressure,
        directional_alignment,
        macro_context: {
            active_event: results[0]?.event_id ?? "NEWS",
            phase,
            impact,
            expected_volatility,
            macro_bias,
            execution_modifier: {
                reduce_size,
                avoid_pre_news_entry,
            },
            confidence_modifier: -uncertainty_pressure,
            narrative,
            risk_modifiers: {
                uncertainty_pressure,
                volatility_pressure,
            },
        },
        macro_ire,
    };

    // Attach hydration/trace id on macro_context and macro_ire for lineage
    try {
        (out.macro_context as any).cognition_id = (out.macro_context as any).cognition_id || `macro_${Date.now()}`;
        (out as any).macro_ire = (out as any).macro_ire || macro_ire;
        if ((out as any).macro_ire) (out as any).macro_ire.cognition_id = (out as any).macro_ire.cognition_id || `macro_ire_${Date.now()}`;
    } catch (_) { }

    log({ stage: 'MACRO_HYDRATION_TRACE', message: 'News modifier hydration produced macro context', data: { cognition_id: (out.macro_context as any).cognition_id, macro_ire_id: (out as any).macro_ire?.cognition_id } });

    return out;
}

export default buildNewsModifier;
