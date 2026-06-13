import { fetchForexFactoryCalendar } from "../core/news/ingestion/adapter-forexfactory.ts";
import fs from "fs/promises";
import path from "path";

const OUT_PATH = path.join("tmp", "forex_factory_calendar_output.json");

function printFoundNotFound(title: string[], events: any[]) {
  const norm = (s: string) => (s || "").toLowerCase();
  const titles = title.map(norm);

  const found: string[] = [];
  const notFound: string[] = [];

  for (let i = 0; i < titles.length; i++) {
    const t = titles[i];
    const exists = events.some((e) => norm(e?.name).includes(t) || norm(e?.title).includes(t));
    if (exists) found.push(title[i]);
    else notFound.push(title[i]);
  }

  console.log("FOUND:");
  if (found.length === 0) console.log("(none)");
  for (const f of found) console.log(`- ${f}`);

  console.log("NOT FOUND:");
  if (notFound.length === 0) console.log("(none)");
  for (const nf of notFound) console.log(`- ${nf}`);
}

function countByImpact(events: any[]) {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<"HIGH" | "MEDIUM" | "LOW", number>;
  for (const e of events) {
    const imp = e?.impact;
    if (imp === "HIGH") counts.HIGH++;
    else if (imp === "MEDIUM") counts.MEDIUM++;
    else if (imp === "LOW") counts.LOW++;
  }
  return counts;
}

async function main() {
  const sought = [
    "French Bank Holiday",
    "German Bank Holiday",
    "USD Bank Holiday",
    "ECB Financial Stability Review",
    "ECB President Lagarde Speaks",
    "Core PCE",
    "GDP",
    "Unemployment Claims",
    "New Home Sales",
    "German CPI",
  ];

  try {
    const events = await fetchForexFactoryCalendar();

    if (!Array.isArray(events)) {
      throw new Error(`fetchForexFactoryCalendar() did not return an array. Received: ${typeof events}`);
    }

    const total = events.length;
    const { HIGH, MEDIUM, LOW } = countByImpact(events);

    console.log(`Total events: ${total}`);
    console.log(`HIGH count: ${HIGH}`);
    console.log(`MEDIUM count: ${MEDIUM}`);
    console.log(`LOW count: ${LOW}`);

    printFoundNotFound(sought, events);

    console.log("First 10 events:");
    for (const e of events.slice(0, 10)) {
      console.log({
        title: e?.name,
        currency: e?.currency,
        impact: e?.impact,
        scheduled_time: e?.scheduled_time,
      });
    }

    const payload = {
      generated_at: new Date().toISOString(),
      output_path: OUT_PATH,
      totals: { total, HIGH, MEDIUM, LOW },
      events,
    };

    await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
    await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2), "utf-8");
    console.log(`Saved full output to: ${OUT_PATH}`);

    return OUT_PATH;
  } catch (err: any) {
    console.error("Error while fetching/parsing ForexFactory calendar:");
    console.error(err);
    if (err?.stack) console.error(err.stack);
    else console.error("No stack trace available.");
    throw err;
  }
}

await main();

