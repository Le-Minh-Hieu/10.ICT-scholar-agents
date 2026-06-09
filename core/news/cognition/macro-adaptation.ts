import type { MacroContextState } from "../macro-context.js";
import { trace } from "../trace-utils.js";

export function adaptProfile(profile: MacroContextState, reasoningResults: any[] = []) {
  // Lightweight adaptation logic for phase 3
  const priceVal = (profile as any).price_validation || { alignmentScore: 1, deviation: 0, adaptationPressure: 0 };

  // aggregate reasoning pressures
  const avgUncertainty = reasoningResults.length ? (reasoningResults.reduce((a,b)=>a+(b.uncertainty_pressure||0),0)/reasoningResults.length) : 0;
  const avgVol = reasoningResults.length ? (reasoningResults.reduce((a,b)=>a+(b.volatility_pressure||0),0)/reasoningResults.length) : 0;

  // base adaptation: combine price deviation and narrative uncertainty
  const alignmentScore = typeof priceVal.alignmentScore === 'number' ? priceVal.alignmentScore : 1;
  const deviation = typeof priceVal.deviation === 'number' ? priceVal.deviation : 0;
  const adaptationPressure = Math.min(1, (deviation * 10) + (avgUncertainty * 0.5));

  // adjust narrative confidence and regime conservatively
  const prevConfidence = profile.narrative_confidence || 0.5;
  const newConfidence = Math.max(0, Math.min(1, prevConfidence * (1 - adaptationPressure * 0.6) * alignmentScore));

  // regime shift heuristics
  const regime = profile.regime || { volatility: 'MEDIUM', liquidity: 'STABLE', macro_alignment: 'NEUTRAL' } as any;
  if (avgVol > 0.6 || deviation > 0.05) regime.volatility = 'HIGH';
  else if (avgVol > 0.25) regime.volatility = 'MEDIUM';
  else regime.volatility = 'LOW';

  // apply small bias nudges based on reasoning directional pressure
  // (PHASE 1) Directional authority must come from ForexFactory calendar bias.
  // Keep reasoning directional_pressure for diagnostics only.
  const avgDirectional = reasoningResults.length ? (reasoningResults.reduce((a,b)=>a+(b.directional_pressure||0),0)/reasoningResults.length) : 0;
  void avgDirectional;


  // record adaptation snapshot
  const snap = {
    ts: new Date().toISOString(),
    alignmentScore,
    deviation,
    adaptationPressure,
    note: `avgUncertainty=${avgUncertainty.toFixed(3)},avgVol=${avgVol.toFixed(3)}`
  };

  profile.adaptation_history = profile.adaptation_history || [];
  profile.adaptation_history.push(snap as any);

  profile.confidence_evolution = profile.confidence_evolution || [];
  profile.confidence_evolution.push({ ts: snap.ts, confidence: newConfidence, source: 'adaptation' });

  profile.narrative_confidence = newConfidence;
  profile.regime = regime;

  trace('MACRO_ADAPTATION_TRACE', 'Adaptation applied', { week: profile.week_start, adaptationPressure, alignmentScore, deviation, newConfidence });

  return { adaptationPressure, alignmentScore, deviation };
}

export default adaptProfile;
