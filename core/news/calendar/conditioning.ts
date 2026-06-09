import { MacroReleaseEvent } from "../../../types/macro";

export function computeExecutionConfidence(ev: MacroReleaseEvent, now = new Date(), clusterSize = 1): number {
  // base confidence from impact_score or impact mapping
  let base = 0.5;
  if (typeof ev.impact_score === 'number') base = Math.max(0, Math.min(1, ev.impact_score));
  else if (ev.impact === 'HIGH') base = 0.2;
  else if (ev.impact === 'MEDIUM') base = 0.5;
  else base = 0.85;

  // lifecycle modifier
  const phase = ev.lifecycle_phase ?? (() => {
    // naive phase guess based on scheduled_time
    const scheduled = ev.scheduled_time ? new Date(ev.scheduled_time) : null;
    if (!scheduled) return 'PRE_EVENT';
    if (now < scheduled) return 'PRE_EVENT';
    return 'POST_EVENT';
  })();

  let phaseMul = 1.0;
  if (phase === 'PRE_EVENT') phaseMul = 0.6;
  else if (phase === 'POST_EVENT') phaseMul = 0.9;
  else if (phase === 'COOLDOWN') phaseMul = 0.3;

  // volatility risk adjustment
  const vol = typeof ev.volatility_risk === 'number' ? ev.volatility_risk : (ev.impact_score ?? base);
  const volMul = 0.5 + 0.5 * Math.min(1, vol);

  // clustering penalty
  const clusterMul = clusterSize > 1 ? Math.max(0.2, 1 - 0.15 * (clusterSize - 1)) : 1;

  const conf = Math.max(0, Math.min(1, base * phaseMul * volMul * clusterMul));
  return conf;
}
