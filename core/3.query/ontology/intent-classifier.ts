export enum QueryIntent {
  CONCEPT = "CONCEPT",
  TIME = "TIME",
  SESSION = "SESSION",
  EXECUTION = "EXECUTION",
  BIAS = "BIAS",
  GENERIC = "GENERIC"
}

export interface IntentResult {
  intent: QueryIntent;
  confidence: number;
}

const INTENT_PATTERNS = {
  [QueryIntent.TIME]: [
    "time", "clock", "am", "pm", "noon", "hour", "window", "silver bullet", "macro", "killzone", "10am", "11am", "2pm"
  ],
  [QueryIntent.SESSION]: [
    "london", "new york", "asia", "session", "ny am", "ny pm", "overnight", "rth"
  ],
  [QueryIntent.BIAS]: [
    "bias", "bullish", "bearish", "direction", "draw on liquidity", "dol", "higher time frame", "htf"
  ],
  [QueryIntent.EXECUTION]: [
    "entry", "exit", "stop loss", "sl", "take profit", "tp", "execution", "order", "fill", "long", "short", "trade"
  ],
  [QueryIntent.CONCEPT]: [
    "fvg", "fair value gap", "order block", "ob", "breaker", "mitigation", "mss", "bms", "liquidity sweep", "raid", "ote"
  ]
};

export function classifyIntent(query: string): IntentResult {
  const normalized = query.toLowerCase();
  const scores = new Map<QueryIntent, number>();

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      if (normalized.includes(pattern)) {
        score += 1;
      }
    }
    if (score > 0) {
      scores.set(intent as QueryIntent, score);
    }
  }

  if (scores.size === 0) {
    return { intent: QueryIntent.GENERIC, confidence: 1.0 };
  }

  // Find intent with highest score
  let bestIntent = QueryIntent.GENERIC;
  let maxScore = 0;

  for (const [intent, score] of scores.entries()) {
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent;
    }
  }

  return { 
    intent: bestIntent, 
    confidence: Math.min(maxScore * 0.25, 1.0) 
  };
}
