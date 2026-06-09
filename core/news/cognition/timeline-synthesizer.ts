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

export type MacroTheme = {
  theme: string;
  confidence: number;
  supporting_events: string[];
  supporting_evidence: string[];
};

export type TimelineNode = {
  catalyst: string;
  date: string;
  theme: string;
  expected_effect: string;
  confidence: number;
  evidence?: {
    chunk_id: string;
    summary: string;
  }[];
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function mapThemeToDefaultEffect(theme: string): string {
  const t = String(theme || "").toLowerCase();

  // Strong cues
  if (t.includes("inflation") || t.includes("repricing") || t.includes("rate path")) return "REPRICING";
  if (t.includes("growth") || t.includes("labor") || t.includes("consumer") || t.includes("weakness")) return "EXPANSION";
  if (t.includes("risk-off")) return "REVERSAL";
  if (t.includes("risk-on")) return "DISTRIBUTION";

  return "LIQUIDITY_EVENT";
}

function buildFallbackTimeline(events: any[], themes: MacroTheme[]): TimelineNode[] {
  const safeEvents = Array.isArray(events) ? events : [];
  const theme0 =
    themes?.[0]?.theme ||
    "Liquidity Event";

  return safeEvents
    .slice(0, 25)
    .map((e: any) => {
      const catalyst = String(e?.title || e?.id || "unknown");
      const date = e?.scheduled_time ? String(e.scheduled_time) : new Date().toISOString();
      return {
        catalyst,
        date,
        theme: theme0,
        expected_effect: mapThemeToDefaultEffect(theme0),
        confidence: 0.15
      };
    })
    .slice(0, 20);
}

export async function synthesizeTimeline(
  events: any[],
  reasoningResults: NewsReasoningResult[],
  themes: MacroTheme[]
): Promise<TimelineNode[]> {
  const safeEvents = Array.isArray(events) ? events : [];
  const safeRR = Array.isArray(reasoningResults) ? reasoningResults : [];
  const safeThemes = Array.isArray(themes) ? themes : [];

  if (!safeEvents.length || !safeRR.length || !safeThemes.length) {
    return buildFallbackTimeline(safeEvents, safeThemes);
  }

  const rrByEventId = new Map<string, NewsReasoningResult>();
  for (const rr of safeRR) {
    rrByEventId.set(String(rr.event_id), rr);
  }

  const themeByEventId = new Map<string, string>();
  for (const th of safeThemes) {
    for (const evId of (th.supporting_events || []).slice(0, 5)) {
      if (!themeByEventId.has(String(evId))) themeByEventId.set(String(evId), th.theme);
    }
  }

  const prompt = `You are an ICT Weekly Timeline Analyst.

INPUT

- events
- reasoningResults
- themes

The themes already represent the current weekly profile context.

Your task is to map each calendar catalyst into the evolving weekly timeline.

==================================================
OBJECTIVE
==================================================

For every event:

1. Determine the most relevant weekly profile context.
2. Determine the event's role inside the weekly narrative.
3. Determine the most likely market effect.
4. Produce a timeline node.

Timeline nodes should describe how events contribute to the unfolding weekly profile.

==================================================
EXPECTED EFFECT RULES
==================================================

Allowed values:

- ACCUMULATION
- MANIPULATION
- EXPANSION
- REVERSAL
- DISTRIBUTION
- REPRICING
- LIQUIDITY_EVENT

Expected effects should be inferred from:

1. event importance
2. event pressures
3. supporting evidence
4. weekly profile context

Do not use fixed mappings.

Do not assume:

Inflation -> REPRICING

Growth -> EXPANSION

Risk-Off -> REVERSAL

Each event must be evaluated independently.

==================================================
THEME MAPPING RULES
==================================================

Use supporting_events from themes as the primary mapping source.

Only assign a theme when evidence supports the relationship.

Different events may map to different themes.

Do not force all events into the same theme.

==================================================
EVIDENCE RULES
==================================================

Use evidence_summaries when available.

Evidence should explain why the event belongs to the assigned theme.

If evidence is weak:

reduce confidence.

Do not fabricate evidence.

Do not fabricate relationships.

==================================================
VALIDATION RULES
==================================================

Use ONLY supplied events.

catalyst must exactly match an event title or event id.

date must exactly match the supplied scheduled_time.

Never invent:

- events
- dates
- catalysts
- themes

Every output node must correspond to one supplied event.

==================================================
CONFIDENCE RULES
==================================================

Confidence should reflect:

- strength of evidence
- event impact
- consistency with weekly profile context

0.0 = extremely weak evidence

1.0 = very strong evidence

==================================================
OUTPUT
==================================================

Return JSON only.

[
  {
    "catalyst": "",
    "date": "",
    "theme": "",
    "expected_effect": "",
    "confidence": 0.0,
    "evidence": [
      {
        "chunk_id": "",
        "summary": ""
      }
    ]
  }
]
`;

  try {
    const payload = {
      valid_events: safeEvents
        .slice(0, 25)
        .map((e: any) => ({
          id: e?.id,
          title: e?.title,
          scheduled_time: e?.scheduled_time
        })),
      events: safeEvents.slice(0, 25).map((e: any) => ({
        id: e?.id,
        title: e?.title,
        scheduled_time: e?.scheduled_time,
        impact: e?.impact
      })),
      reasoningResults: safeRR,
      themes: safeThemes.slice(0, 7)
    };
    const timelinePayload =
      JSON.stringify(payload).slice(0, 16000);

    const combinedPrompt = `
${prompt}

INPUT_DATA
${timelinePayload}
`;
    console.log(
      '[TIMELINE_TITLES]',
      payload.events.map((e: any) => e.title)
    );
    console.log(
      "TIMELINE_PAYLOAD_EVENTS",
      payload.events.map((e: any) => ({
        id: e.id,
        title: e.title,
        impact: e.impact,
        scheduled_time: e.scheduled_time
      }))
    );
    const raw = await callLLM(
      combinedPrompt,
      "Macro-Timeline-Synthesizer",
      String(safeEvents?.[0]?.id || "macro-timeline"),
      [{ text: combinedPrompt }],
      { responseType: "json" }
    );
    console.log(
      "TIMELINE_LLM_RAW",
      JSON.stringify(raw, null, 2)
    );

    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) {
      log({ stage: "TIMELINE_SYNTHESIS", message: "Invalid JSON shape (expected array)" });
      return buildFallbackTimeline(safeEvents, safeThemes);
    }

    const allowed = new Set([
      "REPRICING",
      "EXPANSION",
      "REVERSAL",
      "DISTRIBUTION",
      "ACCUMULATION",
      "LIQUIDITY_EVENT"
    ]);
    const validCatalysts = new Set(
      safeEvents.flatMap((e: any) => [
        String(e?.id || ""),
        String(e?.title || "")
      ]).filter(Boolean)
    );
    console.log(
      "VALID_CATALYSTS",
      Array.from(validCatalysts)
    );
    const validDates = new Set(
      safeEvents
        .map((e: any) => e?.scheduled_time)
        .filter(Boolean)
        .map(String)
    );

    const out: TimelineNode[] = [];

    for (const item of parsed) {
      const catalyst =
        String(
          item?.catalyst ??
          item?.id ??
          ""
        ).trim();
      const date =
        String(
          item?.date ??
          item?.scheduled_time ??
          ""
        ).trim();
      let theme =
        String(
          item?.theme ??
          item?.themes?.[0]?.name ??
          ""
        ).trim();
      if (!theme) {

        const eventObj =
          safeEvents.find(
            (e: any) =>
              e.id === catalyst ||
              e.title === catalyst
          );

        if (eventObj) {

          theme =
            themeByEventId.get(
              String(eventObj.id)
            ) ||
            safeThemes[0]?.theme ||
            "Liquidity Event";
        }
      }
      const expected_effect = item?.expected_effect ??
        (
          item?.impact === "HIGH"
            ? "REPRICING"
            : "EXPANSION"
        );
      const confidence = clamp01(Number(item?.confidence ?? 0));
      console.log(
        "TIMELINE_CANDIDATE",
        {
          catalyst,
          date,
          theme,
          expected_effect,
          confidence,
          catalyst_valid:
            validCatalysts.has(catalyst)
        }
      );
      if (!catalyst || !date || !theme || !allowed.has(expected_effect)) continue;
      if (!validCatalysts.has(catalyst)) {
        console.error(
          "TIMELINE_REJECT_CATALYST",
          catalyst
        );
        continue;
      }

      const parsedDate =
        new Date(date).toISOString();
      if (!validDates.has(parsedDate)) {

        console.error(
          "TIMELINE_REJECT_DATE",
          {
            catalyst,
            parsedDate
          }
        );

        continue;
      }
      if (!validDates.has(parsedDate)) {
        continue;
      }
      let evidence:
        { chunk_id: string; summary: string }[] | undefined;
      if (Array.isArray(item?.evidence)) {
        evidence = item.evidence
          .map((ev: any) => ({
            chunk_id: String(ev?.chunk_id || "").trim(),
            summary: String(ev?.summary || "").trim()
          }))
          .filter((x: any) => x.chunk_id && x.summary)
          .slice(0, 3);
        if (evidence && evidence.length === 0) {
          evidence = undefined;
        }
      }

      const node: TimelineNode = {
        catalyst,
        date: parsedDate,
        theme,
        expected_effect,
        confidence,
      };

      if (evidence && evidence.length > 0) {
        node.evidence = evidence;
      }

      out.push(node);

      if (out.length >= 20) break;
    }

    log({
      stage: "TIMELINE_SYNTHESIS",
      message: "Timeline validation result",
      data: {
        generated: parsed?.length ?? 0,
        accepted: out.length
      }
    });
    if (out.length === 0) {
      log({
        stage: "TIMELINE_SYNTHESIS",
        message: "Timeline fallback triggered",
        data: {
          generated: out.length
        }
      });

      return buildFallbackTimeline(
        safeEvents,
        safeThemes
      );
    }

    return out;
  } catch (e: any) {
    log({ stage: "TIMELINE_SYNTHESIS", message: "Timeline synthesis failed", data: { error: e?.message } });
    return buildFallbackTimeline(safeEvents, safeThemes);
  }
}

export default synthesizeTimeline;

