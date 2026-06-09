import type { MacroContextState } from "../macro-context.js";
import { log } from "../../../shared/utils/logger.js";
import { trace } from "../trace-utils.js";

export function synthesizeNarrative(
  profile: MacroContextState,
  retrievalResult: { queries: string[]; rag: any },
  reasoningResults: any[] = []
): MacroContextState {
  // Lightweight heuristics to produce narrative and regime in phase 1
  const avgUncertainty = reasoningResults.length ? (reasoningResults.reduce((a, b) => a + (b.uncertainty_pressure || 0), 0) / reasoningResults.length) : 0;
  const avgVol = reasoningResults.length ? (reasoningResults.reduce((a, b) => a + (b.volatility_pressure || 0), 0) / reasoningResults.length) : 0;

  // let directionalScore = 0;

  // for (const rr of reasoningResults) {
  //   directionalScore += Number(rr.directional_pressure || 0);
  // }

  const directionalScore =
    reasoningResults.length
      ? reasoningResults.reduce(
        (a, b) => a + Number(b.directional_pressure || 0),
        0
      ) / reasoningResults.length
      : 0;

  let macro_bias =
    profile.calendar_bias?.weekly_bias ??
    "neutral";

  const directionalStrength =
    Math.min(0.3, Math.abs(directionalScore));

  const narrative_confidence =
    Math.max(
      0,
      Math.min(
        1,
        1 - avgUncertainty * 0.9 + directionalStrength
      )
    );

  // regime mapping
  const regime = profile.regime || { volatility: 'MEDIUM', liquidity: 'STABLE', macro_alignment: 'NEUTRAL' };
  if (avgVol > 0.6) regime.volatility = 'HIGH';
  else if (avgVol > 0.25) regime.volatility = 'MEDIUM';
  else regime.volatility = 'LOW';

  if (macro_bias === "bullish")
    regime.macro_alignment = "BULLISH";

  else if (macro_bias === "bearish")
    regime.macro_alignment = "BEARISH";

  else
    regime.macro_alignment = "NEUTRAL";

  const narrative = `Week ${profile.week_start}: ${profile.week_type} — bias=${macro_bias}; expect ${regime.volatility.toLowerCase()} volatility.`;

  profile.macro_bias = macro_bias as any;
  profile.narrative_state = narrative;
  profile.narrative_scope = "weekly_dominant";
  profile.narrative_as_of = profile.week_start;
  profile.narrative_event_category = profile.week_type;
  profile.narrative_confidence = narrative_confidence as any;
  profile.regime = regime;
  profile.retrieval_context = profile.retrieval_context || { expandedQueries: retrievalResult.queries };
  // Preserve upstream retrieval scope from weekly-profile-builder; only backfill if absent.
  if (!Array.isArray(profile.retrieval_context.top_chunks) || profile.retrieval_context.top_chunks.length === 0) {
    profile.retrieval_context.top_chunks = (retrievalResult.rag?.chunks || []).slice(0, 50).map((c: any) => c.chunk_id);
  }

  profile.narrative_history = profile.narrative_history || [];
  profile.narrative_history.push({ ts: new Date().toISOString(), narrative, confidence: profile.narrative_confidence });

  trace('MACRO_REASONING_TRACE', 'Synthesized macro narrative', { week: profile.week_start, bias: profile.macro_bias, confidence: profile.narrative_confidence, regime });

  return profile;
}

export default synthesizeNarrative;
