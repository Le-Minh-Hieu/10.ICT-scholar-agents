export interface Concept {
  canonical: string;
  confidence: number;
  surface_terms: string[];
  narrative_roles?: string[];
}

export interface MasterRegistryEntry {
  canonical: string;
  surface_terms: string[];
  description?: string;
  version: string;
  last_updated: string;
  audit_log: AuditEntry[];
}

export interface AuditEntry {
  timestamp: string;
  action: "CREATED" | "ALIAS_ADDED" | "MERGED" | "DEPRECATED" | "PROMOTED";
  details: string;
  author: string;
}

export interface CandidateRegistry {
  candidates: CandidateEntry[];
  last_generated: string;
}

export interface CandidateEntry {
  id: string;
  type: "NEW_ALIAS" | "NEW_CONCEPT" | "POTENTIAL_MERGE";
  source_canonical?: string;
  target_canonical: string;
  suggested_surface_terms: string[];
  confidence: number;
  reasoning: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  eval_delta?: {
    precision_impact: number;
    ndcg_impact: number;
  };
}

export const FORBIDDEN_MERGES: [string, string][] = [
  ["BREAKER_BLOCK", "MITIGATION_BLOCK"],
  ["MARKET_STRUCTURE_SHIFT", "CHANGE_OF_CHARACTER"],
  ["LIQUIDITY_SWEEP", "DISPLACEMENT"],
  ["FAIR_VALUE_GAP", "LIQUIDITY_VOID"],
  ["BULLISH_ORDER_BLOCK", "BEARISH_ORDER_BLOCK"],
  ["REJECTION_BLOCK", "ORDER_BLOCK"]
];

export type NarrativeState = 
  | "ACCUMULATION" 
  | "MANIPULATION" 
  | "EXPANSION" 
  | "REBALANCE" 
  | "CONTINUATION" 
  | "REVERSAL"
  | "CONSOLIDATION"
  | "INTERMARKET_DIVERGENCE"
  | "SMT_HINT";

export interface ProbabilisticLink {
  target_chunk_id: string;
  type: "TEMPORAL_NEXT" | "TEMPORAL_PREV" | "NARRATIVE_SUCCESSOR" | "NARRATIVE_PREDECESSOR" | "SESSION_CONTINUATION";
  confidence: number;
}

import { Timeframe } from "./hierarchical-types";

export interface ChunkAnnotation {
  chunk_id: string;
  concepts: Concept[];
  session_tags: string[];
  temporal_tags: string[];
  timeframe?: Timeframe; // Explicit timeframe for hierarchical memory
  hierarchy_role?: "ANCHOR" | "SIGNAL" | "REVERSAL" | "CONTINUATION";
  source_context: {
    section_title: string;
    source_file: string;
    session?: string; // e.g., "LONDON", "NY_AM"
    chunk_index: number;
  };
  narrative_metadata?: {
    state?: { value: NarrativeState; confidence: number };
    links: ProbabilisticLink[];
    flow?: {
      direction: "BULLISH" | "BEARISH" | "NEUTRAL";
      intensity: number; // 0.0 to 1.0
    };
  };
}
