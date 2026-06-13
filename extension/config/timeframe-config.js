/**
 * Timeframe Zoom Configuration
 * Baseline: Max Zoom In
 */
export const TIMEFRAME_ZOOM_CONFIG = {
  "1MO": { zoom: "max" },
  "1W": { zoom: "max" },
  "1D": { zoom: "wide" },
  "4H": { zoom: "medium" },
  "1H": { zoom: "medium" },
  "15m": { zoom: "medium" },
  "5m": { zoom: "tight" },
  "1m": { zoom: "tight" }
};

export const ZOOM_LEVELS = {
  "max": 110,   // zoom out 110 times from max-in
  "wide": 70,    // zoom out 70 times from max-in
  "medium": 40,  // zoom out 40 times from max-in
  "tight": 15    // zoom out 15 times from max-in
};
