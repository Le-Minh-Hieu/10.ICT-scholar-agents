// core/news/cognition/weekly-profile-query-builder.ts
import { deriveMarketTimeContext } from "./daily-context-temporal.js";

export interface WeeklyProfileQueryInput {
    active_events?: any[];
    upcoming_events?: any[];
}

export interface WeeklyProfileQueryResult {
    weekly_profile_query: string;
}

const DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday"
];

function normalizeImpact(event: any): string | null {
    const impact =
        String(event?.impact || "")
            .trim()
            .toUpperCase();

    const title =
        String(event?.title || event?.name || "")
            .toLowerCase();

    const category =
        String(event?.category || "")
            .toLowerCase();

    if (
        title.includes("holiday") ||
        category.includes("holiday") ||
        impact.includes("HOLIDAY")
    ) {
        return "Bank Holiday";
    }

    if (impact === "HIGH") {
        return "High Impact";
    }

    if (impact === "MEDIUM") {
        return "Medium Impact";
    }

    return null;
}

function getEventTitle(event: any): string {
    return String(
        event?.title ||
        event?.name ||
        event?.id ||
        "Unknown Event"
    ).trim();
}

function getWeekday(event: any): string | null {
    const timestamp =
        event?.scheduled_time;

    if (!timestamp) {
        return null;
    }

    const market =
        deriveMarketTimeContext(timestamp);
    const day =
        market.market_weekday;
    console.log(
        "[WEEKDAY_AUDIT]",
        {
            title:
                getEventTitle(event),

            scheduled_time:
                timestamp,
            market_date:
                market.market_date,

            utc_day:
                new Date(timestamp)
                    .toLocaleDateString(
                        "en-US",
                        {
                            weekday: "long",
                            timeZone: "UTC"
                        }
                    ),

            ny_day:
                market.market_weekday,

            assigned_day:
                day
        }
    );
    return DAY_ORDER.includes(day)
        ? day
        : null;
}

export function buildWeeklyProfileQuery(
    input: WeeklyProfileQueryInput
): WeeklyProfileQueryResult {

    const events = [
        ...(input.active_events || []),
        ...(input.upcoming_events || [])
    ];
    events.sort(
        (a, b) =>
            new Date(a.scheduled_time).getTime() -
            new Date(b.scheduled_time).getTime()
    );
    const grouped =
        new Map<string, string[]>();

    for (const day of DAY_ORDER) {
        grouped.set(day, []);
    }

    for (const event of events) {

        const impactLabel =
            normalizeImpact(event);

        // Ignore low impact events
        if (!impactLabel) {
            continue;
        }

        const weekday =
            getWeekday(event);

        if (!weekday) {
            continue;
        }

        const title =
            getEventTitle(event);

        grouped
            .get(weekday)!
            .push(
                `${title} - ${impactLabel}`
            );
    }

    const sections: string[] = [];

    sections.push("weekly profile");
    sections.push("");

    for (const day of DAY_ORDER) {

        sections.push(`${day}:`);

        const items =
            grouped.get(day) || [];

        if (items.length === 0) {
            sections.push("");
            continue;
        }

        for (const item of items) {
            sections.push(item);
        }

        sections.push("");
    }

    return {
        weekly_profile_query:
            sections.join("\n").trim()
    };
}

export default buildWeeklyProfileQuery;
