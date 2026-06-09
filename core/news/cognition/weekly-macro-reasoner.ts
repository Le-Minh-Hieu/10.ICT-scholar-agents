import { callLLM } from "../../../shared/utils/llm-utils.js";
import { deriveMarketTimeContext, MARKET_TIMEZONE } from "./daily-context-temporal.js";

export async function reasonAboutWeek(input: {
  week_type: string;
  primary_drivers: string[];
  active_events: any[];
  upcoming_events: any[];
  retrieved_chunks: any[];
  volatility_expectation: string;
  calendar_bias?: any;
}) {

  const events = [
    ...(input.active_events || []),
    ...(input.upcoming_events || [])
  ].filter((e: any) => {
    const impact =
      String(e.impact || "").toUpperCase();

    return (
      impact === "HIGH" ||
      impact === "MEDIUM"
    );
  });

  const eventSummary =
    events
      .map((e) => {

        const nyDay =
          deriveMarketTimeContext(
            e.scheduled_time
          ).market_weekday;
        const marketDate =
          deriveMarketTimeContext(
            e.scheduled_time
          ).market_date;

        return JSON.stringify({
          id: e.id,
          day: nyDay,
          market_date: marketDate,
          market_timezone: MARKET_TIMEZONE,
          title: e.title,
          impact: e.impact,
          scheduled_time:
            e.scheduled_time
        });

      })
      .join("\n");

  const chunkSummary =
    (input.retrieved_chunks || [])
      .slice(0, 50)
      .map(
        (c: any) =>
          `[${c.chunk_id}] ${String(c.text || "")}`
      )
      .join("\n\n");
  const bias = input.calendar_bias || {};

  const biasSummary = `
Weekly Bias:
${bias.weekly_bias ?? "neutral"}

Confidence:
${bias.confidence ?? 0}

Bucket Scores:
${JSON.stringify(
    bias.bucket_scores || {},
    null,
    2
  )}

Currency Scores:
${JSON.stringify(
    bias.currency_scores || [],
    null,
    2
  )}
`;
  console.log(
    "[WEEKLY_REASONER_INPUT]",
    JSON.stringify({
      retrieved_chunks_count: (input.retrieved_chunks || []).length,
      prompt_chunk_count: Math.min((input.retrieved_chunks || []).length, 50),
      chunk_ids: (input.retrieved_chunks || []).slice(0, 20).map((c: any) => c.chunk_id),
      chunk_summary_char_length: chunkSummary.length
    })
  );

  const prompt = `
You are an ICT Weekly Macro Analyst.
==================================================
CALENDAR BIAS (PRIMARY ANCHOR)
==================================================

${biasSummary}

This bias is the primary directional anchor.

Rules:

1. The calendar bias defines the directional regime.

2. Retrieved ICT context must be interpreted through the calendar bias.

3. You may:
   - explain the bias
   - refine the narrative
   - identify tension
   - reduce confidence

4. You may NOT reverse the directional anchor.

5. If ICT evidence conflicts with the calendar bias:
   - keep the calendar bias
   - explain the conflict
   - express uncertainty

6. Theme, narrative, delivery model and story arc must be consistent with the calendar bias.

7. Use bucket_scores to identify
the macro drivers behind the bias.

8. Use currency_scores to identify
which currencies are structurally
strong or weak.

9. Narratives should explain WHY
the bias exists using these drivers,
not merely repeat the direction.

Calendar:
${eventSummary}

Retrieved ICT Context:
${chunkSummary}

==================================================
OBJECTIVE
=========

Analyze the Calendar Bias together with the Retrieved ICT Context.

The Calendar Bias is authoritative.

Retrieved ICT Context is explanatory evidence.

The objective is not to determine direction.

The objective is to explain and structure the direction already established by Calendar Bias.

Identify recurring ICT weekly delivery patterns supported by the retrieved evidence.

Produce:

1. dominant_theme
2. dominant_narrative
3. weekly_delivery_model
4. weekly_story_arc

All conclusions must be supported by retrieved ICT evidence.

Do not fabricate ICT concepts.

==================================================
DAY MAPPING RULES
=================

* Use the provided day field.
* Never infer weekdays.
* Never move events to another day.
* supporting_event_ids must belong to the same day as the story arc node.
* If an event belongs to another day, do not use it.

==================================================
STORY ARC RULES
===============

Each weekly_story_arc node represents the role of a day within the weekly delivery pattern.

The role must:

* Be grounded in retrieved ICT evidence.
* Be supported by one or more supporting_chunks.
* Represent a recurring ICT delivery concept.
* Be reusable across multiple weeks.
* Be concise.
* Not be a sentence.
* Not be a market commentary.
* Not be a macro-economic summary.

==================================================
ROLE FORMAT RULES
=================

A role should resemble a profile label or profile title.

A valid role typically:

* contains between 1 and 8 words
* is concise
* is reusable
* represents a recurring delivery pattern

Invalid roles:

* complete sentences
* explanatory phrases
* narrative descriptions
* event summaries

Ask yourself:

Would this work as the title of an ICT profile?

If NO:

return "INSUFFICIENT_EVIDENCE".

Minor normalization is allowed.

Do not invent terminology that is unsupported by evidence.

==================================================
THEME RULES
===========

dominant_theme represents the dominant recurring ICT weekly profile.

A theme should describe:

* the overall weekly structure
* the dominant weekly profile
* the recurring delivery pattern

A theme should not simply summarize:

* inflation
* labor market data
* GDP data
* central bank commentary
* economic outlook

unless no ICT profile evidence exists.

If no ICT profile evidence exists:

return "INSUFFICIENT_EVIDENCE".

==================================================
NARRATIVE RULES
===============

dominant_narrative explains how the week is expected to unfold.

Narratives may:

* synthesize multiple supported concepts
* describe sequencing
* describe progression
* describe transitions
* describe weekly development

Narratives must remain grounded in retrieved evidence.

Narratives may be descriptive.

Roles may not.

==================================================
DELIVERY MODEL RULES
====================

weekly_delivery_model represents the recurring weekly structure implied by the evidence.

It must be derived from:

* weekly_story_arc
* supporting_chunks
* retrieved ICT context

If weekly_story_arc contains grounded ICT concepts:

weekly_delivery_model must not be "INSUFFICIENT_EVIDENCE".

The delivery model should summarize the overall structure represented by the story arc.

The delivery model may synthesize multiple supported concepts.

The delivery model should not be a macro-economic headline.

==================================================
EVIDENCE RULES
==============

* Use supporting_event_ids when referencing events.
* Do not use event titles as identifiers.
* supporting_event_ids must only contain ids from Calendar.
* supporting_chunks must only contain retrieved chunk ids.
* Every story arc node should have evidence support.
* Do not fabricate evidence.
* Do not fabricate chunk ids.

==================================================
OUTPUT RULES
============

If evidence is insufficient:

return "INSUFFICIENT_EVIDENCE".

Return JSON only.

{
"uncertainty_pressure": 0.0,
"volatility_pressure": 0.0,
"directional_pressure": 0.0,
"repricing_severity": 0.0,

"dominant_theme": "",
"dominant_narrative": "",

"expected_weekly_high_day": "",
"expected_weekly_low_day": "",
"expected_expansion_day": "",

"weekly_delivery_model": "",

"weekly_story_arc": [
{
"day": "",
"role": "",
"supporting_event_ids": [],
"supporting_events": [],
"supporting_chunks": [],
"confidence": 0.0
}
],

"supporting_chunks": []
}
`;

  const raw = await callLLM(
    prompt,
    "Weekly-Macro-Reasoner",
    "weekly",
    [{ text: prompt }],
    { responseType: "json" }
  );
  console.log(
    "[WEEKLY_REASONER_RAW]",
    JSON.stringify(raw, null, 2)
  );
  let parsed: any = {};

  try {
    parsed =
      typeof raw === "string"
        ? JSON.parse(raw)
        : raw || {};

    const eventMap =
      new Map(
        events.map((e: any) => [
          e.id,
          {
            title: e.title,
            day:
              deriveMarketTimeContext(
                e.scheduled_time
              ).market_weekday
          }
        ])
      );

    for (const arc of parsed.weekly_story_arc || []) {

      const audits =
        (arc.supporting_event_ids || [])
          .map((id: any) => {

            const ev =
              eventMap.get(id);

            return {
              id,
              event_day:
                ev?.day,
              arc_day:
                arc.day,
              match:
                ev?.day === arc.day
            };
          });

      console.log(
        "[STORY_ARC_DAY_AUDIT]",
        {
          day: arc.day,
          role: arc.role,
          audits
        }
      );
    }
    console.log(
      "[WEEKLY_STORY_ARC]",
      JSON.stringify(
        parsed.weekly_story_arc || [],
        null,
        2
      )
    );
    console.log(
      "[WEEKLY_STORY_ARC_CHUNKS]",
      JSON.stringify(
        (parsed.weekly_story_arc || []).map((x: any) => ({
          day: x.day,
          role: x.role,
          supporting_chunks: x.supporting_chunks
        })),
        null,
        2
      )
    );
    for (const arc of parsed.weekly_story_arc || []) {

      const role = String(
        arc.role || ""
      ).toLowerCase();

      const grounded =
        (arc.supporting_chunks || [])
          .some((chunkId: string) => {

            const chunk =
              (input.retrieved_chunks || [])
                .find(
                  (c: any) =>
                    String(c.chunk_id) === String(chunkId)
                );

            return String(
              chunk?.text || ""
            )
              .toLowerCase()
              .includes(role);
          });

      console.log(
        "[ROLE_GROUNDING_AUDIT]",
        {
          day: arc.day,
          role: arc.role,
          grounded
        }
      );
    }
  }
  catch {
    parsed = {};
  }
  console.log(
    "[WEEKLY_REASONER_PERSIST]",
    {
      story_arc_count:
        Array.isArray(parsed.weekly_story_arc)
          ? parsed.weekly_story_arc.length
          : 0,

      dominant_theme:
        parsed.dominant_theme,

      dominant_narrative:
        parsed.dominant_narrative
    }
  );
  return {
    event_id: "WEEKLY_PROFILE",
    weekly_story_arc:
      Array.isArray(parsed.weekly_story_arc)
        ? parsed.weekly_story_arc
        : [],
    dominant_theme:
      parsed.dominant_theme,

    dominant_narrative:
      parsed.dominant_narrative,
    weekly_delivery_model:
      parsed.weekly_delivery_model,

    expected_weekly_high_day:
      parsed.expected_weekly_high_day,

    expected_weekly_low_day:
      parsed.expected_weekly_low_day,

    expected_expansion_day:
      parsed.expected_expansion_day,
    event_title:
      parsed.dominant_theme ||
      parsed.dominant_narrative ||
      "Weekly Macro Narrative",

    impact: "HIGH",

    evidence_summaries:
      (input.retrieved_chunks || [])
        .slice(0, 50)
        .map((c: any) => ({
          chunk_id: String(c.chunk_id),
          summary: String(c.text || "")
            .replace(/\s+/g, " ")
            .slice(0, 180)
        })),

    chunk_citations:
      Array.isArray(parsed.supporting_chunks)
        ? parsed.supporting_chunks.map(
          (id: any) =>
            String(id).startsWith("chunk_")
              ? String(id)
              : `chunk_${id}`
        )
        : [],

    uncertainty_pressure:
      Number(parsed.uncertainty_pressure || 0),

    volatility_pressure:
      Number(parsed.volatility_pressure || 0),

    manipulation_probability:
      0.5,

    expansion_probability:
      Number(parsed.volatility_pressure || 0),

    repricing_severity:
      Number(parsed.repricing_severity || 0),

    directional_pressure:
      Number(parsed.directional_pressure || 0)
  };
}

export default reasonAboutWeek;
