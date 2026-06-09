import type { MacroContextState } from "../macro-context.js";
import { log } from "../../../shared/utils/logger.js";
import { trace } from "../trace-utils.js";

export function validatePrice(profile: MacroContextState, priceSnapshot?: { symbol?: string; price?: number; reference?: number }) {
  // Simple alignment scoring for phase 1: compare reference vs price
  const ref = priceSnapshot?.reference;
  const price = priceSnapshot?.price;
  let deviation = 0;
  let aligned = true;
  if (typeof ref === 'number' && typeof price === 'number') {
    deviation = Math.abs(price - ref) / Math.max(1, Math.abs(ref));
    // if deviation > 1% consider misaligned for phase1
    aligned = deviation < 0.01;
  }

  const alignmentScore = aligned ? 1 - Math.min(0.5, deviation) : Math.max(0, 1 - Math.min(1, deviation * 5));

  const adaptationPressure = Math.min(1, deviation * 50); // coarse mapping

  const out = { alignmentScore, deviation, adaptationPressure, aligned };

  profile.price_validation = {
    last_checked: new Date().toISOString(),
    ...out
  };

  trace('MACRO_VALIDATION_TRACE', 'Price validation applied', { week: profile.week_start, ...out });

  return out;
}

export default validatePrice;
