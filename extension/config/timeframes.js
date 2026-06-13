/**
 * Timeframe Configuration
 * Maps display name to TradingView URL interval parameter
 */
const TIMEFRAMES = [
  { name: "1MO", interval: "M" },
  { name: "1W", interval: "W" },
  { name: "1D", interval: "D" },
  { name: "4H", interval: "240" },
  { name: "1H", interval: "60" },
  { name: "15m", interval: "15" },
  { name: "5m", interval: "5" },
  { name: "1m", interval: "1" }
];

export default TIMEFRAMES;
