/**
 * Symbol Groups Configuration
 */
import { TIMEFRAME_SETS } from './timeframe-sets.js';

export const SYMBOL_GROUPS = {
  primary: {
    symbols: ["EURUSD", "GBPUSD"],
    timeframes: TIMEFRAME_SETS.FULL
  },
  htf_smt: {
    symbols: [],
    timeframes: TIMEFRAME_SETS.HTF_SMT
  },
  macro: {
    symbols: ["DXY", "US10Y", "US20Y"],
    timeframes: TIMEFRAME_SETS.HTF_ONLY
  }
};
