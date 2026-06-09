import { Timeframe } from "./hierarchical-types";

export type StructureStatus =
  | 'DISCOVERED'
  | 'ACTIVE'
  | 'TAPPED'
  | 'MITIGATED'
  | 'INVALIDATED';

export interface PriceBounds {
  high: number;
  low: number;
  mid?: number; // e.g., Consequent Encroachment (C.E.)
}

export interface ActiveStructure {
  id: string;
  type: string; // e.g., "fvg", "ob", "breaker", "sweep"
  status: StructureStatus;
  timeframe: Timeframe;
  anchor: string; // e.g., "Daily Low FVG"
  confidence: number; // 0.0 to 1.0

  price_bounds?: PriceBounds;

  mitigation_level: number; // 0.0 to 1.0 (how much has been filled/tapped)

  first_seen_at: string; // capture_id
  last_validated_at: string; // capture_id

  decay_score: number; // Penalty applied over time

  metadata: {
    strength: number;
    volume_confluence?: boolean;
    is_htf_aligned?: boolean;
    invalidated_at?: string;
  };
}

export interface TemporalState {
  structures: ActiveStructure[];
  narrative_continuity: string;
  session_id: string;
  last_updated: string;
  capture_count: number;
  invalidation_summary?: {
    total_invalidations: number;
    last_invalidated_at: string | null;
  };
  regime_state?: "STABLE" | "TRANSITIONAL" | "CHAOTIC";
  last_reconciled_capture_id?: string;
}
