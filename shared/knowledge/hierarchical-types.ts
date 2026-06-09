import { Confidence } from "../contracts/pmso";

export type Timeframe = "MONTHLY" | "WEEKLY" | "DAILY" | "H4" | "H1" | "M15" | "M5" | "M1";

export type ProbabilisticBias = 
  | "suggests_bullish" 
  | "suggests_bearish" 
  | "suggests_neutral"
  | "evidence_for_reversal"
  | "evidence_for_retracement"
  | "unknown";

export interface TimeframeThesis {
  timeframe: Timeframe;
  bias: ProbabilisticBias;
  confidence: Confidence; // 0.0 to 1.0
  key_anchors: string[]; // e.g., ["Weekly FVG", "Old Daily High"]
  summary: string; // Probabilistic 2-3 sentence summary
  supporting_chunks: string[]; // Array of chunk_ids
  opposing_evidence?: string; // Notes on what contradicts this thesis
  shift_conditions?: string; // What would invalidate this thesis?
}

import { RelationalContext } from "./relational-types";

import { ScenarioMemory } from "./scenario-types.js";

export interface HierarchicalMemory {
  theses: Partial<Record<Timeframe, TimeframeThesis>>;
  active_context?: Timeframe; // The timeframe currently being analyzed
  parent_anchor?: Timeframe; // The higher timeframe providing the context
  relational?: RelationalContext; // Cross-asset and intermarket context
  scenarios?: ScenarioMemory; // Phase 7: Probabilistic scenario branching
}

export interface AlignmentResolution {
  state: "ALIGNED" | "RETRACEMENT" | "CONTRADICTION" | "SHIFT_IN_PROGRESS";
  dominant_timeframe: Timeframe;
  resolution_notes: string;
}
