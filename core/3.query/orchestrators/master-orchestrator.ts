/// <reference types="node" />

import "dotenv/config";
import { callLLM } from "../../../shared/utils/llm-utils.js";
import { log } from "../../../shared/utils/logger.js";

import { HydrationContext, HydrationContextSchema } from "../../../shared/contracts/context.js";
import { HierarchicalMemory, Timeframe, ProbabilisticBias } from "../../../shared/knowledge/hierarchical-types.js";
import { RelationalContext, SMTSignal, ExternalInfluence, RELATIONAL_REGISTRY, RelationshipType } from "../../../shared/knowledge/relational-types.js";
import { VisionFact } from "../../../shared/contracts/pmso.js";
import { AlignmentResolution, AlignmentResolution as Alignment } from "../../../shared/knowledge/hierarchical-types.js";
import { PMSOReconciler } from "../reconciler.js";
import { ScenarioEngine } from "../scenario-engine.js";
import { reconcileScenarios, reconcileHierarchy, reconcileIntermarket } from "../reconciler.js";
import { TemporalEngine } from "../temporal-engine.js";
import { MasterOutputSchema, MasterOutput, HTFOrchestratorOutputSchema, ITFOrchestratorOutputSchema, LTFOrchestratorOutputSchema, StateEnum, BiasEnum, ConfidenceSchema, HTFOrchestratorOutput } from "../../../shared/contracts/canonical.js";
import { z } from "zod";
import { zodToToolSchema } from "../../../shared/utils/zod-to-tool.js";
import { buildPrompt } from "../prompt-builder.js";
import { sanitizeForOrchestration } from "../agents/shared/base-agent.js";
import {
  normalizeDirection,
  normalizeConfidence
} from "../../4.output/normalize-output.js";
import { StorageService } from "../../../shared/services/storage-service.js";
import { buildNewsModifier } from '../../news/news-modifier.js';
import { reasonAboutNews, NewsReasoningResult } from '../../3.query/news-reasoner.js';
// News/article-oriented pipelines removed from master orchestrator flow.
// macro/news modifier will be supplied via `hydration_context.macro_events` when available.

import { MasterOrchestratorInputSchema, type MasterOrchestratorInput } from "../../../shared/contracts/master/input.js";
export {
  MasterOrchestratorInputSchema
} from "../../../shared/contracts/master/input.js";

export type {
  MasterOrchestratorInput
} from "../../../shared/contracts/master/input.js";

type TimeLayer = z.infer<typeof MasterOutputSchema.shape.layers.shape.time>;
type HTFLayer = z.infer<typeof MasterOutputSchema.shape.layers.shape.htf>;
type ITFLayer = z.infer<typeof MasterOutputSchema.shape.layers.shape.itf>;
type LTFLayer = z.infer<typeof MasterOutputSchema.shape.layers.shape.ltf>;
type ConfluenceLayer = z.infer<typeof MasterOutputSchema.shape.layers.shape.confluence>;

function buildEventWindows(macroEvents: any[] = []) {
  return {
    active: macroEvents.filter((event: any) => event?.lifecycle_phase === "ACTIVE" || event?.window_state === "active"),
    upcoming: macroEvents.filter((event: any) => event?.lifecycle_phase === "UPCOMING" || event?.window_state === "upcoming"),
    embargo: macroEvents.filter((event: any) => event?.embargo_active === true || event?.window_state === "embargo"),
    cooldown: macroEvents.filter((event: any) => event?.lifecycle_phase === "COOLDOWN" || event?.window_state === "cooldown"),
    post_event_stabilization: macroEvents.filter((event: any) => event?.lifecycle_phase === "POST_EVENT_STABILIZATION" || event?.window_state === "post_event_stabilization"),
  };
}

function buildMacroNarrative(profile: any, newsModifier: any, macroEvents: any[]) {
  return {
    narrative_state: profile?.narrative_state ?? newsModifier?.macro_context?.phase ?? null,
    narrative_scope:
      profile?.narrative_scope ?? null,

    narrative_as_of:
      profile?.narrative_as_of ?? null,

    narrative_event_category:
      profile?.narrative_event_category ?? null,
    macro_bias: profile?.macro_bias ?? newsModifier?.macro_context?.macro_bias ?? "neutral",
    regime: profile?.regime ?? null,
    narrative_confidence: profile?.narrative_confidence ?? null,
    macro_themes: profile?.macro_themes ?? [],
    macro_timeline: profile?.macro_timeline ?? [],
    weekly_delivery_model:
      profile?.weekly_delivery_model ?? {},

    daily_delivery_model:
      profile?.daily_delivery_model ?? {},

    intraday_expectations:
      profile?.intraday_expectations ?? {},
    active_events: Array.isArray(profile?.active_events) ? profile.active_events : macroEvents,
    adaptation_state: Array.isArray(profile?.adaptation_history) && profile.adaptation_history.length > 0
      ? profile.adaptation_history[profile.adaptation_history.length - 1]
      : null,
  };
}

function getHydratedWeeklyProfile(hydrationContext: HydrationContext) {
  return (hydrationContext as any)?.weekly_profile ?? hydrationContext?.macro_profile ?? null;
}

function getHydratedDailyProfile(hydrationContext: HydrationContext) {
  return (hydrationContext as any)?.daily_profile ?? null;
}

function getHydratedRawCalendarEvents(hydrationContext: HydrationContext) {
  const candidate =
    (hydrationContext as any)?.raw_calendar_events ??
    (hydrationContext as any)?.macro_events ??
    hydrationContext?.news_events ??
    [];
  return Array.isArray(candidate) ? candidate : [];
}

function deriveProfileExecutionWindows(weeklyProfile: any, dailyProfile: any, asOf = new Date()) {
  const nowTs = asOf.getTime();
  const dailyCatalysts = Array.isArray(dailyProfile?.todays_catalysts) ? dailyProfile.todays_catalysts : [];
  const weeklyTimeline = Array.isArray(weeklyProfile?.macro_timeline) ? weeklyProfile.macro_timeline : [];

  const dailyEvents = dailyCatalysts.map((event: any) => ({
    id: event?.event_id ?? event?.id ?? event?.title,
    title: event?.title,
    category: event?.category,
    impact: event?.impact,
    scheduled_time: event?.scheduled_time_utc,
    market_time_hhmm: event?.market_time_hhmm,
    killzone_tags: event?.killzone_tags ?? [],
    session_tags: event?.session_tags ?? [],
    expected_effect: event?.expected_effect,
  }));

  const timelineEvents = weeklyTimeline.map((event: any) => ({
    id: event?.catalyst ?? event?.title ?? event?.date,
    title: event?.catalyst ?? event?.title,
    category: event?.category,
    impact: event?.impact,
    scheduled_time: event?.date,
    market_time_hhmm: event?.market_time_hhmm,
    killzone_tags: event?.killzone_tags ?? [],
    session_tags: event?.session_tags ?? [],
    expected_effect: event?.expected_effect,
  }));

  const allEvents = [...dailyEvents, ...timelineEvents]
    .filter((event: any) => !!event?.scheduled_time)
    .sort((a: any, b: any) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());

  const active = allEvents.filter((event: any) => Math.abs(new Date(event.scheduled_time).getTime() - nowTs) <= 30 * 60 * 1000);
  const upcoming = allEvents.filter((event: any) => new Date(event.scheduled_time).getTime() > nowTs).slice(0, 10);
  const cooldown = allEvents.filter((event: any) => {
    const ts = new Date(event.scheduled_time).getTime();
    return ts < nowTs && (nowTs - ts) <= 90 * 60 * 1000;
  });

  return {
    active,
    upcoming,
    embargo: upcoming.filter((event: any) => (new Date(event.scheduled_time).getTime() - nowTs) <= 60 * 60 * 1000),
    cooldown,
    post_event_stabilization: cooldown,
    high_attention_windows: dailyProfile?.liquidity_expectations?.high_attention_windows ?? [],
    expected_displacement_windows: dailyProfile?.liquidity_expectations?.expected_displacement_windows ?? [],
    expected_reversal_windows: dailyProfile?.liquidity_expectations?.expected_reversal_windows ?? [],
  };
}

