import fs from "fs/promises";
import path from "path";
import { log } from "../../shared/utils/logger.js";
import type { MacroContextState, MarketTemporalSemantics } from "./macro-context.js";

export type DailyQueryFamily =
  | "WEEKLY_ROLE"
  | "CATALYST"
  | "KILLZONE"
  | "SEQUENCING"
  | "CONTRADICTION";

export type DailyQueryCandidate = {
  family: DailyQueryFamily;
  query: string;
  rank: number;
  rationale: string;
};

export type DailyBridgeCatalyst = {
  event_id: string;
  title: string;
  category?: string;
  impact?: string;
  scheduled_time_utc: string;
  expected_effect?: string;
} & MarketTemporalSemantics;

export type DailyBridgeContext = {
  profile_date_utc: string;
  market_date: string;
  market_weekday: string;
  market_timezone: string;
  week_start: string;
  week_type: string;
  dominant_theme?: string;
  dominant_narrative?: string;
  weekly_delivery_model?: MacroContextState["weekly_delivery_model"];
  calendar_bias?: MacroContextState["calendar_bias"];
  daily_bias?: {
    daily_bias: "bullish" | "bearish" | "neutral";
    confidence: number;
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
    source: "calendar";
  };
  today_role?: {

    day: string;
    role: string;
    confidence?: number;
  } | null;
  today_catalysts: DailyBridgeCatalyst[];
  previous_catalyst?: DailyBridgeCatalyst | null;
  next_catalyst?: DailyBridgeCatalyst | null;
  retrieval_intents: string[];
  query_candidates: DailyQueryCandidate[];
  timeline_context: Array<{
    catalyst: string;
    date: string;
    expected_effect?: string;
  } & MarketTemporalSemantics>;
};

export type DailyRetrievedConcept = {
  concept: string;
  chunk_id: string;
  relevance: number;
};

export type DailyContextProfile = {
  profile_date_utc: string;
  market_date: string;
  market_weekday: string;
  market_timezone: string;
  week_start_market_date: string;
  source_week_profile_id: string;
  day_type: string;
  day_confidence: number;
  day_role_in_week: string;
  weekly_alignment_state: "ALIGNED" | "TENSION" | "INVALIDATION_RISK" | "INSUFFICIENT_EVIDENCE";
  dominant_weekly_theme: string;
  dominant_weekly_narrative: string;
  weekly_delivery_model: string;
  expected_weekly_high_day?: string | null;
  expected_weekly_low_day?: string | null;
  expected_expansion_day?: string | null;
  expected_distribution_day?: string | null;
  calendar_bias?: MacroContextState["calendar_bias"];
  daily_bias?: {
    daily_bias: "bullish" | "bearish" | "neutral";
    confidence: number;
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
    source: "calendar";
  };
  todays_catalysts: Array<DailyBridgeCatalyst & {

    catalyst_role: string;
    confidence: number;
  }>;
  liquidity_expectations: {
    expected_conditions: string[];
    expected_liquidity_sequence: string[];
    high_attention_windows: string[];
    expected_displacement_windows: string[];
    expected_reversal_windows: string[];
  };
  retrieval_context: {
    retrieval_intents: string[];
    queries: string[];
    retrieved_chunk_ids: string[];
    supporting_concepts: DailyRetrievedConcept[];
  };
  narrative_assessment: {
    daily_thesis: string;
    key_if_then_paths: string[];
    invalidation_conditions: string[];
  };
  intraday_awareness: {
    session_focus: string[];
    catalyst_priorities: string[];
    caution_flags: string[];
    execution_risk_context: string;
  };
  bridge_metadata: {
    generated_at_utc: string;
    generated_from_weekly_fields: string[];
    timezone_policy: string;
  };
  version?: number;
  updated_at?: string;
};

const STORE_DIR = path.join(process.cwd(), "data", "calendar_cache", "daily_profiles");

export class DailyContextStore {
  static async ensureDir() {
    try {
      await fs.mkdir(STORE_DIR, { recursive: true });
    } catch {
      // ignore
    }
  }

  static fileForMarketDate(marketDate: string) {
    return path.join(STORE_DIR, `${encodeURIComponent(marketDate)}.json`);
  }

  static async save(profile: DailyContextProfile) {
    await this.ensureDir();
    profile.updated_at = new Date().toISOString();
    profile.version = (profile.version || 0) + 1;
    const file = this.fileForMarketDate(profile.market_date);
    await fs.writeFile(file, JSON.stringify(profile, null, 2), "utf8");
    log({ stage: "DAILY_PROFILE_SAVED", message: "Saved daily context profile", data: { market_date: profile.market_date, file } });
    return file;
  }

  static async load(marketDate: string): Promise<DailyContextProfile | null> {
    try {
      const raw = await fs.readFile(this.fileForMarketDate(marketDate), "utf8");
      return JSON.parse(raw) as DailyContextProfile;
    } catch (err) {
      log({ stage: "DAILY_PROFILE_LOAD_FAIL", message: "Failed loading daily profile", data: { marketDate, error: String(err) } });
      return null;
    }
  }

  static async listProfiles(): Promise<string[]> {
    await this.ensureDir();
    try {
      const entries = await fs.readdir(STORE_DIR);
      return entries.filter((n) => n.endsWith(".json")).map((n) => decodeURIComponent(n.replace(/\.json$/, "")));
    } catch {
      return [];
    }
  }

  static async getLatestProfile(): Promise<DailyContextProfile | null> {
    const dates = await this.listProfiles();
    if (!dates.length) return null;
    const latest = dates.slice().sort().slice(-1)[0];
    return this.load(latest);
  }
}

export default DailyContextStore;
