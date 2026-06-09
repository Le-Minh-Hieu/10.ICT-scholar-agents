import fs from "fs/promises";
import path from "path";
import { log } from "../../shared/utils/logger.js";

export type Regime = {
  volatility: "LOW" | "MEDIUM" | "HIGH";
  liquidity: "STABLE" | "UNSTABLE" | "CONSTRAINED";
  macro_alignment: "BULLISH" | "BEARISH" | "NEUTRAL";
};

export type RetrievalContext = {
  expandedQueries: string[];
  top_chunks?: string[];
};

export type NarrativeSnapshot = {
  ts: string;
  narrative: string;
  confidence: number;
};

export type AdaptationSnapshot = {
  ts: string;
  alignmentScore: number;
  deviation: number;
  adaptationPressure: number;
  note?: string;
};

export type ConfidenceSnapshot = { ts: string; confidence: number; source?: string };

export type MarketTemporalSemantics = {
  market_timezone?: string;
  market_date?: string;
  market_weekday?: string;
  market_time_hhmm?: string;
  session_tags?: string[];
  killzone_tags?: string[];
};

export type MacroIRE = {
  avg_uncertainty: number;
  avg_volatility: number;

  execution_risk:
  | "LOW"
  | "MEDIUM"
  | "HIGH";

  liquidity_condition:
  | "STABLE"
  | "UNSTABLE";

  confidence_modifier?: number;
};

export type MacroContextState = {
  week_start: string; // ISO
  week_type: string; // e.g. CPI, NFP, FOMC, GENERIC
  primary_drivers: string[]; // e.g. ['CPI','NFP']
  volatility_expectation: "LOW" | "MEDIUM" | "HIGH";
  delivery_model: string; // e.g. 'shocky' | 'gradual' | 'mixed'
  macro_bias: "bullish" | "bearish" | "neutral";
  narrative_confidence: number; // 0..1

  active_events: Array<{ id: string; title?: string; scheduled_time?: string; impact?: string } & MarketTemporalSemantics>;
  upcoming_events: Array<{ id: string; title?: string; scheduled_time?: string; impact?: string } & MarketTemporalSemantics>;

  retrieval_context: RetrievalContext;
  retrieval_queries?: string[];

  macro_themes?: Array<{
    theme: string;
    confidence: number;
    supporting_events?: string[];
  }>;
  dominant_theme?: string;
  dominant_narrative?: string;
  macro_timeline?: Array<{
    date: string;
    catalyst: string;
    expected_effect: string;
    confidence?: number;
  } & MarketTemporalSemantics>;
  weekly_delivery_model?: {
    model?: string;
    expected_weekly_high_day?: string;
    expected_weekly_low_day?: string;
    expected_expansion_day?: string;
    expected_distribution_day?: string;
    weekly_path?: Record<string, string>;
    confidence?: number;
  };
  weekly_story_arc?: Array<{
    day: string;
    role: string;
    confidence?: number;
    supporting_events?: string[];
    market_timezone?: string;
  }>;

  daily_delivery_model?: {
    expected_day_type?: string;
    expected_hod_session?: string;
    expected_lod_session?: string;
    expected_liquidity_sequence?: string[];
    confidence?: number;
  };

  intraday_expectations?: {
    current_session_bias?: string;
    expected_next_liquidity_target?: string;
    expected_displacement_window?: string[];
    expected_reversal_window?: string[];
    execution_risk?: string;
    confidence_modifier?: number;
  };
  narrative_state: string;
  narrative_scope?: "weekly_dominant" | "runtime_active";
  narrative_as_of?: string;
  narrative_event_category?: string;

  regime: Regime;

  macro_ire?: MacroIRE;

  narrative_history: NarrativeSnapshot[];
  adaptation_history?: AdaptationSnapshot[];
  confidence_evolution?: ConfidenceSnapshot[];
  price_validation?: {
    last_checked: string;
    alignmentScore: number;
    deviation: number;
    adaptationPressure: number;
    aligned: boolean;
  };

  calendar_bias?: {
    source: string;

    bucket_scores: {
      INFLATION: number;
      LABOR: number;
      GROWTH: number;
      RATES: number;
    };

    currency_scores: Array<{
      currency: string;

      bucket_scores: {
        INFLATION: number;
        LABOR: number;
        GROWTH: number;
        RATES: number;
      };

      confidence: number;
    }>;

    weekly_bias:
    | "bullish"
    | "bearish"
    | "neutral";

    confidence: number;
  };
  version?: number;
  updated_at?: string;
};

const STORE_DIR = path.join(process.cwd(), "data", "calendar_cache", "macro_profiles");

export class MacroContextStore {
  static async ensureDir() {
    try {
      await fs.mkdir(STORE_DIR, { recursive: true });
    } catch (e) {
      // ignore
    }
  }

  static fileForWeek(weekStartIso: string) {
    return path.join(STORE_DIR, `${encodeURIComponent(weekStartIso)}.json`);
  }

  static async save(state: MacroContextState) {
    await this.ensureDir();
    state.updated_at = new Date().toISOString();
    state.version = (state.version || 0) + 1;
    const file = this.fileForWeek(state.week_start);
    await fs.writeFile(file, JSON.stringify(state, null, 2), "utf8");
    log({ stage: 'MACRO_PROFILE_SAVED', message: 'Saved macro profile', data: { week: state.week_start, file } });
    return file;
  }

  static async load(weekStartIso: string): Promise<MacroContextState | null> {
    try {
      const file = this.fileForWeek(weekStartIso);
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as MacroContextState;
      log({ stage: 'MACRO_PROFILE_LOADED', message: 'Loaded macro profile', data: { week: weekStartIso } });
      return parsed;
    } catch (err) {
      log({ stage: 'MACRO_PROFILE_LOAD_FAIL', message: 'Failed loading macro profile', data: { week: weekStartIso, error: String(err) } });
      return null;
    }
  }

  static async listProfiles(): Promise<string[]> {
    await this.ensureDir();
    try {
      const entries = await fs.readdir(STORE_DIR);
      const weeks = entries.filter((n) => n.endsWith('.json')).map((n) => decodeURIComponent(n.replace(/\.json$/, '')));
      return weeks;
    } catch (err) {
      return [];
    }
  }
}

export default MacroContextStore;