function deriveExecutionStateFromProfiles(hydrationContext: HydrationContext) {
  const weeklyProfile = getHydratedWeeklyProfile(hydrationContext);
  const dailyProfile = getHydratedDailyProfile(hydrationContext);
  const executionWindows = deriveProfileExecutionWindows(weeklyProfile, dailyProfile, new Date());

  const uncertaintyPressure = (() => {
    const risk = String(dailyProfile?.intraday_awareness?.execution_risk_context || weeklyProfile?.volatility_expectation || "").toLowerCase();
    if (risk.includes("high")) return 0.9;
    if (risk.includes("medium")) return 0.5;
    return 0.2;
  })();

  const volatilityPressure = (() => {
    const volatility = String(weeklyProfile?.volatility_expectation || weeklyProfile?.regime?.volatility || "").toLowerCase();
    if (volatility.includes("high")) return 0.9;
    if (volatility.includes("medium")) return 0.5;
    return 0.2;
  })();

  const confidenceModifier = Math.max(-0.9, -Math.max(uncertaintyPressure, volatilityPressure));
  const activeEvent = executionWindows.active[0] ?? executionWindows.upcoming[0] ?? null;
  const phase =
    executionWindows.active.length > 0
      ? "ACTIVE"
      : executionWindows.embargo.length > 0
        ? "EMBARGO"
        : executionWindows.upcoming.length > 0
          ? "UPCOMING"
          : executionWindows.cooldown.length > 0
            ? "COOLDOWN"
            : "IDLE";

  return {
    uncertainty_pressure: uncertaintyPressure,
    volatility_pressure: volatilityPressure,
    directional_alignment: "NEUTRAL" as const,
    macro_ire: {
      execution_risk: dailyProfile?.intraday_awareness?.execution_risk_context ?? weeklyProfile?.volatility_expectation ?? null,
      confidence_modifier: confidenceModifier,
      event_phase: phase,
      volatility_regime: weeklyProfile?.volatility_expectation ?? weeklyProfile?.regime?.volatility ?? null,
      narrative_alignment: dailyProfile?.weekly_alignment_state ?? null,
      execution_modifier: {
        reduce_size: volatilityPressure >= 0.6,
        avoid_pre_news_entry: executionWindows.embargo.length > 0
      },
      why: dailyProfile?.narrative_assessment?.daily_thesis ?? weeklyProfile?.dominant_narrative ?? null
    },
    macro_context: {
      active_event: activeEvent?.title ?? null,
      phase,
      impact: activeEvent?.impact ?? null,
      expected_volatility: weeklyProfile?.volatility_expectation ?? weeklyProfile?.regime?.volatility ?? null,
      macro_bias: weeklyProfile?.macro_bias ?? "neutral",
      execution_modifier: {
        reduce_size: volatilityPressure >= 0.6,
        avoid_pre_news_entry: executionWindows.embargo.length > 0
      },
      confidence_modifier: confidenceModifier,
      directional_alignment: "NEUTRAL" as const,
      narrative: dailyProfile?.dominant_weekly_narrative ?? weeklyProfile?.dominant_narrative ?? null
    },
    event_windows: executionWindows,
    execution_modifiers: {
      reduce_size: volatilityPressure >= 0.6,
      avoid_pre_news_entry: executionWindows.embargo.length > 0
    },
    narrative_metadata: {
      weekly_profile_summary: weeklyProfile?.dominant_narrative ?? null,
      daily_profile_summary: dailyProfile?.narrative_assessment?.daily_thesis ?? null,
      day_type: dailyProfile?.day_type ?? null,
      day_role_in_week: dailyProfile?.day_role_in_week ?? null
    }
  };
}

function buildCompactMacroSummary(hydrationContext: HydrationContext, newsModifier?: any) {
  const weeklyProfile = getHydratedWeeklyProfile(hydrationContext);
  const dailyProfile = getHydratedDailyProfile(hydrationContext);
  const rawCalendarEvents = getHydratedRawCalendarEvents(hydrationContext);
  const narrative = buildMacroNarrative(weeklyProfile, newsModifier, rawCalendarEvents);
  const eventWindows = hydrationContext?.event_windows || buildEventWindows(rawCalendarEvents);
  return {
    persistent_macro_narrative: narrative.narrative_state,
    macro_directional_alignment: newsModifier?.directional_alignment ?? "NEUTRAL",
    intermarket_macro_state: {
      macro_bias: narrative.macro_bias,
      regime: narrative.regime,
      active_event_count: Array.isArray(narrative.active_events) ? narrative.active_events.length : 0,
    },
    volatility_regime: newsModifier?.macro_ire?.volatility_regime ?? null,
    continuation_retracement_expectation: newsModifier?.macro_ire?.narrative_alignment ?? null,
    execution_risk: newsModifier?.macro_ire?.execution_risk ?? null,
    embargo_sensitivity: (eventWindows?.embargo?.length || 0) > 0,
    execution_modifiers: newsModifier?.macro_ire?.execution_modifier ?? newsModifier?.macro_context?.execution_modifier ?? null,
    event_phase: newsModifier?.macro_ire?.event_phase ?? newsModifier?.macro_context?.phase ?? null,
    day_type: dailyProfile?.day_type ?? null,
    day_role_in_week: dailyProfile?.day_role_in_week ?? null,
    daily_execution_risk: dailyProfile?.intraday_awareness?.execution_risk_context ?? null,
    macro_catalysts: (Array.isArray(narrative.active_events) ? narrative.active_events : []).slice(0, 5).map((event: any) => ({
      id: event?.id,
      category: event?.category,
      phase: event?.lifecycle_phase ?? event?.window_state ?? null,
    })),
    daily_catalysts: (Array.isArray(dailyProfile?.todays_catalysts) ? dailyProfile.todays_catalysts : []).slice(0, 5).map((event: any) => ({
      id: event?.event_id,
      title: event?.title,
      category: event?.category,
      time: event?.market_time_hhmm ?? null,
    })),
    macro_invalidation_hints: newsModifier?.macro_ire?.why ? [newsModifier.macro_ire.why] : [],
  };
}

function persistNewsArtifacts(captureId: string, hydrationContext: HydrationContext, macroEvents: any[], groundedReasoning: NewsReasoningResult[], newsModifier: any, pmso?: any) {
  const weeklyProfile = getHydratedWeeklyProfile(hydrationContext);
  const dailyProfile = getHydratedDailyProfile(hydrationContext);
  const eventWindows = hydrationContext?.event_windows || buildEventWindows(macroEvents);
  const macroNarrative = hydrationContext?.macro_narrative || buildMacroNarrative(weeklyProfile, newsModifier, macroEvents);
  const quantitativeGroundingActive = groundedReasoning.length > 0;
  const narrativeHydrationActive = !!(weeklyProfile || dailyProfile || hydrationContext?.macro_narrative || hydrationContext?.event_windows);
  const modifierSource =
    quantitativeGroundingActive
      ? "grounded"
      : newsModifier?.macro_context || newsModifier?.macro_ire
        ? "legacy"
        : "reconciler_default";
  const macroContext = {
    narrative_state: macroNarrative?.narrative_state ?? null,
    narrative_scope:
      macroNarrative?.narrative_scope,

    narrative_as_of:
      macroNarrative?.narrative_as_of,

    narrative_event_category:
      macroNarrative?.narrative_event_category,
    persistent_macro_state: weeklyProfile ?? null,
    active_events: macroNarrative?.active_events ?? macroEvents,
    macro_bias: macroNarrative?.macro_bias ?? newsModifier?.macro_context?.macro_bias ?? "neutral",
    regime: macroNarrative?.regime ?? null,
    macro_themes:
      weeklyProfile?.macro_themes ?? [],

    macro_timeline:
      weeklyProfile?.macro_timeline ?? [],
    weekly_delivery_model:
      weeklyProfile?.weekly_delivery_model ?? {},

    daily_delivery_model:
      weeklyProfile?.daily_delivery_model ?? {},

    intraday_expectations:
      weeklyProfile?.intraday_expectations ?? {},
    daily_profile: dailyProfile ?? null,
    adaptation_state: macroNarrative?.adaptation_state ?? null,
    provenance: {
      quantitative_grounding_active: quantitativeGroundingActive,
      narrative_hydration_active: narrativeHydrationActive,
      modifier_source: modifierSource,
    }
  };
  const timeline = {
    capture_id: captureId,
    event_phase: newsModifier?.macro_ire?.event_phase ?? newsModifier?.macro_context?.phase ?? null,
    active_events: (macroEvents || []).map((event: any) => ({
      id: event?.id,
      category: event?.category,
      lifecycle_phase: event?.lifecycle_phase ?? event?.window_state ?? null,
      timestamp: event?.timestamp ?? event?.time ?? null,
    })),
    weekly_profile_week_start: weeklyProfile?.week_start ?? null,
  };
  const intermarketState = {
    macro_pressure: pmso?.intermarket?.macro_pressure ?? null,
    smt_detected: pmso?.intermarket?.smt_detected ?? null,
    macro_news_modifier: pmso?.intermarket?.macro_news_modifier ?? null,
    provenance: {
      quantitative_grounding_active: quantitativeGroundingActive,
      narrative_hydration_active: narrativeHydrationActive,
      modifier_source: modifierSource,
    }
  };

  const artifactMap: Record<string, any> = {
    "analysis/news/macro-context.json": macroContext,
    "analysis/news/macro-narrative.json": macroNarrative,
    "analysis/news/weekly-profile.json": weeklyProfile ?? null,
    "analysis/news/daily-profile.json": dailyProfile ?? null,
    "analysis/news/raw-calendar-events.json": macroEvents,
    "analysis/news/macro-ire.json": newsModifier?.macro_ire ?? null,
    "analysis/news/macro-execution-modifiers.json": {
      execution_modifier: newsModifier?.macro_ire?.execution_modifier ?? newsModifier?.macro_context?.execution_modifier ?? null,
      confidence_modifier: newsModifier?.macro_ire?.confidence_modifier ?? newsModifier?.macro_context?.confidence_modifier ?? null,
      directional_alignment: newsModifier?.directional_alignment ?? "NEUTRAL",
    },
    "analysis/news/news-reasoning-by-event.json": groundedReasoning.map((result: any) => {
      const sourceEvent = (macroEvents || []).find((event: any) => event?.id === result?.event_id);
      return {
        event_id: result?.event_id,
        category: sourceEvent?.category ?? null,
        directional_impact: result?.directional_pressure ?? 0,
        volatility_impact: result?.volatility_pressure ?? 0,
        uncertainty_impact: result?.uncertainty_pressure ?? 0,
        confidence: sourceEvent?.confidence ?? null,
        reasoning: result?.contradiction_notes ?? null,
        evidence_references: result?.chunk_citations ?? [],
        evidence_summaries: result?.evidence_summaries ?? [],
      };
    }),
    "analysis/news/event-windows.json": eventWindows,
    "analysis/news/macro-timeline.json": timeline,
    "analysis/news/intermarket-state.json": intermarketState,
    "analysis/news/macro-themes.json":
      weeklyProfile?.macro_themes ?? [],

    "analysis/news/macro-timeline-v2.json":
      weeklyProfile?.macro_timeline ?? [],
    "analysis/news/weekly-delivery-model.json":
      weeklyProfile?.weekly_delivery_model ?? {},

    "analysis/news/daily-delivery-model.json":
      weeklyProfile?.daily_delivery_model ?? {},

    "analysis/news/intraday-expectations.json":
      weeklyProfile?.intraday_expectations ?? {},
    "analysis/news/provenance.json": {
      quantitative_grounding_active: quantitativeGroundingActive,
      narrative_hydration_active: narrativeHydrationActive,
      modifier_source: modifierSource,
    },
  };

  try {
    for (const [relativePath, data] of Object.entries(artifactMap)) {
      StorageService.saveCaptureArtifact(relativePath, data);
    }
    log({
      stage: "[NEWS][OUTPUT]",
      message: "Persisted news artifact group",
      data: {
        captureId,
        artifacts: Object.keys(artifactMap),
        quantitativeGrounding: quantitativeGroundingActive,
        narrativeHydration: narrativeHydrationActive,
        modifierSource,
      }
    });
    if (!quantitativeGroundingActive && narrativeHydrationActive) {
      log({
        stage: "[NEWS][OUTPUT]",
        message: "Persisted narrative-only news artifacts",
        data: {
          captureId,
          quantitativeGrounding: false,
          narrativeHydration: true,
          modifierSource,
        }
      });
    }
  } catch (error: any) {
    log({
      stage: "[NEWS][OUTPUT]",
      message: "Failed to persist full news artifact group",
      data: { captureId, error: error?.message },
      level: "WARN"
    });
  }
}

