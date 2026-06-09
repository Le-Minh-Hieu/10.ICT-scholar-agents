import { callLLM } from "../../../shared/utils/llm-utils.js";
import { log } from "../../../shared/utils/logger.js";

export type NewsReasoningResult = {
  event_id: string;
  evidence_summaries: {
    chunk_id: string;
    summary: string;
  }[];
  chunk_citations: string[];
  uncertainty_pressure: number;
  volatility_pressure: number;
  manipulation_probability: number;
  expansion_probability: number;
  repricing_severity: number;
  directional_pressure: number;
  contradiction_notes?: string;
};

export type Chunk = {
  chunk_id: string;
  text: string;
  score?: number;
};

export type MacroTheme = {
  theme: string;
  confidence: number;
  supporting_events: string[];
  supporting_evidence: string[];
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function toEvidenceText(rr: NewsReasoningResult, maxSummaries = 6) {
  const sums = rr.evidence_summaries || [];
  const top = sums.slice(0, maxSummaries);
  return top.map((s) => `- ${s.chunk_id}: ${s.summary}`);
}

function buildFallbackThemes(reasoningResults: NewsReasoningResult[]): MacroTheme[] {
  const byEffect = reasoningResults || [];

  const repricingScore = byEffect.reduce((a, r) => a + clamp01(r.repricing_severity) * 1.0, 0);
  const expansionScore = byEffect.reduce((a, r) => a + clamp01(r.expansion_probability) * 1.0, 0);
  const volatilityScore = byEffect.reduce((a, r) => a + clamp01(r.volatility_pressure) * 1.0, 0);
  const uncertaintyScore = byEffect.reduce((a, r) => a + clamp01(r.uncertainty_pressure) * 1.0, 0);

  const total = Math.max(1, byEffect.length);
  const avgRepricing = repricingScore / total;
  const avgExpansion = expansionScore / total;
  const avgVol = volatilityScore / total;
  const avgUnc = uncertaintyScore / total;

  const themes: MacroTheme[] = [];

  // Pick 3–5 themes deterministically from numeric patterns.
  const dir = byEffect.reduce((a, r) => a + (Number.isFinite(r.directional_pressure) ? r.directional_pressure : 0), 0) / total;

  const inflation = avgRepricing * 0.85 + avgVol * 0.25;
  const riskOn = avgExpansion * 0.7 + Math.max(0, dir) * 0.3;
  const riskOff = avgExpansion * 0.2 + avgUnc * 0.8 + Math.max(0, -dir) * 0.4;

  // Inflation Repricing
  if (avgRepricing > 0.30) {
    themes.push({
      theme: "Inflation Repricing",
      confidence: clamp01(inflation),
      supporting_events: byEffect.slice(0, 3).map((r) => String(r.event_id)),
      supporting_evidence: byEffect.slice(0, 2).flatMap((r) => toEvidenceText(r, 3))
    });
  }

  // Growth/Consumer/Labor weak proxies
  const weakProxy = avgVol * 0.55 + avgUnc * 0.45;
  if (weakProxy > 0.30) {
    themes.push({
      theme: "Labor Market Deterioration",
      confidence: clamp01(weakProxy),
      supporting_events: byEffect.slice(0, 3).map((r) => String(r.event_id)),
      supporting_evidence: byEffect.slice(0, 2).flatMap((r) => toEvidenceText(r, 3))
    });
  }

  // Rate Path Uncertainty proxy
  themes.push({
    theme: "Rate Path Uncertainty",
    confidence: clamp01(avgUnc * 0.8 + avgVol * 0.2),
    supporting_events: byEffect.slice(0, 2).map((r) => String(r.event_id)),
    supporting_evidence: byEffect.slice(0, 2).flatMap((r) => toEvidenceText(r, 3))
  });

  // Risk on/off sentiment
  themes.push({
    theme: dir >= 0 ? "Risk-On Sentiment" : "Risk-Off Sentiment",
    confidence: clamp01(dir >= 0 ? riskOn : riskOff),
    supporting_events: byEffect.slice(0, 2).map((r) => String(r.event_id)),
    supporting_evidence: byEffect.slice(0, 2).flatMap((r) => toEvidenceText(r, 3))
  });

  // Optional: Growth slowdown or Consumer weakness
  if (themes.length < 5) {
    if (avgExpansion < 0.45) {
      themes.push({
        theme: "Growth Slowdown",
        confidence: clamp01(avgExpansion < 0.4 ? 0.6 : (1 - avgExpansion) * 0.6 + avgUnc * 0.25),
        supporting_events: byEffect.slice(0, 2).map((r) => String(r.event_id)),
        supporting_evidence: byEffect.slice(0, 2).flatMap((r) => toEvidenceText(r, 3))
      });
    }
  }

  // De-dupe by theme and cap to 7
  const seen = new Set<string>();
  const uniq: MacroTheme[] = [];
  for (const t of themes) {
    if (seen.has(t.theme)) continue;
    seen.add(t.theme);
    uniq.push(t);
    if (uniq.length >= 7) break;
  }
  return uniq;
}

export async function synthesizeThemes(
  reasoningResults: NewsReasoningResult[],
  chunks: Chunk[]
): Promise<MacroTheme[]> {
  const safeRR = Array.isArray(reasoningResults) ? reasoningResults : [];

  if (!safeRR.length) {
    return [];
  }
  const evidencePairs =
    safeRR.map((rr: any) => ({
      event_id: rr.event_id,

      event_title:
        rr.event_title || "",

      impact:
        rr.impact || "",

      uncertainty_pressure:
        rr.uncertainty_pressure,

      volatility_pressure:
        rr.volatility_pressure,

      manipulation_probability:
        rr.manipulation_probability,

      expansion_probability:
        rr.expansion_probability,

      repricing_severity:
        rr.repricing_severity,

      directional_pressure:
        rr.directional_pressure,

      contradiction_notes:
        rr.contradiction_notes,

      evidence_summaries:
        (rr.evidence_summaries || [])
          .slice(0, 8)
    }));

  const chunkPreview = (Array.isArray(chunks) ? chunks : [])
    .slice(0, 12)
    .map((c) => ({ chunk_id: c.chunk_id, text: String(c.text || "").slice(0, 220) }));

  const prompt = `
  You are an ICT Weekly Context Synthesizer.

CRITICAL

Every supporting_evidence string MUST be copied verbatim from evidence_summaries.

Never create evidence.

Never paraphrase evidence.

Never summarize evidence.

Only use evidence that already exists in INPUT.

Do not invent:

* evidence
* statistics
* economic releases
* central bank statements
* event identifiers

If evidence is insufficient:

lower confidence rather than inventing support.

==================================================
INPUT
=====

* reasoningResults: grounded event reasoning results
* chunks: retrieved ICT context

Event metadata:

* event_title
* impact
* event type

must be considered first-class evidence.

Retrieved ICT context should be considered before generic macro interpretations.

==================================================
OBJECTIVE
=========

Identify recurring weekly profile themes supported by the evidence.

Themes should describe:

* weekly structure
* weekly profile
* delivery behavior
* recurring weekly patterns
* market delivery characteristics

Themes should not simply summarize:

* inflation
* labor markets
* GDP
* central bank commentary
* economic outlook

unless no ICT profile evidence exists.

==================================================
THEME RULES
===========

Generate 3-7 themes.

Each theme must:

* be grounded in evidence
* be supported by supporting_events
* be supported by supporting_evidence
* represent a meaningful weekly context

Themes may describe:

* accumulation
* manipulation
* expansion
* distribution
* reversal
* weekly profile development
* liquidity behavior
* delivery structure
* weekly sequencing

Themes do NOT need to match predefined labels.

Do not force themes into fixed categories.

Allow evidence to determine the theme.

==================================================
EVIDENCE PRIORITY
=================

Use evidence in the following order:

1. event_title
2. impact
3. event type
4. evidence_summaries
5. retrieved ICT context

HIGH impact events should be prioritized over MEDIUM impact events.

MEDIUM impact events should be prioritized over LOW impact events.

If a HIGH impact event supports a theme:

do not use LOW impact events as primary supporting_events.

==================================================
SUPPORTING EVENTS
=================

supporting_events must contain only valid event_id values provided in INPUT.

Never generate new IDs.

Never invent UUIDs.

Never fabricate events.

==================================================
SUPPORTING EVIDENCE
===================

Every supporting_evidence item:

* must be copied directly from evidence_summaries
* must remain verbatim
* must include the original chunk reference if present

Do not rewrite evidence.

Do not create synthetic evidence.

==================================================
CONFIDENCE
==========

confidence must be between 0 and 1.

Confidence should reflect:

* quality of evidence
* amount of evidence
* consistency of evidence
* importance of supporting events

Weak evidence:

low confidence.

Strong evidence:

high confidence.

==================================================
OUTPUT
======

Return JSON only.

[
{
"theme": "",
"confidence": 0.0,
"supporting_events": [],
"supporting_evidence": []
}
]
`;
  const themePayload = JSON.stringify({
    reasoningResults: evidencePairs,
    chunks: chunkPreview
  }).slice(0, 12000);

  const combinedPrompt = `
${prompt}

INPUT_DATA
${themePayload}
`;

  try {
    const raw = await callLLM(
      combinedPrompt,
      "Macro-Theme-Synthesizer",
      safeRR[0].event_id || "macro-themes",
      [{ text: combinedPrompt }],
      { responseType: "json" }
    );
    console.log(
      "THEME_LLM_RAW",
      JSON.stringify(raw, null, 2)
    );
    let parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (!Array.isArray(parsed)) {

      console.error(
        "THEME_FALLBACK_TRIGGERED",
        {
          reason: "INVALID_JSON_SHAPE",
          raw
        }
      );

      log({
        stage: "THEME_SYNTHESIS",
        message: "Invalid JSON shape (expected array)"
      });

      return buildFallbackThemes(safeRR);
    }

    const out: MacroTheme[] = [];
    for (const item of parsed) {
      const theme = String(item?.theme || "").trim();
      if (!theme) continue;

      const confidence = clamp01(Number(item?.confidence ?? 0));

      const supporting_events: string[] = Array.isArray(item?.supporting_events)
        ? item.supporting_events.map((e: any) => String(e)).filter(Boolean)
        : [];

      const validEventIds = new Set(safeRR.map((r) => String(r.event_id)));
      const fallbackEventIds =
        safeRR
          .slice(0, 3)
          .map((r) => String(r.event_id));
      const filteredEvents =
        supporting_events.filter(
          (id) => validEventIds.has(id)
        );
      const finalEvents =
        filteredEvents.length > 0
          ? filteredEvents
          : fallbackEventIds;
      const supporting_evidence: string[] = Array.isArray(item?.supporting_evidence)
        ? item.supporting_evidence.map((s: any) => String(s)).filter(Boolean).slice(0, 10)
        : [];

      if (
        supporting_evidence.length === 0
      ) {
        continue;
      }
      out.push({
        theme,
        confidence,
        supporting_events:
          finalEvents.slice(0, 5),
        supporting_evidence: supporting_evidence.slice(0, 8)
      });

      if (out.length >= 7) break;
    }
    log({
      stage: "THEME_SYNTHESIS",
      message: "Theme synthesis success",
      data: {
        generated: out.length
      }
    });
    if (out.length === 0) {

      console.error(
        "THEME_FALLBACK_TRIGGERED",
        {
          reason: "NO_VALID_THEMES",
          parsed
        }
      );

      return buildFallbackThemes(safeRR);
    }

    // Sort by confidence desc
    out.sort((a, b) => b.confidence - a.confidence);

    return out;
  } catch (e: any) {

    console.error(
      "THEME_FALLBACK_TRIGGERED",
      {
        reason: "EXCEPTION",
        error: e?.message
      }
    );

    log({
      stage: "THEME_SYNTHESIS",
      message: "Theme synthesis failed",
      data: {
        error: e?.message
      }
    });

    return buildFallbackThemes(safeRR);
  }
}

export default synthesizeThemes;

