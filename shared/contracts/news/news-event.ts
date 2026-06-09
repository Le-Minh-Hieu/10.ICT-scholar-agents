export type NewsCategory =
  | "CPI"
  | "PPI"
  | "NFP"
  | "FOMC"
  | "ECB"
  | "BOJ"
  | "RATE_DECISION"
  | "CENTRAL_BANK_SPEECH"
  | "YIELDS_SHOCK"
  | "RISK_OFF"
  | "BANKING_STRESS"
  | "GEOPOLITICAL"
  | "OPTIONS_EXPIRY"
  | "OPEX"
  | "PMI"
  | "GDP"
  | "UNEMPLOYMENT";

export type NewsImportance = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type VolatilityClass =
  | "COMPRESSIVE"
  | "EXPANSIONARY"
  | "CHAOTIC";

export type PersistenceClass = "SHORT" | "MEDIUM" | "LONG" | "REGIME";

export type RepricingDirection =
  | "USD_BULLISH"
  | "USD_BEARISH"
  | "RISK_ON"
  | "RISK_OFF"
  | "NEUTRAL";

export type NewsEvent = {
  id: string;
  timestamp: number;

  title: string;
  source: string;

  category: NewsCategory;

  importance: NewsImportance;
  currencies_affected: string[];

  volatility_class: VolatilityClass;
  persistence: PersistenceClass;
  repricing_direction: RepricingDirection;

  surprise_score?: number;
  confidence: number;
};