const RawMasterOutputSchema = z.union([
  MasterOutputSchema, // The canonical schema
  z.object({ // Add support for decision-only wrapper
    decision: MasterOutputSchema.shape.decision
  }),
  z.object({
    execute: z.boolean(),
    state: z.string(),
    direction: z.string(),
    confidence: z.number(),
    score: z.number(),
    entry_zone: z.string(),
    notes: z.string(),
  }),
  z.object({ // The schema from the logs with decision_type
    decision_type: z.string().optional(),
    direction: z.string().optional(),
    reasoning: z.string().optional(),
  }),
  z.object({ // The schema from the logs with trade_type
    trade_direction: z.string().optional(),
    trade_type: z.string().optional(),
    reasoning: z.string().optional(),
  })
]);

const safeDefaults = {
  decision: {
    execute: false,
    state: "NO_TRADE" as const,
    direction: "neutral" as const,
    confidence: 0.0,
    score: 0,
    entry_zone: "none",
    notes: "No notes.",
  },
  layers: {
    time: { session: "unknown", timing_bias: "neutral", notes: "No notes." },
    htf: { bias: "neutral", state: "unknown", tradable: false, pdArray: "", equilibrium: 0, range_high: 0, range_low: 0, notes: "No notes." },
    itf: { direction: "neutral", valid: false, notes: "No notes." },
    ltf: { direction: "neutral", execute: false, entry: "none", notes: "No notes." },
    confluence: { confirmed: false, strength: 0, notes: "No notes." },
  },
  metadata: { query: "", timestamp: new Date().toISOString(), processing_time_ms: 0, intent: { direction: "neutral" } },
  vision: { enabled: false },
};

function isDefaultTimeLayer(layer: TimeLayer): boolean {
  const def = safeDefaults.layers.time;
  return layer.session === def.session && layer.timing_bias === def.timing_bias && layer.notes === def.notes;
}

function isDefaultHTFLayer(layer: HTFLayer): boolean {
  const def = safeDefaults.layers.htf;
  return layer.bias === def.bias && layer.state === def.state && layer.notes === def.notes;
}

function isDefaultITFLayer(layer: ITFLayer): boolean {
  const def = safeDefaults.layers.itf;
  return layer.direction === def.direction && layer.valid === def.valid && layer.notes === def.notes;
}

function isDefaultLTFLayer(layer: LTFLayer): boolean {
  const def = safeDefaults.layers.ltf;
  return layer.direction === def.direction && layer.execute === def.execute && layer.entry === def.entry && layer.notes === def.notes;
}

function isDefaultConfluenceLayer(layer: ConfluenceLayer): boolean {
  const def = safeDefaults.layers.confluence;
  return layer.confirmed === def.confirmed && layer.strength === def.strength && layer.notes === def.notes;
}

