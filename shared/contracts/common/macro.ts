// Canonical contract: MacroReleaseEvent + MacroCalendarState
// NOTE: This file is moved-only from types/macro.ts

export interface MacroReleaseEvent {
  id: string;
  native_id?: string | null;
  name: string;
  category?: string;
  currency: string;
  impact?: 'HIGH' | 'MEDIUM' | 'LOW';
  impact_score?: number | null;
  timezone?: string;
  scheduled_time: string; // ISO8601
  forecast?: number | null;
  previous?: number | null;
  actual?: number | null;
  lifecycle_phase?: 'PRE_EVENT' | 'POST_EVENT' | 'COOLDOWN';
  window_boundaries?: {
    pre_start?: string | null;
    pre_end?: string | null;
    post_start?: string | null;
    post_end?: string | null;
    cooldown_end?: string | null;
  };
  volatility_risk?: number;
  confidence?: number | null;
  provenance?: { source?: string; payload_hash?: string };
  affected_assets?: string[];
  execution_confidence?: number | null;
}

export interface MacroCalendarState {
  week_start: string;
  week_end: string;
  last_updated: string;
  source: string;
  refresh_hours?: number;
  events: MacroReleaseEvent[];
  version?: string;
}

