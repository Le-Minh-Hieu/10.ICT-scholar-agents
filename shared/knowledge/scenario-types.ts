
import { Timeframe } from "./hierarchical-types.js";

export type ScenarioType = 
  | "CONTINUATION" 
  | "REVERSAL" 
  | "RETRACEMENT" 
  | "LIQUIDITY_SWEEP"
  | "FAILED_DISPLACEMENT"
  | "UNKNOWN";

export interface MarketScenario {
  id: string;
  name: string;
  type: ScenarioType;
  plausibility: number; // 0.0 to 1.0
  confidence: number;  // 0.0 to 1.0, weighted by evidence
  temporal_decay: number; // Current decay multiplier (e.g., 1.0, 0.5, 0.25)
  
  description: string;
  narrative_continuation: string; // "If this plays out, we expect..."
  
  supporting_evidence: string[]; // chunk_ids
  contradicting_evidence: string[]; // chunk_ids
  
  supporting_anchors: string[]; // e.g., ["Weekly FVG", "Daily OB"]
  contradicting_anchors: string[];
  
  invalidated_by: string[]; // Conditions that kill this scenario
  
  metadata: {
    created_at_capture: string;
    last_updated_capture: string;
    birth_timeframe: Timeframe;
  };
}

export interface ScenarioMemory {
  active_scenarios: MarketScenario[];
  archived_scenarios: MarketScenario[];
  uncertainty_notes: string;
  telemetry?: any;
}