function normalizeMasterOutput(raw: any, fallbackSources?: { validatedInput?: MasterOrchestratorInput, pmso?: any }): MasterOutput {
  // Log the raw object for drift detection
  log({ stage: "MASTER_RAW_OUTPUT", message: "Raw output from LLM", data: raw });

  let shape_detected = 'unknown';
  if (raw && raw.decision && raw.layers) shape_detected = 'canonical';
  else if (raw && raw.decision) shape_detected = 'decision_only';
  else if (raw && raw.execute) shape_detected = 'flat';

  log({ stage: "PARSER_V2_ACTIVE", message: "M-O Parser V2 Active", data: { version: '2', shape_detected: shape_detected, raw_keys: raw ? Object.keys(raw) : [] } });

  if (shape_detected === 'decision_only') {
    const decision = raw.decision;
    const direction = (decision.direction || decision.action || 'neutral').toLowerCase();
    raw = {
      decision: {
        execute: decision.execute || false,
        state: decision.state || 'NO_TRADE',
        direction: direction === 'sell' ? 'bearish' : direction === 'buy' ? 'bullish' : direction,
        confidence: decision.confidence || 0,
        score: decision.score || 0,
        entry_zone: decision.entry_zone || decision.target_liquidity || 'none',
        notes: decision.notes || decision.reasoning || 'No notes.',
        target: decision.target,
        stop_loss: decision.stop_loss,
      }
    };
  }

  let parsedRaw: any = raw;
  try {
    if (typeof parsedRaw === "string") {
      parsedRaw = JSON.parse(parsedRaw);
    } else if (parsedRaw && typeof parsedRaw === "object") {
      if (parsedRaw.parsed) parsedRaw = parsedRaw.parsed;
      if (parsedRaw.result) parsedRaw = parsedRaw.result;
      if (parsedRaw.function_call && parsedRaw.function_call.arguments) {
        try {
          parsedRaw = JSON.parse(parsedRaw.function_call.arguments as string);
        } catch (e) {
          // leave as-is
        }
      }
      if (parsedRaw.parameters && parsedRaw.parameters.decision) {
        parsedRaw = parsedRaw.parameters.decision;
      }
      if (parsedRaw.arguments && typeof parsedRaw.arguments === 'string') {
        try { parsedRaw = JSON.parse(parsedRaw.arguments); } catch (e) { log({ stage: "MASTER_RAW_PARSE_FAIL", message: "Failed to parse raw LLM arguments string", data: { error: (e as any)?.message, arguments: parsedRaw.arguments }, level: "WARN" }); }
      }
    }
  } catch (e) {
    log({ stage: "MASTER_RAW_PARSE_FAIL", message: "Failed to parse raw LLM string", data: { error: (e as any)?.message }, level: "WARN" });
  }

  const normalized = {
    decision: {
      execute: parsedRaw?.execute ?? parsedRaw?.decision?.execute ?? safeDefaults.decision.execute,
      state: parsedRaw?.state ?? parsedRaw?.decision?.state ?? parsedRaw?.decision_type ?? parsedRaw?.trade_type ?? safeDefaults.decision.state,
      direction:
        normalizeDirection(
          parsedRaw?.direction ??
          parsedRaw?.decision?.direction ??
          parsedRaw?.trade_direction ??
          safeDefaults.decision.direction
        ),
      confidence:
        normalizeConfidence(
          parsedRaw?.confidence ??
          parsedRaw?.decision?.confidence ??
          safeDefaults.decision.confidence
        ),
      score: parsedRaw?.score ?? parsedRaw?.decision?.score ?? safeDefaults.decision.score,
      entry_zone: parsedRaw?.entry_zone ?? parsedRaw?.decision?.entry_zone ?? safeDefaults.decision.entry_zone,
      notes: parsedRaw?.notes ?? parsedRaw?.decision?.notes ?? parsedRaw?.reasoning ?? safeDefaults.decision.notes,
      target: parsedRaw?.target ?? parsedRaw?.decision?.target,
      stop_loss: parsedRaw?.stop_loss ?? parsedRaw?.decision?.stop_loss,
    },
    layers: {
      time: parsedRaw.layers?.time ?? safeDefaults.layers.time,
      htf: parsedRaw.layers?.htf ?? safeDefaults.layers.htf,
      itf: parsedRaw.layers?.itf ?? safeDefaults.layers.itf,
      ltf: parsedRaw.layers?.ltf ?? safeDefaults.layers.ltf,
      confluence:
        parsedRaw.layers?.confluence ?? {
          confirmed:
            (fallbackSources?.validatedInput?.ltf?.confluence_score ?? 0) >= 2,

          strength:
            fallbackSources?.validatedInput?.ltf?.confluence_score ?? 0,

          notes:
            parsedRaw?.reasoning ??
            "Derived from LTF trigger confluence."
        },
    },
    metadata: parsedRaw.metadata ?? safeDefaults.metadata,
    vision: parsedRaw.vision ?? safeDefaults.vision,
  };

  const input = fallbackSources?.validatedInput;
  const pmso: any = fallbackSources?.pmso;

  try {
    if (input) {
      const hydrationLog = {
        synthesized: [] as string[],
        preserved: [] as string[],
        activated: false
      };

      if (isDefaultTimeLayer(normalized.layers.time)) {
        normalized.layers.time = {
          session:
            input.time?.session ||
            pmso?.market_context?.current_session?.value ||
            "unknown",
          timing_bias:
            input.time?.timing_bias ||
            "neutral",

          notes: "hydrated_from_pmso"
        };
        hydrationLog.synthesized.push("time");
        hydrationLog.activated = true;
      } else {
        hydrationLog.preserved.push("time");
      }
      if (isDefaultHTFLayer(normalized.layers.htf)) {
        const htfPD =
          input.htf?.pd_array_state as any;

        normalized.layers.htf = {
          bias:
            pmso?.market_context?.htf_bias?.value ||
            (input.htf?.htf_bias as any) ||
            "neutral",

          state:
            pmso?.market_context?.market_mode?.value ||
            "unknown",

          tradable:
            (pmso?.market_context?.htf_bias?.confidence || 0) > 0.5,

          pdArray:
            JSON.stringify(
              input.htf?.pd_array_state || ""
            ),

          equilibrium:
            htfPD?.pd_context?.equilibrium ?? htfPD?.equilibrium ?? 0,

          range_high:
            htfPD?.pd_context?.range_high ?? htfPD?.range_high ?? 0,

          range_low:
            htfPD?.pd_context?.range_low ?? htfPD?.range_low ?? 0,

          notes:
            input.htf?.reasoning ||
            "hydrated_from_pmso"
        };

        hydrationLog.synthesized.push("htf");
        hydrationLog.activated = true;

      } else {
        hydrationLog.preserved.push("htf");
      }

      if (isDefaultITFLayer(normalized.layers.itf)) {
        normalized.layers.itf = {
          direction:
            (input.itf?.itf_bias as any) ||
            pmso?.market_context?.htf_bias?.value ||
            "neutral",
          valid:
            (input.itf?.confidence || 0) > 0.4,
          notes:
            input.itf?.reasoning ||
            "hydrated_from_pmso"
        };

        hydrationLog.synthesized.push("itf");
        hydrationLog.activated = true;

      } else {
        hydrationLog.preserved.push("itf");
      }

      if (isDefaultLTFLayer(normalized.layers.ltf)) {
        normalized.layers.ltf = {
          direction:
            (input.ltf?.direction as any) ||
            pmso?.market_context?.htf_bias?.value ||
            "neutral",
          execute:
            !!input.ltf?.execute,
          entry:
            input.ltf?.entry ||
            "none",
          notes:
            input.ltf?.reasoning ||
            "hydrated_from_pmso"
        };

        hydrationLog.synthesized.push("ltf");
        hydrationLog.activated = true;

      } else {
        hydrationLog.preserved.push("ltf");
      }

      if (isDefaultConfluenceLayer(normalized.layers.confluence)) {
        normalized.layers.confluence = {
          confirmed:
            (input.ltf?.confluence_score || 0) >= 2,

          strength:
            input.ltf?.confluence_score || 0,

          notes:
            "hydrated_from_pmso"
        };

        hydrationLog.synthesized.push("confluence");
        hydrationLog.activated = true;

      } else {
        hydrationLog.preserved.push("confluence");
      }

      if (hydrationLog.activated) {
        log({
          stage: "MASTER_LAYER_HYDRATION",
          message: "Hydrated canonical layers from PMSO cognition",
          data: hydrationLog
        });
      }
    }


    if (input) {
      const ltfInput = input.ltf || {};
      const itfInput = input.itf || {};
      const htfInput = input.htf || {};
      const defaultDecision = safeDefaults.decision;
      const notesDefault = !normalized.decision.notes || normalized.decision.notes.trim() === "" || normalized.decision.notes === defaultDecision.notes;
      const entryDefault = !normalized.decision.entry_zone || normalized.decision.entry_zone === defaultDecision.entry_zone;
      const confidenceDefault = normalized.decision.confidence === defaultDecision.confidence;
      const directionDefault = normalized.decision.direction === defaultDecision.direction || normalized.decision.direction === normalizeDirection(
        "neutral"
      );
      const fallbackReasons: string[] = [];

      if (entryDefault && ltfInput.entry) {
        normalized.decision.entry_zone = ltfInput.entry;
        fallbackReasons.push("Entry zone restored from LTF output.");
      }
      if (confidenceDefault) {
        if (typeof ltfInput.confidence === 'number') {
          normalized.decision.confidence = ltfInput.confidence;
          fallbackReasons.push("Confidence restored from LTF output.");
        } else if (typeof itfInput.confidence === 'number') {
          normalized.decision.confidence = itfInput.confidence;
          fallbackReasons.push("Confidence restored from ITF output.");
        } else if (typeof htfInput.confidence === 'number') {
          normalized.decision.confidence = htfInput.confidence;
          fallbackReasons.push("Confidence restored from HTF output.");
        }
      }
      if (notesDefault) {
        const reasoningParts: string[] = [];
        if (ltfInput.reasoning) reasoningParts.push(`LTF: ${ltfInput.reasoning}`);
        if (itfInput.reasoning) reasoningParts.push(`ITF: ${itfInput.reasoning}`);
        if (htfInput.reasoning) reasoningParts.push(`HTF: ${htfInput.reasoning}`);
        if (reasoningParts.length > 0) {
          normalized.decision.notes = reasoningParts.join(' | ');
          fallbackReasons.push("Notes restored from upstream reasoning.");
        }
      }
      if (directionDefault && ltfInput.direction) {
        normalized.decision.direction = normalizeDirection(
          ltfInput.direction
        );;
        fallbackReasons.push("Direction restored from LTF output.");
      }
      if ((normalized.decision.score ?? 0) === 0 && typeof ltfInput.confluence_score === 'number' && ltfInput.confluence_score > 0) {
        normalized.decision.score = ltfInput.confluence_score;
        fallbackReasons.push("Score restored from LTF confluence.");
      }

      const htfPD = htfInput?.pd_array_state as any;
      if (htfPD) {
        normalized.layers.htf = {
          ...normalized.layers.htf,
          equilibrium: normalized.layers.htf.equilibrium || (htfPD?.pd_context?.equilibrium ?? htfPD?.equilibrium ?? 0),
          range_high: normalized.layers.htf.range_high || (htfPD?.pd_context?.range_high ?? htfPD?.range_high ?? 0),
          range_low: normalized.layers.htf.range_low || (htfPD?.pd_context?.range_low ?? htfPD?.range_low ?? 0),
        };
      }

      if (ltfInput?.execute === true && (itfInput?.entry_bias === "none" || itfInput?.setup_type === "none")) {
        normalized.decision.notes =
          `${normalized.decision.notes ? `${normalized.decision.notes} | ` : ""}Conflict: LTF execute=true while ITF has no validated entry bias/setup.`;
        normalized.layers.confluence = {
          ...normalized.layers.confluence,
          notes: `${normalized.layers.confluence?.notes ? `${normalized.layers.confluence.notes} | ` : ""}Conflict detected between LTF trigger and ITF setup gate.`
        };
        fallbackReasons.push("Surfaced ITF/LTF execution conflict.");
      }

      if (fallbackReasons.length > 0) {
        normalized.metadata = normalized.metadata ?? { query: "", timestamp: new Date().toISOString(), processing_time_ms: 0, intent: { direction: "neutral" } };
        normalized.metadata.fallback_used = true;
        normalized.metadata.fallback_reason = fallbackReasons.join(' | ');
      }
    }

    if ((!normalized.metadata || !normalized.metadata.timestamp) && (input || pmso)) {
      normalized.metadata = normalized.metadata ?? { query: "", timestamp: new Date().toISOString(), processing_time_ms: 0, intent: { direction: "neutral" } };
      if (pmso && pmso.market_context && pmso.market_context.htf_bias) {
        const v = (pmso.market_context.htf_bias.value || "neutral");
        normalized.metadata.intent = { direction: v === 'bullish' ? 'long' : v === 'bearish' ? 'short' : 'neutral' };
      }
    }
  } catch (e) {
    log({ stage: "MASTER_SYNTH_FAIL", message: "Failed synthesizing missing layers/metadata", data: { error: (e as any)?.message }, level: "WARN" });
  }

  // Normalization layer: map common LLM variants to canonical enums
  try {
    // Normalize decision.state variants
    if (normalized?.decision && typeof normalized.decision.state === 'string') {
      const rawState = String(normalized.decision.state).trim();
      const lower = rawState.toLowerCase();
      const mapping: Record<string, string> = {
        'trade': 'READY',
        'traDe': 'READY',
        'trading': 'READY',
        'wait': 'WAIT_FOR_ENTRY',
        'waiting': 'WAIT_FOR_ENTRY',
        'no_trade': 'NO_TRADE',
        'no-trade': 'NO_TRADE',
        'none': 'NO_TRADE',
        'neutral': 'NO_TRADE'
      };

      // explicit case-insensitive checks
      if (mapping[lower]) {
        const mapped = mapping[lower];
        if (mapped !== normalized.decision.state) {
          log({ stage: 'MASTER_NORMALIZATION_TRACE', message: 'Normalized master decision.state', data: { field: 'state', from: rawState, to: mapped } });
          normalized.decision.state = mapped;
        }
      } else {
        // additional tolerant mappings for common uppercase variants
        if (rawState === 'TRADE' || rawState === 'Trade') {
          log({ stage: 'MASTER_NORMALIZATION_TRACE', message: 'Normalized master decision.state', data: { field: 'state', from: rawState, to: 'READY' } });
          normalized.decision.state = 'READY';
        }
      }
    }

    // Normalize decision.direction variants
    if (normalized?.decision && typeof normalized.decision.direction === 'string') {
      const rawDir = String(normalized.decision.direction).trim();
      const lowerDir = rawDir.toLowerCase();
      const dirMap: Record<string, string> = {
        'sell': 'bearish',
        'buy': 'bullish',
        'none': 'neutral'
      };
      if (dirMap[lowerDir]) {
        const mapped = dirMap[lowerDir];
        if (mapped !== normalized.decision.direction) {
          log({ stage: 'MASTER_NORMALIZATION_TRACE', message: 'Normalized master decision.direction', data: { field: 'direction', from: rawDir, to: mapped } });
          normalized.decision.direction = mapped;
        }
      }
    }
  } catch (e) {
    log({ stage: 'MASTER_NORMALIZATION_TRACE', message: 'Normalization error (non-fatal)', data: { error: (e as any)?.message }, level: 'WARN' });
  }

  return MasterOutputSchema.parse(normalized);
}


