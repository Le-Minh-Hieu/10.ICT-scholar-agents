import { z } from "zod";
import { callLLM } from "../../../shared/utils/llm-utils.js";

export const WeeklyQuestionSchema = z.object({
    narrative_question: z.string(),
    repricing_question: z.string(),
    delivery_question: z.string(),
    day_of_week_question: z.string(),
    liquidity_question: z.string()
});

export type WeeklyQuestionSet =
    z.infer<typeof WeeklyQuestionSchema>;
// export interface WeeklyQuestionSet {
//   narrative_question: string;
//   repricing_question: string;
//   delivery_question: string;
//   day_of_week_question: string;
//   liquidity_question: string;
// }

export async function generateWeeklyQuestions(input: {
    week_start?: string;
    events?: any[];
    active_events?: any[];
    upcoming_events?: any[];
}): Promise<WeeklyQuestionSet> {
    const importantEvents =
        [
            ...(input.active_events || []),
            ...(input.upcoming_events || [])
        ]
            .filter(
                (e: any) =>
                    e.impact === "HIGH" ||
                    e.impact === "MEDIUM"
            )
            .slice(0, 10);
    const payload = {
        week_start: input.week_start,

        important_events:
            importantEvents,

        events:
            (input.events || []).slice(0, 25)
    };
    const prompt = `
You are an ICT macro analyst.

Your goal is NOT to summarize the economic calendar.

Your goal is to generate retrieval questions that uncover:

- weekly narrative
- repricing events
- liquidity distribution
- day-of-week delivery tendencies
- ICT weekly delivery model

Avoid questions about:

- counting events
- listing events
- calendar summaries
- economic calendar explanations

Generate exactly 5 retrieval questions.

The questions MUST explicitly reference the actual scheduled events.

Do NOT refer to:
- catalysts
- events
- releases

in generic terms.

Instead use the actual event names provided in INPUT.

The questions should retrieve knowledge about:

1. Weekly Narrative
2. Repricing Catalyst
3. Dominant Repricing Day
4. Liquidity Distribution Across The Week
5. Weekly Delivery Model

Event Usage Rules:

You MUST use actual event titles from INPUT.

Use the highest impact events first.

Prefer HIGH impact events over MEDIUM impact events.

Every question should explicitly mention one or more real event titles from INPUT.

Do not use placeholders.

Do not use:
- catalyst
- event
- release

as generic terms.

Instead reference actual event names.

Return ONLY the tool output.

Important:

Generate event-specific questions.

Transformation Examples:

BAD:
What macro narrative is likely to dominate this week?

GOOD:
What historical macro narrative tends to emerge when [HIGH_IMPACT_EVENT_A] and [HIGH_IMPACT_EVENT_B] occur within the same trading week?

BAD:
Which catalyst will trigger repricing?

GOOD:
How do markets historically reprice around [HIGH_IMPACT_EVENT_A]?

BAD:
Which day becomes dominant?

GOOD:
Which day historically becomes the dominant repricing day when [HIGH_IMPACT_EVENT_A] occurs before [HIGH_IMPACT_EVENT_B]?

Replace placeholders with actual event titles from INPUT.
Important Events:

${importantEvents
  .map(
    (e: any) =>
      `- ${e.title} (${e.impact})`
  )
  .join("\n")}
${JSON.stringify(payload)}
`;

    const result =
        await callLLM(
            prompt,
            "WeeklyQuestionGenerator",
            Date.now().toString(),
            [{ text: prompt }],
            {
                schema: WeeklyQuestionSchema
            }
        );
    return result as WeeklyQuestionSet;
}

export default generateWeeklyQuestions;