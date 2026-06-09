import { callLLM } from "../../shared/utils/llm-utils.js";
import { log } from "../../shared/utils/logger.js";

export type NewsReasoningResult = {
    event_id: string;
    event_title?: string;
    impact?: string;
    evidence_summaries: { chunk_id: string; summary: string }[];
    chunk_citations: string[];
    uncertainty_pressure: number; // 0-1
    volatility_pressure: number; // 0-1
    manipulation_probability: number; // 0-1
    expansion_probability: number; // 0-1
    repricing_severity: number; // 0-1
    directional_pressure: number; // -1..1 (negative = bearish, positive = bullish)
    contradiction_notes?: string;
    telemetry?: any;
};

/**
 * Grounded news reasoner: instructs LLM to produce structured, chunk-cited probabilistic outputs.
 * Enforces grounding by validating returned chunk citations.
 */
export async function reasonAboutNews(
    event: any,
    chunksOrScored: any[] | { chunks: any[]; scoredEvidence?: any[]; contradiction?: any; live_events?: any[] },
    pmso?: any,
    htfProfile?: any,
    temporalState?: any
): Promise<NewsReasoningResult> {
    // chunksOrScored can be legacy chunks[] or the object returned from retrieveNewsContext
    const isWrapped = Array.isArray(chunksOrScored) === false && chunksOrScored && Array.isArray(chunksOrScored.chunks);
    const rawChunks = isWrapped ? chunksOrScored.chunks : (chunksOrScored as any[]);
    const scoredEvidence = isWrapped ? (chunksOrScored.scoredEvidence || []) : [];
    const contradiction = isWrapped ? (chunksOrScored.contradiction || {}) : {};
    const liveEvents = isWrapped ? (chunksOrScored.live_events || []) : [];

    log({
        stage: "NEWS_GROUNDED_REASONING",
        message: "Starting reasoning for news event",
        data: {
            event: event.id,
            chunkCount: rawChunks.length,
            scoredEvidenceCount: scoredEvidence.length,
            LIVE_MACRO_EVENTS_FOUND: liveEvents.length
        }
    });

    const evidenceList = (scoredEvidence.length ? scoredEvidence : rawChunks).map((c: any) => {
        const meta = c.final_score !== undefined ? ` score=${c.final_score}` : "";
        return `[${c.chunk_id}]${meta} ${String(c.text || c.summary || "").slice(0, 300).replace(/\n/g, ' ')}`;
    }).join("\n\n");

    const liveEventsPreview = (liveEvents || [])
        .slice(0, 10)
        .map((ev: any) => {
            const cat = ev?.category ?? "UNKNOWN";
            const conf = typeof ev?.confidence === "number" ? ev?.confidence : undefined;
            return `- ${String(ev?.title ?? "")} [${cat}] id=${String(ev?.id ?? "")} conf=${conf ?? "n/a"} ts=${String(ev?.timestamp ?? "")}`;
        })
        .join("\n");

    const liveBoost = Math.min(1, Math.max(0, (typeof event?.confidence === "number" ? event.confidence : 0.25)));
    const livePresence = (liveEvents || []).length > 0;

    const prompt = `You are a market cognition assistant converting LIVE MACRO EVENTS into numeric pressures.
Input:
- LIVE_EVENTS (primary substrate; use this first):
${liveEventsPreview || "(none)"}
- FOCUSED_NEWS_EVENT:
  id=${event.id}
  title=${event.title}
  impact=${event.impact || "UNKNOWN"}
  scheduled_time=${event.scheduled_time || ""}
- PMSO: ${pmso ? JSON.stringify(pmso).slice(0, 800) : "{}"}
- HTF_PROFILE: ${htfProfile ? JSON.stringify(htfProfile).slice(0, 400) : "{}"}
- CONTRADICTION: ${JSON.stringify(contradiction).slice(0, 400)}

Chunk EVIDENCE (optional justification; do NOT make it your only source):
${evidenceList || "(no chunks)"}
IMPORTANT:

The focused event title and impact are the primary anchor.

Do not reason primarily from chunk evidence.

First identify:

- what event it is
- why it matters
- whether it is inflation
- labor
- growth
- central bank
- confidence
- housing
- manufacturing

Then use chunk evidence only as supporting context.
Use the LIVE_EVENTS as the main substrate for identifying directional and volatility pressures, and use the focused event details to calibrate severity. Use chunks only to adjust or color the reasoning, not to drive it. If chunk evidence is weak (e.g. low scores, few chunks) and there are no live events, attenuate all pressures by 70% and note this in the output.
Task: Produce a strict JSON object with the following fields:
- evidence_summaries: array of { chunk_id, summary } (may be empty if chunk evidence is weak/unavailable)
- chunk_citations: list of chunk_ids used (may be empty)
- uncertainty_pressure: 0.0-1.0
- volatility_pressure: 0.0-1.0
- manipulation_probability: 0.0-1.0
- expansion_probability: 0.0-1.0
- repricing_severity: 0.0-1.0
- directional_pressure: -1.0 .. 1.0 (negative = bearish influence)
- contradiction_notes: optional string

Rules:
1) Use LIVE_EVENTS to set uncertainty_pressure and volatility_pressure. Chunks are supporting only.
2) Do NOT invent price levels, sources, or new chunk_ids.
3) Values must be numeric where specified and between the ranges above.
4) If contradictions exist, explicitly explain uncertainty and reduce certainty in outputs.
5) Return only valid JSON.
`;

    try {
        const rawLlmResult = await callLLM(prompt, "News-Reasoner", event.id, [{ text: prompt }], { responseType: 'json', returnTelemetry: true });
        const raw = rawLlmResult.data;
        const telemetry = rawLlmResult.telemetry;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

        const citations = (parsed.chunk_citations || []).map((s: any) => String(s));
        const missing = citations.filter((c: string) => !rawChunks.find((ch) => ch.chunk_id === c));

        const out: NewsReasoningResult = {
            event_id: event.id,
            evidence_summaries: parsed.evidence_summaries || [],
            chunk_citations: missing.length ? [] : citations,
            uncertainty_pressure: Number(parsed.uncertainty_pressure || 0),
            volatility_pressure: Number(parsed.volatility_pressure || 0),
            manipulation_probability: Number(parsed.manipulation_probability || 0),
            expansion_probability: Number(parsed.expansion_probability || 0),
            repricing_severity: Number(parsed.repricing_severity || 0),
            directional_pressure: Number(parsed.directional_pressure || 0),
            contradiction_notes: parsed.contradiction_notes || undefined,
            event_title: event.title,
            impact: event.impact,
            telemetry,
        };

        if (missing.length > 0) {
            log({
                stage: "NEWS_GROUNDED_REASONING",
                message: "Reasoner cited unknown chunks; dropping citations (not rejecting)",
                data: { missing }
            });
        }

        const citationStrength = out.chunk_citations.length;

        // Apply contradiction-driven uncertainty amplification (bounded)
        const contradictionDensity = (contradiction && contradiction.contradiction_density) ? Number(contradiction.contradiction_density) : 0;
        if (contradictionDensity > 0.15) {
            const factor = Math.min(1.5, 1 + contradictionDensity * 0.8);
            out.uncertainty_pressure = Math.min(1, (out.uncertainty_pressure || 0) * factor + contradictionDensity * 0.15);
            out.contradiction_notes = `${out.contradiction_notes || ""} CONTRADICTION_ADJUSTED`;
        }

        // If chunks are weak, only attenuate when there are NO live events.
        if (citationStrength < 2 && !livePresence) {
            out.uncertainty_pressure *= 0.3;
            out.volatility_pressure *= 0.3;
            out.manipulation_probability *= 0.3;
            out.expansion_probability *= 0.3;
            out.repricing_severity *= 0.3;
            out.directional_pressure *= 0.3;

            out.contradiction_notes = `${out.contradiction_notes || ""}\nWEAK_EVIDENCE_GROUNDING`;
        }

        // Ensure event-driven substrate can produce non-zero pressures.
        if (livePresence) {
            out.uncertainty_pressure = Math.max(out.uncertainty_pressure, 0.15);
            out.volatility_pressure = Math.max(out.volatility_pressure, 0.15);
        }

        log({
            stage: "MACRO_EVENTS_REASONED",
            message: "Macro event pressures generated",
            data: {
                event: event.id,
                LIVE_MACRO_EVENTS_FOUND: liveEvents.length,
                uncertainty_pressure: out.uncertainty_pressure,
                volatility_pressure: out.volatility_pressure,
                directional_pressure: out.directional_pressure,
                citations_used: out.chunk_citations.length
            }
        });

        return out;
    } catch (e: any) {
        log({ stage: "NEWS_GROUNDED_REASONING", message: "Reasoner failed", data: { error: e?.message }, level: "ERROR" });
        return {
            event_id: event.id,
            evidence_summaries: [],
            chunk_citations: [],
            uncertainty_pressure: 0,
            volatility_pressure: 0,
            manipulation_probability: 0,
            expansion_probability: 0,
            repricing_severity: 0,
            directional_pressure: 0,
        };
    }
}

export default reasonAboutNews;