function createRelationalContext(htfOutput: HTFOrchestratorOutput): RelationalContext | null {
  if (!htfOutput) {
    return null;
  }

  const primary_asset = "EURUSD";
  const smt_hints: SMTSignal[] = [];
  const external_influences: ExternalInfluence[] = [];
  let alignment_score = 0;

  const structureFacts = htfOutput.structure_state?.facts || [];
  for (const fact of structureFacts) {
    if (fact.type.includes("smt") && !fact.type.includes("no_smt_divergence_observed")) {
      const isBearish = fact.type.includes("bearish");
      smt_hints.push({
        assets: ["EURUSD", "GBPUSD"],
        type: isBearish ? "BEARISH_SMT" : "BULLISH_SMT",
        divergence_type: isBearish ? "HH_VS_LH" : "LL_VS_HL",
        confidence: (() => {
          if (typeof fact.confidence === 'number') return fact.confidence;
          if (fact.confidence && typeof fact.confidence === 'object' && 'conviction' in fact.confidence) {
            return (fact.confidence as any).conviction;
          }
          log({ stage: "RELATIONAL_CONTEXT_WARN", message: "fact.confidence is not a number and has no conviction property.", data: { fact }, level: "WARN" });
          return 0;
        })(),
        // SMT should only be accepted when we have PD-array context at HTF.
        // HTF PD-array location is carried as part of htfOutput.pd_array_state.
        // If that context is missing, keep false (and log later at reconciliation time).
        is_at_pd_array: (() => {
          try {
            const pd = htfOutput.pd_array_state as any;
            const zone = pd?.zone;
            return zone === 'premium' || zone === 'discount' || zone === 'equilibrium';
          } catch (_) {
            return false;
          }
        })(),
        notes: fact.anchor,
      });
    }
  }

  const macroFacts = htfOutput.macro_state?.facts || [];
  for (const fact of macroFacts) {
    const source_asset = fact.type.split("_")[0].toUpperCase();
    const relationship = RELATIONAL_REGISTRY.find(r => r.source_asset === source_asset && r.target_asset === primary_asset);

    if (relationship) {
      let direction: "BULLISH_PRESSURE" | "BEARISH_PRESSURE" | "NEUTRAL" = "NEUTRAL";
      const isBullish = fact.type.includes("bullish") || fact.type.includes("rising");
      const isBearish = fact.type.includes("bearish") || fact.type.includes("falling");

      if (isBullish) {
        direction = relationship.type === "INVERSE_CORRELATION" ? "BEARISH_PRESSURE" : "BULLISH_PRESSURE";
      } else if (isBearish) {
        direction = relationship.type === "INVERSE_CORRELATION" ? "BULLISH_PRESSURE" : "BEARISH_PRESSURE";
      }

      if (direction !== "NEUTRAL") {
        external_influences.push({
          source_asset,
          relationship: relationship.type,
          direction,
          confidence: (() => {
            if (typeof fact.confidence === 'number') return fact.confidence;
            if (fact.confidence && typeof fact.confidence === 'object' && 'conviction' in fact.confidence) {
              return (fact.confidence as any).conviction;
            }
            log({ stage: "RELATIONAL_CONTEXT_WARN", message: "fact.confidence is not a number and has no conviction property.", data: { fact }, level: "WARN" });
            return 0;
          })(),
          temporal_decay: 1.0,
        });
      }
    }
  }

  let raw_score = 0;
  for (const hint of smt_hints) {
    raw_score += hint.type === "BULLISH_SMT" ? hint.confidence : -hint.confidence;
  }
  for (const influence of external_influences) {
    raw_score += influence.direction === "BULLISH_PRESSURE" ? influence.confidence : -influence.confidence;
  }

  const max_score = smt_hints.length + external_influences.length;
  if (max_score > 0) {
    alignment_score = raw_score / max_score;
  }


  return {
    primary_asset,
    external_influences,
    smt_hints,
    overall_relational_alignment: alignment_score,
  };
}

const masterDecisionTool = [{
  functionDeclarations: [{
    name: "generateMasterDecision",
    description: "Generate the final trade decision based on the Probabilistic Market State (PMSO).",
    parameters: zodToToolSchema(MasterOutputSchema)
  }]
}];

