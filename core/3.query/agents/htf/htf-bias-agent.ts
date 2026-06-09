/// <reference types="node" />
import { BaseAgentOutput } from "../../../../shared/contracts/common/base-agent";
import { HTFBiasInput, HTFBiasOutput } from "../../../../shared/contracts/htf/bias";
import type { Confidence } from "../../../../shared/contracts/pmso";
import { normalizeConfidence } from "../../../../shared/utils/confidence-utils";
export type { HTFBiasInput, HTFBiasOutput } from "../../../../shared/contracts/htf/bias";

/**
 * HTF Bias Agent - Deterministic ICT Decision Engine
 * Standardized Schema
 */
export async function htfBiasAgent(input: HTFBiasInput): Promise<HTFBiasOutput> {
  // --- STEP 1: BASE DIRECTION (HTF) ---
  // RULE: HTF bias ALWAYS comes from structure
  let htf_bias: "bullish" | "bearish" | "neutral" = "neutral";
  if (input.structure.structure_trend === "bullish") htf_bias = "bullish";
  else if (input.structure.structure_trend === "bearish") htf_bias = "bearish";

  // --- STEP 2: PD ARRAY INTERPRETATION ---
  const pd = input.pd_array.pd_array_status;
  let is_pullback = false;
  let is_continuation = false;

  if (htf_bias === "bullish") {
    if (pd === "discount") is_continuation = true;
    else if (pd === "premium") is_pullback = true;
  } else if (htf_bias === "bearish") {
    if (pd === "premium") is_continuation = true;
    else if (pd === "discount") is_pullback = true;
  }

  // --- STEP 3: LIQUIDITY & SMT INTERPRETATION ---
  const liq_above = input.liquidity.liquidity.above;
  const liq_below = input.liquidity.liquidity.below;

  const smt_bullish = input.structure.smt_signal === "bullish";
  const smt_bearish = input.structure.smt_signal === "bearish";
  const smt_exists = smt_bullish || smt_bearish;

  // SMT vs HTF conflict logic
  const smt_conflicts = (htf_bias === "bullish" && smt_bearish) || (htf_bias === "bearish" && smt_bullish);

  // --- STEP 4: STATE DETERMINATION ---
  let state: "trending" | "pullback" | "consolidation" = "trending";
  if (liq_above && liq_below) {
    state = "consolidation";
  } else if (smt_conflicts || is_pullback) {
    state = "pullback";
  } else {
    state = "trending";
  }

  // --- STEP 5: SHORT-TERM EXPECTATION ---
  // SMT NEVER overrides HTF bias, but influences short-term expectation
  let short_term_expectation: "bullish" | "bearish" | "neutral" = htf_bias;

  if (smt_exists && is_pullback) {
    short_term_expectation = smt_bullish ? "bullish" : "bearish";
  } else if (is_pullback) {
    short_term_expectation = htf_bias === "bullish" ? "bearish" : "bullish";
  } else if (htf_bias === "neutral") {
    if (liq_above && !liq_below) short_term_expectation = "bullish";
    else if (!liq_above && liq_below) short_term_expectation = "bearish";
  }

  // --- STEP 6: MACRO ALIGNMENT & CONFLICT RESOLUTION (Track B) ---
  const macro_aligns = input.macro.macro_alignment;
  const macro_direction = input.macro.macro_direction;
  const macro_conflicts = (htf_bias === "bullish" && macro_direction === "bearish") || 
                          (htf_bias === "bearish" && macro_direction === "bullish");

  let conflictInfo = undefined;
  if (macro_conflicts) {
    conflictInfo = {
      structure: htf_bias,
      macro: macro_direction,
      resolution: "structure_priority"
    };
  }

  // --- STEP 7: CONFIDENCE SCORING ---
  let score = 0;
  if (is_continuation) score += 2;
  if (macro_aligns) score += 1;
  if (input.structure.structure_strength === "strong") score += 1;
  if (smt_exists && !smt_conflicts) score += 1;

  if (macro_conflicts) score -= 1; // Penalty for macro conflict
  if (smt_conflicts) score -= 2;

  let confidence: Confidence = 0.4;
  if (score >= 3) confidence = 0.9;
  else if (score >= 1) confidence = 0.7;
  else confidence = 0.4;

  // Forced downgrade on conflict (Track B requirement)
  if (macro_conflicts) {
    if (confidence > 0.8) confidence = 0.7;
    else if (confidence > 0.6) confidence = 0.4;
  }

  // --- STEP 8: TRADABLE FLAG ---
  let tradable = true;
  if (state === "consolidation") tradable = false;
  if (confidence < 0.5) tradable = false;
  if (htf_bias === "neutral" && state !== "trending") tradable = false;

  // --- STEP 9: NOTES GENERATION ---
  const notes = `
HTF Bias: ${htf_bias}.
State: ${state}.
Short-term: ${short_term_expectation}.
Confidence: ${confidence}.
Tradable: ${tradable}.
Structure: ${input.structure.structure_trend} (${input.structure.structure_strength}).
SMT: ${input.structure.smt_signal}.
PD Array: ${pd}.
Liquidity Above: ${liq_above}, Below: ${liq_below}.
Macro Impact: ${input.macro.macro_impact}.
  `.trim();

  return {
    htf_bias,
    short_term_expectation,
    state,
    confidence,
    reasoning: notes,
    tradable,
    conflict: conflictInfo
  };
}
