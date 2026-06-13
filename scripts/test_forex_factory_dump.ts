import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reuse the same extraction logic as in adapter-forexfactory.ts
function extractCalendarPayload(html: string): any[] {
  const match = html.match(
    /window\.calendarComponentStates\[\d+\]\s*=\s*({[\s\S]*?});/g
  );

  if (!match) return [];

  const states: any[] = [];

  for (const block of match) {
    const jsonPart = block
      .replace(/^window\.calendarComponentStates\[\d+\]\s*=\s*/, "")
      .replace(/;$/, "");

    try {
      states.push(Function(`"use strict"; return (${jsonPart})`)());
    } catch {
      continue;
    }
  }

  return states;
}

function norm(s: unknown) {
  return String(s ?? "").toLowerCase();
}

function printFoundNotFound(title: string[], events: any[]) {
  const found: string[] = [];
  const notFound: string[] = [];

  for (const t of title) {
    const exists = events.some(
      (e) => norm(e?.name).includes(norm(t)) || norm(e?.title).includes(norm(t))
    );
    if (exists) found.push(t);
    else notFound.push(t);
  }

  console.log("FOUND:");
  if (found.length === 0) console.log("(none)");
  for (const f of found) console.log(`- ${f}`);

  console.log("NOT FOUND:");
  if (notFound.length === 0) console.log("(none)");
  for (const nf of notFound) console.log(`- ${nf}`);
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const ffWeekPath = path.join(repoRoot, "ff_week.html");

  const outPath = path.join(repoRoot, "tmp", "ff_dump_parsed.json");

  try {
    const html = await fs.readFile(ffWeekPath, "utf-8");
    const states = extractCalendarPayload(html);

    const days = states.flatMap((s: any) => s?.days || []);
    const events = days.flatMap((d: any) => d?.events || []);

    console.log(`states count: ${states.length}`);
    console.log(`days count: ${days.length}`);
    console.log(`events count: ${events.length}`);

    const sought = [
      "French Bank Holiday",
      "German Bank Holiday",
      "USD Bank Holiday",
      "ECB Financial Stability Review",
      "ECB President Lagarde Speaks",
      "Core PCE",
      "GDP",
      "Unemployment Claims",
      "German CPI",
    ];

    printFoundNotFound(sought, events);

    console.log("First 20 events:");
    for (const e of events.slice(0, 20)) {
      console.log({
        title: e?.name,
        currency: e?.currency,
        impact: e?.impactName || e?.impact,
        scheduled_time: e?.dateline ? new Date(Number(e.dateline) * 1000).toISOString() : undefined,
      });
    }

    const payload = {
      generated_at: new Date().toISOString(),
      source_path: ffWeekPath,
      tmp_output_path: outPath,
      counts: { states: states.length, days: days.length, events: events.length },
      states,
      days,
      events,
    };

    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf-8");

    console.log(`Saved parsed dump to: ${outPath}`);

    return outPath;
  } catch (err: any) {
    console.error("Error while parsing ff_week.html dump:");
    console.error(err);
    if (err?.stack) console.error(err.stack);
    throw err;
  }
}

await main();

