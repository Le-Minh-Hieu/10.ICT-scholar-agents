export interface TimeOrchestratorOutput {
  trading_window: "active" | "inactive";
  narrative: string;
  [key: string]: any;
}

export interface HTFOrchestratorOutput {
  htf_bias: "bullish" | "bearish" | "neutral";
  [key: string]: any;
}

export interface ITFOrchestratorOutput {
  itf_bias: "bullish" | "bearish" | "neutral";
  [key: string]: any;
}

export interface LTFOrchestratorOutput {
  execute: boolean;
  [key: string]: any;
}

export interface SystemResult {
  execute: boolean;
  state: "NO_TRADE" | "WAIT_FOR_ENTRY" | "READY";
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  score: number;
  entry_zone: string;
  notes: string;
  reasoning: string;
  entry: string;
  layers: {
    time: TimeOrchestratorOutput | null;
    htf: HTFOrchestratorOutput | null;
    itf: ITFOrchestratorOutput | null;
    ltf: LTFOrchestratorOutput | null;
    master: any | null;
    confluence: any | null;
  };
  debug?: any;
  _raw?: any;
  _pmso?: any;
}

export interface StandardPersistWrapper<T = any> {
  status: "SUCCESS" | "FAIL" | "NO_DATA";
  data: T;
  error: string | null;
  meta: {
    agent: string;
    timestamp: string;
    input_summary: any;
    missing_tfs: string[];
  };
}
