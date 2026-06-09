export interface MasterOutput {
  decision: {
    execute: boolean;
    state: "NO_TRADE" | "WAIT_FOR_ENTRY" | "READY";
    direction: "bullish" | "bearish" | "neutral";
    confidence: "high" | "medium" | "low";
    score: number;
    entry_zone: string;
    notes: string;
    target?: string;
    stop_loss?: string;
  };
  layers: {
    time: {
      session: string;
      timing_bias: string;
      notes: string;
    };
    htf: {
      bias: string;
      state: string;
      tradable: boolean;
      pdArray: string;
      equilibrium: number;
      range_high: number;
      range_low: number;
      notes: string;
    };
    itf: {
      direction: string;
      valid: boolean;
      notes: string;
    };
    ltf: {
      direction: string;
      execute: boolean;
      entry: string;
      notes: string;
    };
    confluence: {
      confirmed: boolean;
      strength: number;
      notes: string;
    };
  };
  metadata: {
    query: string;
    timestamp: string;
    processing_time_ms: number;
    intent?: {
      direction: "long" | "short" | "neutral";
      asset?: string;
    };
  };
  vision?: {
    enabled: boolean;
    analysis?: string;
  };
}
