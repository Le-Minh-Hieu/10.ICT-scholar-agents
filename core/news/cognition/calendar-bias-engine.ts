import type { MacroReleaseEvent } from "../../../types/macro.js";

export type BiasDirection = "bullish" | "bearish" | "neutral";

export type ScoreBucket = "INFLATION" | "LABOR" | "GROWTH" | "RATES" | "NONE";

export type CalendarBucket = ScoreBucket;

export type CalendarBiasTaxonomyOutput = {
  source: "calendar";
  bucket_scores: Record<Exclude<ScoreBucket, "NONE">, number>;
  currency_scores: Array<{
    currency: string;
    bucket_scores: Record<Exclude<ScoreBucket, "NONE">, number>;
    confidence: number;
  }>;
  weekly_bias: BiasDirection;
  confidence: number;
};

function safeNumber(n: unknown): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (n === null || n === undefined) return null;
  const asStr = String(n).trim();
  if (!asStr) return null;
  const num = Number(asStr);
  return Number.isFinite(num) ? num : null;
}

function computeInflationDelta(e: MacroReleaseEvent): number {
  // Higher_is_bullish for inflation is inverted for your specific deterministic rule:
  // forecast < previous => +1
  // forecast > previous => -1
  const f = safeNumber(e.forecast);
  const p = safeNumber(e.previous);
  if (f === null || p === null) return 0;
  if (f < p) return +1;
  if (f > p) return -1;
  return 0;
}

function computeLaborDelta(e: MacroReleaseEvent): number {
  const f = safeNumber(e.forecast);
  const p = safeNumber(e.previous);
  if (f === null || p === null) return 0;
  if (f > p) return +1;
  if (f < p) return -1;
  return 0;
}

function computeLaborEmploymentDelta(e: MacroReleaseEvent): number {
  // Same deterministic rule as LABOR
  return computeLaborDelta(e);
}

function computeGrowthDelta(e: MacroReleaseEvent): number {
  const f = safeNumber(e.forecast);
  const p = safeNumber(e.previous);
  if (f === null || p === null) return 0;
  if (f > p) return +1;
  if (f < p) return -1;
  return 0;
}

export function calendarBiasEngine(events: MacroReleaseEvent[]): CalendarBiasTaxonomyOutput {
  const bucketScoreInit: Record<Exclude<ScoreBucket, "NONE">, number> = {
    INFLATION: 0,
    LABOR: 0,
    GROWTH: 0,
    RATES: 0
  };

  const bucketScores: Record<Exclude<ScoreBucket, "NONE">, number> = { ...bucketScoreInit };

  // Currency split
  const byCurrency = new Map<
    string,
    Record<Exclude<ScoreBucket, "NONE">, number>
  >();

  const currencyConfidenceCount = new Map<string, number>();

  let totalComparableEvents = 0;
  let totalNonIgnoredComparableEvents = 0;

  for (const e of events || []) {
    const cat = String(e.category || "").toUpperCase();

    // Ignore speeches/holidays/commodities based on your instruction.
    // Current FF ingestion category is coarse: CPI/LABOR/GDP/RATES/OTHER.
    // We treat anything not mapped to INFLATION/LABOR/GROWTH/RATES as ignored.
    // Additionally, if title implies speech/holiday/commodity, we ignore.
    const title = String((e as any).name || (e as any).event || "").toLowerCase();
    if (cat === "OTHER") {
      // We still score only if taxonomy can infer one of the buckets.
      // Deterministic: keep your engine strict; if OTHER, ignore.
      continue;
    }

    // If it looks like speech/holiday/commodity, ignore even if category is something.
    if (title.includes("speaks") || title.includes("speech") || title.includes("fomc") || title.includes("member")) {
      continue;
    }
    if (title.includes("holiday")) {
      continue;
    }
    if (title.includes("oil") || title.includes("gas") || title.includes("inventories") || title.includes("storage") || title.includes("crude")) {
      continue;
    }
    if (title.includes("commodity") || title.includes("natural gas") || title.includes("crude oil")) {
      continue;
    }

    const currency = String(e.currency || "GLOBAL").toUpperCase();

    if (!byCurrency.has(currency)) {
      byCurrency.set(currency, { ...bucketScoreInit });
      currencyConfidenceCount.set(currency, 0);
    }

    const f = safeNumber(e.forecast);
    const p = safeNumber(e.previous);

    if (f === null || p === null) {
      totalComparableEvents += 1;
      continue;
    }

    totalNonIgnoredComparableEvents += 1;
    const delta = (() => {
      if (cat === "CPI") return computeInflationDelta(e);
      if (cat === "LABOR") return computeLaborEmploymentDelta(e);
      if (cat === "GDP") return computeGrowthDelta(e);
      if (cat === "RATES") {
        // Spec says ignore speeches/holidays/commodities, but includes RATES bucket.
        // Deterministic rule not provided for RATES; keep 0 (unscored) to avoid fabricating.
        return 0;
      }
      return 0;
    })();

    if (delta !== 0) {
      // increment by inferred bucket
      if (cat === "CPI") bucketScores.INFLATION += delta;
      else if (cat === "LABOR") bucketScores.LABOR += delta;
      else if (cat === "GDP") bucketScores.GROWTH += delta;
      // RATES bucket intentionally not scored by sign rules (delta=0)
    }

    // Also add to currency bucket scores
    const curAgg = byCurrency.get(currency)!;
    if (cat === "CPI") curAgg.INFLATION += delta;
    else if (cat === "LABOR") curAgg.LABOR += delta;
    else if (cat === "GDP") curAgg.GROWTH += delta;

    // confidence counts how many events had usable forecast+previous
    currencyConfidenceCount.set(currency, (currencyConfidenceCount.get(currency) || 0) + 1);

    // (optional) track comparable events for overall confidence
    totalComparableEvents += 1;
  }

  const scoreSum =
    bucketScores.INFLATION + bucketScores.LABOR + bucketScores.GROWTH + bucketScores.RATES;

  let weekly_bias: BiasDirection = "neutral";
  if (scoreSum > 0) weekly_bias = "bullish";
  else if (scoreSum < 0) weekly_bias = "bearish";

  // Confidence is proportional to number of comparable events; clamp 0..1
  const confidence = Math.max(
    0,
    Math.min(1, totalNonIgnoredComparableEvents / 20)
  );

  const currency_scores = Array.from(byCurrency.entries())
    .map(([currency, bScores]) => {
      const cCount = currencyConfidenceCount.get(currency) || 0;
      const cConfidence = Math.max(0, Math.min(1, cCount / 10));
      return {
        currency,
        bucket_scores: bScores,
        confidence: cConfidence
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  return {
    source: "calendar",
    bucket_scores: bucketScores,
    currency_scores,
    weekly_bias,
    confidence
  };
}

export default calendarBiasEngine;

