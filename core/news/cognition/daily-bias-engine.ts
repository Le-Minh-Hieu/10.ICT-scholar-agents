import type { MacroReleaseEvent } from "../../../types/macro.js";
import {
  CalendarBiasTaxonomyOutput,
  BiasDirection,
  ScoreBucket
} from "./calendar-bias-engine.js";
import { calendarBiasEngine } from "./calendar-bias-engine.js";

export type DailyBiasEngineOutput = {
  daily_bias: BiasDirection;
  confidence: number;
  bucket_scores: Record<Exclude<ScoreBucket, "NONE">, number>;
  currency_scores: Array<{
    currency: string;
    bucket_scores: Record<Exclude<ScoreBucket, "NONE">, number>;
    confidence: number;
  }>;
  source: "calendar";
};

/**
 * Deterministic daily bias derived ONLY from today's ForexFactory calendar events.
 * Uses the same deterministic scoring rules as calendar-bias-engine.ts.
 */
export function dailyBiasEngine(todayEvents: MacroReleaseEvent[]): DailyBiasEngineOutput {
  const out: CalendarBiasTaxonomyOutput = calendarBiasEngine(todayEvents);

  return {
    daily_bias: out.weekly_bias,
    confidence: out.confidence,
    bucket_scores: out.bucket_scores,
    currency_scores: out.currency_scores,
    source: out.source as any
  };
}

export default dailyBiasEngine;