export async function runMasterOrchestrator(
  input: any
): Promise<MasterOutput> {
  if (!(global as any).currentCaptureId) {
    (global as any).currentCaptureId = Date.now().toString();
  }
  const captureId = (global as any).currentCaptureId;
  const date = (global as any).currentDate;
  const session = (global as any).currentSession;

  const validatedInput = MasterOrchestratorInputSchema.parse(input);
  log({ stage: "MASTER_ORCHESTRATOR", message: "Starting Consolidated Master Orchestrator", data: { input: validatedInput } });

  const facts = PMSOReconciler.extractFactsFromOutputs([validatedInput.htf, validatedInput.itf, validatedInput.ltf, validatedInput.time]);
  let temporalState =
    validatedInput.hydration_context
      ?.inherited_temporal_state || null;
  let previousScenarios: any = null;

  // Macro/calendar conditioning events (hydrated upstream)
  const macro_events = getHydratedRawCalendarEvents(validatedInput.hydration_context);
  const eventsSeen = macro_events.length;
  const eventsExposed = Array.isArray(macro_events) ? macro_events.length : 0;
  let eventsRejected = 0;
  let modifierBranch: "grounded" | "legacy" | "fallback" | "none" = "none";
  let persistenceExecuted = false;

  // NEWS_INPUT_TRACE: log counts and per-event key fields
  log({
      stage: 'NEWS_INPUT_TRACE', message: 'Macro/news hydration inputs', data: {
      macro_events_count: Array.isArray(macro_events) ? macro_events.length : 0,
      raw_calendar_events_count: Array.isArray((validatedInput.hydration_context as any)?.raw_calendar_events) ? (validatedInput.hydration_context as any).raw_calendar_events.length : 0,
      has_weekly_profile: !!getHydratedWeeklyProfile(validatedInput.hydration_context),
      has_daily_profile: !!getHydratedDailyProfile(validatedInput.hydration_context),
      events: (Array.isArray(macro_events) ? macro_events : []).map((e: any) => ({ id: e.id, category: e.category, currency: e.currency, impact: e.impact, confidence: e.confidence, lifecycle_phase: e.lifecycle_phase }))
    }
  });

  // Build the runtime wiring: hydrated macro/news events -> grounded reasoning -> newsModifier -> pressures.
  // NOTE: Preserve neutral/default behavior when no events exist.
  let newsModifier: any = undefined;
  let groundedReasoning: NewsReasoningResult[] = [];
  const profileDerivedExecutionState = deriveExecutionStateFromProfiles(validatedInput.hydration_context);

  try {
    if (Array.isArray(macro_events) && macro_events.length > 0) {
      // Fail-open: if no chunks/evidence are available on events, reasoner will still output numeric pressures.
      for (const ev of macro_events as any[]) {
        try {
          const chunks = Array.isArray(ev?.chunks) ? ev.chunks : [];
          const scoredEvidence = Array.isArray(ev?.scoredEvidence) ? ev.scoredEvidence : [];
          const contradiction = ev?.contradiction || undefined;
          const live_events = Array.isArray(ev?.live_events) ? ev.live_events : (macro_events || []);

          log({
            stage: '[NEWS][REASONER]',
            message: 'Generating grounded news reasoning for event',
            data: {
              captureId,
              eventId: ev?.id,
              category: ev?.category,
              currency: ev?.currency,
              impact: ev?.impact,
              liveEventsCount: live_events?.length || 0
            }
          });

          const rr = await reasonAboutNews(
            ev,
            {
              chunks,
              scoredEvidence,
              contradiction,
              live_events,
            } as any,
            undefined,
            undefined,
            temporalState
          );

          const hasMeaningfulEvidence =
            (Array.isArray(rr?.chunk_citations) && rr.chunk_citations.length > 0) ||
            (Array.isArray(rr?.evidence_summaries) && rr.evidence_summaries.length > 0);
          const hasNonZeroPressure =
            Math.abs(rr?.uncertainty_pressure || 0) > 0 ||
            Math.abs(rr?.volatility_pressure || 0) > 0 ||
            Math.abs(rr?.directional_pressure || 0) > 0 ||
            Math.abs(rr?.manipulation_probability || 0) > 0 ||
            Math.abs(rr?.expansion_probability || 0) > 0 ||
            Math.abs(rr?.repricing_severity || 0) > 0;
          const isValidGrounded =
            hasMeaningfulEvidence || hasNonZeroPressure;

          log({
            stage: '[NEWS][GROUNDING]',
            message: 'News reasoning evaluated for grounded aggregation',
            data: {
              captureId,
              eventId: ev?.id,
              uncertainty_pressure: rr?.uncertainty_pressure,
              volatility_pressure: rr?.volatility_pressure,
              directional_pressure: rr?.directional_pressure,
              has_evidence: hasMeaningfulEvidence,
              has_non_zero_pressure: hasNonZeroPressure,
              accepted: isValidGrounded,
              has_chunk_citations: (rr?.chunk_citations?.length || 0) > 0,
              has_reasoning: (rr?.evidence_summaries?.length || 0) > 0 || !!rr?.contradiction_notes
            }
          });

          if (isValidGrounded) {
            groundedReasoning.push(rr);
          } else {
            eventsRejected += 1;
            log({
              stage: '[NEWS][GROUNDING_INVALID]',
              message: 'Rejecting invalid news reasoning for grounded aggregation',
              data: {
                captureId,
                eventId: ev?.id,
                has_evidence: hasMeaningfulEvidence,
                has_non_zero_pressure: hasNonZeroPressure
              },
              level: 'WARN'
            });
          }
        } catch (e: any) {
          log({
            stage: '[NEWS][LEGACY_FALLBACK]',
            message: 'Failed to ground a specific news event; skipping event',
            data: { captureId, eventId: ev?.id, error: e?.message },
            level: 'WARN'
          });
        }
      }

      log({
        stage: '[NEWS][GROUNDING]',
        message: 'Aggregated grounded reasoning set',
        data: {
          captureId,
          events_in: macro_events.length,
          events_grounded: groundedReasoning.length,
          grounded: groundedReasoning.length > 0
        }
      });

      if (groundedReasoning.length > 0) {
        modifierBranch = "grounded";
        newsModifier = buildNewsModifier(groundedReasoning);
        newsModifier = {
          ...profileDerivedExecutionState,
          ...newsModifier,
          macro_ire: {
            ...(profileDerivedExecutionState?.macro_ire || {}),
            ...(newsModifier?.macro_ire || {}),
          },
          macro_context: {
            ...(profileDerivedExecutionState?.macro_context || {}),
            ...(newsModifier?.macro_context || {}),
          },
          event_windows: newsModifier?.event_windows || profileDerivedExecutionState?.event_windows,
          execution_modifiers: newsModifier?.execution_modifiers || profileDerivedExecutionState?.execution_modifiers,
          narrative_metadata: newsModifier?.narrative_metadata || profileDerivedExecutionState?.narrative_metadata,
        };
        validatedInput.hydration_context.news_reasoning = groundedReasoning;

        log({
          stage: '[NEWS][MODIFIER]',
          message: 'Built grounded news modifier (macro_context + macro_ire)',
          data: {
            captureId,
            volatility_pressure: newsModifier?.volatility_pressure,
            uncertainty_pressure: newsModifier?.uncertainty_pressure,
            directional_alignment: newsModifier?.directional_alignment,
            has_macro_context: !!newsModifier?.macro_context,
            has_macro_ire: !!newsModifier?.macro_ire
          }
        });
      } else {
        // Fail-open legacy fallback: will likely collapse narratives; warn loudly.
        modifierBranch = "legacy";
        log({
          stage: '[NEWS][LEGACY_FALLBACK]',
          message: 'No grounded news reasoning available; falling back to legacy events-only modifier',
          data: { captureId, reason: 'groundedReasoning.length === 0' },
          level: 'WARN'
        });

        newsModifier = {
          ...profileDerivedExecutionState,
          ...buildNewsModifier(macro_events as any[])
        };
      }
    } else {
      modifierBranch = "fallback";
      log({
        stage: '[NEWS][LEGACY_FALLBACK]',
        message: 'Grounding unavailable because no macro events were hydrated',
        data: { captureId, reason: 'macro_events.length === 0' },
        level: 'WARN'
      });
      newsModifier = profileDerivedExecutionState;
    }
  } catch (err: any) {
    // Never block orchestration due to news modifier issues.
    log({
      stage: "MASTER_NEWS_MODIFIER_BUILD_FAIL",
      message: "Failed to build grounded newsModifier from hydrated macro/news events; defaulting to neutral.",
      data: { error: err?.message },
      level: "WARN"
    });

    newsModifier = profileDerivedExecutionState;
  }

  // Intentionally skip article retrieval/reasoning inside the master orchestrator.
  // We only convert hydrated macro/news events into a modifier.
  if (date && session) {
    try {
      const loadedTemporal =
        validatedInput.hydration_context
          ?.inherited_temporal_state || null;

      if (!temporalState) {
        temporalState = loadedTemporal;
      }

      const currentPrice = (global as any).currentPrice;
      // PMSO_MACRO_TRACE: snapshot of newsModifier applied to TemporalEngine.reconcile
      log({
        stage: 'PMSO_MACRO_TRACE', message: 'Applying newsModifier to Temporal reconciliation', data: {
          newsModifier: {
            volatility_pressure: newsModifier?.volatility_pressure,
            uncertainty_pressure: newsModifier?.uncertainty_pressure,
            macro_context: newsModifier?.macro_context ? { phase: newsModifier.macro_context.phase, impact: newsModifier.macro_context.impact, active_event: newsModifier.macro_context.active_event } : undefined,
            macro_ire_present: !!newsModifier?.macro_ire
          }
        }
      });
      log({
        stage: "TEMPORAL_TRACE_3",
        message: "Master Orchestrator before TemporalEngine.reconcile",
        data: {
          inherited_exists: !!temporalState,
          capture_count: temporalState?.capture_count,
          structures: temporalState?.structures?.length
        }
      });

      temporalState = TemporalEngine.reconcile(facts, temporalState, captureId, currentPrice, newsModifier);
      StorageService.persistAnalysisOutput("master", "temporal-state", temporalState);

      log({
        stage: "TEMPORAL_STATE_RECONCILED", message: `Temporal reconciliation complete for session: ${session}`, data: {
          hasInherited: !!temporalState,
          factCount: facts.length,
          structureCount: temporalState?.structures?.length || 0
        }
      });

    } catch (err: any) {
      log({ stage: "TEMPORAL_STATE_ERROR", message: "Failed to reconcile temporal state, falling back to stateless", data: { error: err.message }, level: "ERROR" });
    }
  } else {
    log({ stage: "TEMPORAL_STATE_SKIP", message: "Missing date/session context for temporal engine", data: { date, session }, level: "WARN" });
  }

  // Attempt to hydrate previous scenarios from storage so reconciliation can inherit
  try {
    if (date && session) {
      const loadedPrev = StorageService.loadLatestScenarios(date, session);
      if (loadedPrev) {
        previousScenarios = loadedPrev;
        log({ stage: 'SCENARIO_HYDRATION_TRACE', message: 'Loaded previous scenarios for inheritance', data: { loaded: true, active_count: Array.isArray(loadedPrev?.active_scenarios) ? loadedPrev.active_scenarios.length : 0 } });
      } else {
        log({ stage: 'SCENARIO_HYDRATION_TRACE', message: 'No previous scenarios found for session/date', data: { loaded: false } });
      }
    }
  } catch (e: any) {
    log({ stage: 'SCENARIO_HYDRATION_TRACE', message: 'Failed to load previous scenarios (non-fatal)', data: { error: e?.message }, level: 'WARN' });
  }

  const relationalContext = createRelationalContext(validatedInput.htf);
  const compactMacroSummary = buildCompactMacroSummary(validatedInput.hydration_context, newsModifier);

  if (newsModifier) {
    validatedInput.hydration_context.minimal_context = {
      ...(validatedInput.hydration_context.minimal_context || {}),
      macro_news_summary: compactMacroSummary,
    };
    log({
      stage: "[NEWS][AGENT]",
      message: "Prepared compact macro summary for downstream agent context",
      data: {
        captureId,
        eventPhase: compactMacroSummary.event_phase,
        activeCatalysts: compactMacroSummary.macro_catalysts.length,
      }
    });
  }

  const memory: HierarchicalMemory = {
    theses: {},
    parent_anchor: validatedInput.hydration_context.parent_thesis?.timeframe,
    relational: relationalContext ?? validatedInput.hydration_context.relational_context as any,
    scenarios: validatedInput.hydration_context.scenario_context as any,
  };
  const compactHTF = sanitizeForOrchestration((validatedInput.htf as any)?.compact_output || validatedInput.htf);
  const compactITF = sanitizeForOrchestration((validatedInput.itf as any)?.compact_output || validatedInput.itf);
  const compactLTF = sanitizeForOrchestration((validatedInput.ltf as any)?.compact_output || validatedInput.ltf);
  log({
    stage: "[ORCHESTRATION][SANITIZE]",
    message: "Prepared compact master runtime state",
    data: {
      removed_debug_keys: ["_debug", "_raw"],
      full_estimated_tokens: Math.ceil(JSON.stringify({
        htf: validatedInput.htf,
        itf: validatedInput.itf,
        ltf: validatedInput.ltf,
      }).length / 4),
      compact_estimated_tokens: Math.ceil(JSON.stringify({
        htf: compactHTF,
        itf: compactITF,
        ltf: compactLTF,
      }).length / 4),
    }
  });
  if (validatedInput.hydration_context.parent_thesis) {
    memory.theses[validatedInput.hydration_context.parent_thesis.timeframe as Timeframe] = validatedInput.hydration_context.parent_thesis;
  }
  if (validatedInput.htf) {
    const htfBias = validatedInput.htf.htf_bias;
    let probabilisticBias: ProbabilisticBias;
    switch (htfBias) {
      case 'bullish':
      case 'long':
        probabilisticBias = 'suggests_bullish';
        break;
      case 'bearish':
      case 'short':
        probabilisticBias = 'suggests_bearish';
        break;
      default:
        probabilisticBias = 'suggests_neutral';
        break;
    }

    memory.theses["DAILY"] = {
      timeframe: "DAILY",
      bias: probabilisticBias,
      confidence: validatedInput.htf.confidence,
      key_anchors:
        Array.isArray((compactHTF as any)?.key_anchors) && (compactHTF as any).key_anchors.length > 0
          ? (compactHTF as any).key_anchors
          : validatedInput.htf.dominant_factors,
      summary:
        (compactHTF as any)?.reasoning_summary ||
        validatedInput.htf.reasoning,
      supporting_chunks: [],
    };
  }

  const isTimeInactive = validatedInput.time?.trading_window === "inactive";

  if (newsModifier) {
    newsModifier.event_windows =
      newsModifier.event_windows ||
      validatedInput.hydration_context.event_windows ||
      buildEventWindows(macro_events as any[]);
    newsModifier.execution_modifiers = newsModifier?.macro_ire?.execution_modifier ?? newsModifier?.macro_context?.execution_modifier ?? null;
    newsModifier.narrative_metadata =
      newsModifier.narrative_metadata ||
      validatedInput.hydration_context.macro_narrative ||
      buildMacroNarrative(getHydratedWeeklyProfile(validatedInput.hydration_context), newsModifier, macro_events as any[]);
  }

  if (validatedInput.hydration_context && validatedInput.hydration_context.scenario_context) {
    const retrievedChunks = validatedInput.ltf?.retrieved_chunks || [];
    const newScenarios = await ScenarioEngine.generateScenarios(memory, retrievedChunks, captureId, newsModifier);
    log({
      stage: "SCENARIO_TRACE_1",
      message: "Previous scenarios before reconciliation",
      data: {
        previous_exists: !!previousScenarios,
        active_previous: previousScenarios?.active_scenarios?.length
      }
    });

    memory.scenarios = reconcileScenarios(
      { ...memory, scenarios: newScenarios },
      previousScenarios,
      newsModifier
    );

    log({
      stage: "SCENARIO_TRACE_2",
      message: "Scenarios after reconciliation",
      data: {
        active_result: memory.scenarios?.active_scenarios?.length
      }
    });
    StorageService.saveScenarios(memory.scenarios);
    log({
      stage: "SCENARIO_PERSISTENCE",
      message: "Persisted reconciled scenarios",
      data: {
        active_scenarios:
          memory.scenarios?.active_scenarios?.length || 0
      }
    });
  }

  const pmso = PMSOReconciler.reconcile(facts, memory, captureId, temporalState, newsModifier);
  if (newsModifier) {
    pmso.intermarket.macro_news_modifier =
      newsModifier;
  }
  if (pmso.intermarket.macro_news_modifier) {
    pmso.intermarket.macro_news_modifier = {
      ...pmso.intermarket.macro_news_modifier,
      macro_context: newsModifier?.macro_context,
      macro_ire: newsModifier?.macro_ire,
      event_windows:
        newsModifier?.event_windows ||
        validatedInput.hydration_context.event_windows ||
        buildEventWindows(macro_events),
      execution_modifiers: newsModifier?.execution_modifiers ?? newsModifier?.macro_ire?.execution_modifier ?? newsModifier?.macro_context?.execution_modifier ?? null,
      narrative_metadata:
        newsModifier?.narrative_metadata ||
        validatedInput.hydration_context.macro_narrative ||
        buildMacroNarrative(getHydratedWeeklyProfile(validatedInput.hydration_context), newsModifier, macro_events),
    };
  }

  try {
    StorageService.persistAnalysisOutput("pmso", captureId, pmso);
    log({ stage: "MACRO_PMSO_TRACE", message: "Master orchestrator persisted PMSO", data: { captureId, cognition_id: ((pmso.metadata as any)?.cognition_id) } });
  } catch (e: any) {
    log({ stage: "MACRO_PMSO_TRACE", message: "Failed to persist PMSO at master orchestrator", data: { error: e?.message }, level: "WARN" });
  }

  const alignment = validatedInput.hydration_context ? reconcileHierarchy(memory) : null;
  const intermarket = validatedInput.hydration_context ? reconcileIntermarket(memory) : null;

  const narrativeHydrationActive = !!(
    getHydratedWeeklyProfile(validatedInput.hydration_context) ||
    getHydratedDailyProfile(validatedInput.hydration_context) ||
    (Array.isArray((validatedInput.hydration_context as any)?.raw_calendar_events) && (validatedInput.hydration_context as any).raw_calendar_events.length > 0) ||
    validatedInput.hydration_context?.macro_narrative ||
    validatedInput.hydration_context?.event_windows
  );
  const shouldPersistNewsArtifacts =
    !!newsModifier ||
    groundedReasoning.length > 0 ||
    (macro_events || []).length > 0 ||
    narrativeHydrationActive;

  if (shouldPersistNewsArtifacts) {
    persistNewsArtifacts(captureId, validatedInput.hydration_context, macro_events as any[], groundedReasoning, newsModifier, pmso);
    persistenceExecuted = true;
  }

  log({
    stage: "[NEWS][SUMMARY]",
    message: "Runtime news pipeline summary",
    data: {
      captureId,
      events_seen: eventsSeen,
      events_exposed: eventsExposed,
      events_grounded: groundedReasoning.length,
      events_rejected: eventsRejected,
      modifier_branch: modifierBranch,
      persistence_executed: persistenceExecuted,
      narrative_only: narrativeHydrationActive && groundedReasoning.length === 0 && (macro_events || []).length === 0,
      event_windows_active: newsModifier?.event_windows?.active?.length || validatedInput.hydration_context?.event_windows?.active?.length || 0,
      daily_profile_catalysts: Array.isArray(getHydratedDailyProfile(validatedInput.hydration_context)?.todays_catalysts) ? getHydratedDailyProfile(validatedInput.hydration_context).todays_catalysts.length : 0,
    }
  });

  const temporalCaptureCount = temporalState?.capture_count || 0;
  const discoveredCount = Array.isArray(temporalState?.structures)
    ? temporalState.structures.filter((s: any) => s?.status === "DISCOVERED").length
    : 0;

  const prompt = buildPrompt({
    role: "You are the Master Orchestrator.",
    task: "Generate a final trade decision by calling the 'generateMasterDecision' function. The decision will be based on the provided Probabilistic Market State (PMSO) and other context.",
    inputContext: `## PMSO\n\`\`\`json\n${JSON.stringify(pmso, null, 2)}\n\`\`\`\n\n## Context\n- Alignment: ${alignment?.state || "Unknown"} (${alignment?.resolution_notes || "N/A"})\n- Time Gate: ${isTimeInactive ? "CLOSED" : "OPEN"}\n- PMSO Confidence: ${pmso.market_context.htf_bias.confidence.toFixed(2)}\n- Tension Score: ${pmso.tensions.contradiction_score.toFixed(2)}\n- Temporal Capture Count: ${temporalCaptureCount}\n- Discovered Structures Awaiting Validation: ${discoveredCount}\n- Temporal Maturity Note: ${temporalCaptureCount <= 1 ? "First capture in sequence; temporal structures are not yet validated by prior captures." : "Temporal state has prior capture history."}`,
    constraints: [
      "Your response must be a call to the 'generateMasterDecision' function, and nothing else.",
      "The output must be a single JSON object that strictly adheres to the provided schema.",
      "Ensure all required fields in the 'decision' object are present and have the correct types."
    ],
    outputFormat: ""
  }, validatedInput.hydration_context);

  try {
    const llmResult = await callLLM(
      prompt,
      "Master-Orchestrator",
      captureId,
      [{ text: prompt }],
      { useStructured: true, schema: RawMasterOutputSchema }
    ) as any;

    const normalizedOutput = normalizeMasterOutput(llmResult, { validatedInput, pmso });

    // if (isTimeInactive) {
    //   log({ stage: "MASTER_ORCHESTRATOR", message: "Short-circuiting due to inactive trading window." });
    //   const fallback: MasterOutput = {
    //     decision: {
    //       execute: false,
    //       state: "NO_TRADE",
    //       direction: "neutral",
    //       confidence: 1,
    //       score: 0,
    //       entry_zone: "none",
    //       notes: "Trading window inactive. Master orchestrator execution blocked by timing gate."
    //     },
    //     layers: {
    //       time: { session: "unknown", timing_bias: "neutral", notes: "No notes." },
    //       htf: { bias: "neutral", state: "unknown", tradable: false, pdArray: "", equilibrium: 0, range_high: 0, range_low: 0, notes: "No notes." },
    //       itf: { direction: "neutral", valid: false, notes: "No notes." },
    //       ltf: { direction: "neutral", execute: false, entry: "none", notes: "No notes." },
    //       confluence: { confirmed: false, strength: 0, notes: "No notes." }
    //     },
    //     metadata: {
    //       query: "",
    //       timestamp: new Date().toISOString(),
    //       processing_time_ms: 0,
    //       intent: { direction: "neutral" },
    //       fallback_used: true,
    //       fallback_reason: "Trading window inactive."
    //     },
    //     _raw: null,
    //     _pmso: null
    //   };
    //   StorageService.persistAnalysisOutput("master", "master-orchestrator", fallback);
    //   return fallback;
    // }

    const uncertaintyPressure =
      newsModifier?.uncertainty_pressure || 0;

    const volatilityPressure =
      newsModifier?.volatility_pressure || 0;

    const finalOutput: MasterOutput = {
      ...normalizedOutput,
      decision: {
        ...normalizedOutput.decision,

        confidence: Math.max(
          0,
          Math.min(
            1,
            normalizedOutput.decision.confidence *
            (1 - uncertaintyPressure * 0.3)
          )
        ),

        execute:
          normalizedOutput.decision.execute &&
          volatilityPressure < 0.8,

        state: normalizedOutput.decision.state,
        notes: (() => {
          const base = normalizedOutput.decision.notes || "";
          const why =
            newsModifier?.macro_ire?.why ||
            (newsModifier?.macro_context?.narrative
              ? `Macro/news WHY: ${newsModifier.macro_context.narrative}`
              : "");
          if (!why) return base;

          // Avoid duplicating WHY if LLM already included it
          if (base.toLowerCase().includes("macro/news why") || base.toLowerCase().includes("macro/news")) {
            return base;
          }
          return `${base ? `${base}\n` : ""}${why}`;
        })(),
      },
      _pmso: pmso, // Attach PMSO for observability
      _raw: llmResult,
      news_risk_modifier: {
        uncertainty_pressure: uncertaintyPressure,
        volatility_pressure: volatilityPressure
      },
      // Phase 4A/4B: surface macro/news conditioning + normalized macro IRE artifact.
      layers: {
        ...(normalizedOutput.layers as any),
        ...(newsModifier?.macro_context
          ? {
            macro_news: {
              macro_context: {
                ...newsModifier.macro_context
              },
              risk_modifiers: {
                uncertainty_pressure: uncertaintyPressure,
                volatility_pressure: volatilityPressure
              },
              ...(newsModifier?.macro_ire
                ? { macro_ire: newsModifier.macro_ire }
                : {})
            }
          }
          : {})
      },
    };

    if (isTimeInactive) {
      finalOutput.decision.execute = false;
      finalOutput.decision.state = "NO_TRADE";

      finalOutput.decision.notes =
        `Trading window inactive. ` +
        (finalOutput.decision.notes || "");

      finalOutput.metadata = {
        ...finalOutput.metadata,
        fallback_used: true,
        fallback_reason:
          "Execution blocked by inactive trading window."
      };
    }

    // FINAL_MACRO_TRACE: surface final macro/news modifier attached to master output
    log({
      stage: 'FINAL_MACRO_TRACE', message: 'Final macro/news modifier attached to master output', data: {
        attached_macro_context: finalOutput.layers?.macro_news?.macro_context,
        attached_macro_ire: finalOutput.layers?.macro_news?.macro_ire
      }
    });

    StorageService.persistAnalysisOutput("master", "master-orchestrator", finalOutput);

    return finalOutput;
  } catch (error) {
    log({ stage: "MASTER_ERROR", message: "Failed to articulate decision", data: { error }, level: "ERROR" });
    const ltfFallback = validatedInput?.ltf || {};
    const itfFallback = validatedInput?.itf || {};
    const htfFallback = validatedInput?.htf || {};
    const fallbackNotes = ltfFallback.reasoning || itfFallback.reasoning || htfFallback.reasoning || "System error during master orchestration.";
    const fallbackConfidence = typeof ltfFallback.confidence === 'number'
      ? ltfFallback.confidence
      : typeof itfFallback.confidence === 'number'
        ? itfFallback.confidence
        : typeof htfFallback.confidence === 'number'
          ? htfFallback.confidence
          : 0.0;

    const fallback: MasterOutput = {
      decision: {
        execute: !!ltfFallback.execute,
        state: ltfFallback.execute ? "READY" : "NO_TRADE",
        direction: ltfFallback.direction || "neutral",
        confidence: fallbackConfidence,
        score: 0,
        entry_zone: ltfFallback.entry || "none",
        notes: fallbackNotes,
      },
      layers: {
        time: { session: "unknown", timing_bias: "neutral", notes: "No notes." },
        htf: { bias: "neutral", state: "unknown", tradable: false, pdArray: "", equilibrium: 0, range_high: 0, range_low: 0, notes: htfFallback.reasoning || "No notes." },
        itf: { direction: itfFallback.itf_bias || "neutral", valid: false, notes: itfFallback.reasoning || "No notes." },
        ltf: { direction: ltfFallback.direction || "neutral", execute: !!ltfFallback.execute, entry: ltfFallback.entry || "none", notes: ltfFallback.reasoning || "No notes." },
        confluence: { confirmed: false, strength: ltfFallback.confluence_score || 0, notes: "No notes." },
      },
      metadata: { query: "", timestamp: new Date().toISOString(), processing_time_ms: 0, intent: { direction: ltfFallback.direction === 'bullish' ? 'long' : ltfFallback.direction === 'bearish' ? 'short' : 'neutral' }, fallback_used: true, fallback_reason: "Master orchestration failed; using LTF/ITF/HTF fallback." },
      _raw: null,
      _pmso: undefined
    };

    try {
      StorageService.persistAnalysisOutput("master", "master-orchestrator", fallback);
    } catch (e: any) {
      log({ stage: "MASTER_PERSIST_FALLBACK_ERROR", message: "Failed to persist fallback master output", data: { error: e?.message }, level: "ERROR" });
    }

    return fallback;
  }
}
