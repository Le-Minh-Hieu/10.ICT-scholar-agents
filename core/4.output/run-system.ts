import { runTimeOrchestrator } from "../3.query/orchestrators/time-orchestrator.js";
import { runHTFOrchestrator } from "../3.query/orchestrators/htf-orchestrator.js";
import { runITFOrchestrator } from "../3.query/orchestrators/itf-orchestrator.js";
import { runLTFOrchestrator } from "../3.query/orchestrators/ltf-orchestrator.js";
import { runMasterOrchestrator } from "../3.query/orchestrators/master-orchestrator.js";
import { buildITFInput, buildLTFInput, buildMasterInput } from "../3.query/orchestrator-input-builder.js";
import { sanitizeImageLog } from "../../shared/utils/log-utils.js";
import { log } from "../../shared/utils/logger.js";
import { SystemResult } from "../../types/system-results.js";
import { HTFOrchestratorOutput, ITFOrchestratorOutput, LTFOrchestratorOutput } from "../../shared/contracts/canonical.js";
import { PMSO, ProbabilisticValue } from "../../shared/contracts/pmso.js";
import { normalizeDirection, normalizeConfidence } from "./normalize-output.js";

import { hasMinimumData, getRequiredTF, isSymbolObject, INTERNAL_PIPELINE_KEYS } from "../../shared/utils/validation.js";

import { invalidateRetrievalCache } from "../3.query/retrieval-core.js";
import { StorageService } from "../../shared/services/storage-service.js";
import { HydrationContext } from "../../shared/contracts/context.js";
import { TimeframeThesis } from "../../shared/knowledge/hierarchical-types.js";
import { RelationalContext } from "../../shared/knowledge/relational-types.js";
import { ScenarioMemory } from "../../shared/knowledge/scenario-types.js";

import stagingEventStore from "../news/staging/staging-event-store.js";
import type { MacroReleaseEvent } from "../../types/macro";
import getLatestMacroHydration, { getLatestDailyHydration } from "../news/cognition/macro-context-hydrator.js";

export async function runSystem(input: any, options?: { debug?: boolean; capturePath?: string }): Promise<SystemResult> {
  // Pin a stable captureId for the entire run so all rag-debug dumps go into ONE folder.
  // If runAnalysis already set it from metadata.json, keep that value; otherwise mint one now.
  const _previousCaptureId = (global as any).currentCaptureId;
  if (!(global as any).currentCaptureId) {
    (global as any).currentCaptureId = `run-${Date.now()}`;
  }

  try {
    return await _runSystemInner(input, options);
  } finally {
    // Restore previous value (or clear) so a long-lived server doesn't leak IDs across runs.
    (global as any).currentCaptureId = _previousCaptureId;
  }
}

async function _runSystemInner(input: any, options?: { debug?: boolean; capturePath?: string }): Promise<SystemResult> {
  // Do not invalidate retrieval cache on every run; preserves historical retrievals
  // invalidateRetrievalCache();

  const inheritedTemporalState =
    input?._inheritedTemporalState ??
    null;

  const symbols = Object.keys(input).filter(k => !INTERNAL_PIPELINE_KEYS.includes(k) && isSymbolObject(input[k]));
  log({ stage: "OUTPUT_START", message: "Starting runSystem", data: { input: { symbols } } });

  if (options?.capturePath) {
    (global as any).currentCapturePath = options.capturePath;
  }

  // Pipeline Guard: Check for minimum data across all provided symbols
  for (const symbol of symbols) {
    if (typeof input[symbol] !== "object" || input[symbol] === null) continue;

    if (!hasMinimumData(symbol, input[symbol])) {
      log({ stage: "PIPELINE_GUARD", message: "Skipping pipeline due to insufficient data", data: { symbol }, level: "ERROR" });
      return {
        execute: false,
        direction: "neutral",
        confidence: 0.4,
        score: 0,
        entry: "none",
        reasoning: `Insufficient data for ${symbol}. Minimum required timeframes (${getRequiredTF(symbol).join(", ").toUpperCase()}) missing.`,
        layers: {
          time: { trading_window: "inactive", narrative: "Insufficient data" },
          htf: null,
          itf: null,
          ltf: null,
          master: null,
          confluence: null
        },
        state: "NO_TRADE",
        entry_zone: "none",
        notes: `Insufficient data for ${symbol}. Minimum required timeframes (${getRequiredTF(symbol).join(", ").toUpperCase()}) missing.`
      };
    }
  }

  // Use persisted PMSO if available, otherwise create default PMSO
  const pmso: PMSO = {
    market_context: {
      htf_bias: {
        value: 'neutral',
        confidence: 0,
        source: 'run-system',
        opposing_evidence: [],
        invalidation_triggers: [],
      },
      current_session: {
        value: 'unknown',
        confidence: 0,
        source: 'run-system',
        opposing_evidence: [],
        invalidation_triggers: [],
      },
      liquidity_state: {
        value: 'unknown',
        confidence: 0,
        source: 'run-system',
        opposing_evidence: [],
        invalidation_triggers: [],
      },
      market_mode: {
        value: 'unknown',
        confidence: 0,
        source: 'run-system',
        opposing_evidence: [],
        invalidation_triggers: [],
      },
    },
    tensions: {
      contradiction_score: 0,
      alternative_scenarios: [],
    },
    intermarket: {
      smt_detected: {
        value: false,
        confidence: 0,
        source: 'run-system',
        opposing_evidence: [],
        invalidation_triggers: [],
      },
      macro_pressure: {
        value: 'neutral',
        confidence: 0,
        source: 'run-system',
        opposing_evidence: [],
        invalidation_triggers: [],
      },
    },
    metadata: {
      last_updated: new Date().toISOString(),
      capture_id: (global as any).currentCapturePath || 'unknown',
    },
  };

  const MACRO_NEWS_EXPOSURE_CATEGORIES: Set<string> = new Set([
    "CPI",
    "PPI",
    "NFP",
    "FOMC",
    "ECB",
    "BOJ",
    "RATE_DECISION",
    "CENTRAL_BANK_SPEECH",
    "YIELDS_SHOCK",
    "RISK_OFF",
    "BANKING_STRESS",
    "GEOPOLITICAL",
    "OPTIONS_EXPIRY",
    "OPEX",
    "PMI",
    "GDP",
    "UNEMPLOYMENT",
  ]);

  const exposurePolicy = (() => {
    const shadowActive = stagingEventStore.getActiveEvents(true);
    const shadowActiveCount = shadowActive.length;

    // Note: exposure thresholds will be logged once after constants are defined.

    // Safe exposure defaults: only expose active, sufficiently confident macro events; bound count.
    const MIN_CONFIDENCE = 0.25;
    const MAX_EXPOSED = 25;

    // ICT macro focus: USD/EUR/GBP only.
    // Keep lifecycle/window activation broad by filtering only at the exposure bridge.
    const MACRO_EXPOSURE_CURRENCIES = new Set([
      "USD",
      "EUR",
      "GBP",
    ]);

    // Low-impact clutter suppression.
    // For now: exclude impact=LOW from exposure to reduce pressure noise.
    // (Keep lifecycle/window semantics broad by only filtering at this bridge.)
    const ALLOW_LOW_IMPACT = false;

    // EXPOSED TRACE: allowed sets / thresholds (log-only; no behavior changes)
    log({
      stage: "EXPOSURE_TRACE",
      message: "Exposure bridge thresholds + allowed sets",
      data: {
        shadow_active_count: shadowActiveCount,
        min_confidence: MIN_CONFIDENCE,
        allow_low_impact: ALLOW_LOW_IMPACT,
        allowed_categories: Array.from(MACRO_NEWS_EXPOSURE_CATEGORIES),
        allowed_currencies: Array.from(MACRO_EXPOSURE_CURRENCIES)
      }
    });


    const exposed = shadowActive
      .filter((ev: any) => {
        const cat = typeof ev?.category === "string" ? ev.category : "";
        const confidence = typeof ev?.confidence === "number" ? ev.confidence : 0;
        const inMacroCat = MACRO_NEWS_EXPOSURE_CATEGORIES.has(cat);
        const confOk = confidence >= MIN_CONFIDENCE;

        // EXPOSED TRACE: per-event predicate inputs
        const impactRaw = typeof ev?.impact === "string" ? ev.impact : undefined;
        const evCurrencyRaw = typeof ev?.currency === "string" ? ev.currency : undefined;
        const assetCurrenciesRaw = Array.isArray(ev?.affected_assets)
          ? ev.affected_assets
          : undefined;

        log({
          stage: "EXPOSURE_TRACE",
          message: "Exposure predicate inputs",
          data: {
            id: ev?.id,
            provider_id: ev?.provider_id,
            source_id: ev?.source_id,
            persistence_class: ev?.persistence_class,
            category: ev?.category,
            currency: evCurrencyRaw,
            impact: impactRaw,
            confidence: ev?.confidence,
            impact_score: ev?.impact_score,
            affected_assets: assetCurrenciesRaw,
            computed: { cat, inMacroCat, confOk }
          }
        });

        // Currency gate: prefer ev.currency (adapter sets this), fallback to affected_assets.
        const evCurrency = typeof ev?.currency === "string" ? ev.currency.trim().toUpperCase() : "";
        const assetCurrencies = Array.isArray(ev?.affected_assets)
          ? ev.affected_assets.map((a: any) => String(a).trim().toUpperCase())
          : [];

        const currencyOk =
          (evCurrency && MACRO_EXPOSURE_CURRENCIES.has(evCurrency)) ||
          assetCurrencies.some((a: string) => MACRO_EXPOSURE_CURRENCIES.has(a));

        // Impact gate: exclude LOW unless explicitly allowed.
        const impact = typeof ev?.impact === "string" ? ev.impact.toUpperCase() : "";
        const impactOk =
          impact !== "LOW" ||
          (ALLOW_LOW_IMPACT && (typeof ev?.impact_score === "number" ? ev.impact_score >= 0.6 : true));

        const passesExposure = inMacroCat && confOk && currencyOk && impactOk;

        // EXPOSED TRACE: per-event predicate results
        log({
          stage: "EXPOSURE_TRACE",
          message: "Exposure predicate results",
          data: {
            id: ev?.id,
            inMacroCat,
            confOk,
            currencyOk,
            impactOk,
            passesExposure
          }
        });

        return passesExposure;
      })
      .slice(0, MAX_EXPOSED);


    const exposedCategories = Array.from(
      new Set(exposed.map((e: any) =>
        typeof e?.category === "string"
          ? e.category
          : "UNKNOWN"
      ))
    );

    log({
      stage: "NEWS_EXPOSURE_POLICY",
      message: "Exposing shadow macro/news events to analysis hydration context",
      data: {
        shadow_active_count: shadowActiveCount,
        min_confidence: MIN_CONFIDENCE,
        max_exposed: MAX_EXPOSED,
        exposed_count: exposed.length,
        exposed_categories: exposedCategories,
        exposure_source:
          "stagingEventStore.getActiveEvents(includeShadow=true) -> macro category filter -> confidence threshold -> bounded slice",
      },
    });

    return exposed as any as MacroReleaseEvent[];
  })();

  const initialHydrationContext: HydrationContext = {
    parent_thesis: undefined,
    market_delivery_state: undefined,


    // New preferred raw events bridge.
    raw_calendar_events: exposurePolicy.length > 0 ? exposurePolicy : (input as any)?.macro_events,

    // Legacy compatibility during migration.
    news_events: exposurePolicy.length > 0 ? exposurePolicy : (input as any)?.macro_events,

    relational_context: {
      primary_asset: "EURUSD",
      external_influences: [],
      smt_hints: [],
      overall_relational_alignment: 0,
    },
    scenario_context: {
      active_scenarios: [],
      archived_scenarios: [],
      uncertainty_notes: "",
    },
    pmso_context: pmso,
    inherited_temporal_state: inheritedTemporalState,
  };

  log({
    stage: "TEMPORAL_TRACE_2",
    message: "runSystem initial hydration pre-flight",
    data: {
      inherited_exists: !!inheritedTemporalState,
      capture_count: inheritedTemporalState?.capture_count,
      structures: inheritedTemporalState?.structures?.length
    }
  });

  try {
    const [latestMacroHydration, latestDailyHydration] = await Promise.all([
      getLatestMacroHydration(),
      getLatestDailyHydration()
    ]);
    if (latestMacroHydration) {
      const activeEvents = Array.isArray(latestMacroHydration.active_events) ? latestMacroHydration.active_events : [];
      const adaptationHistory = Array.isArray(latestMacroHydration.adaptation_history) ? latestMacroHydration.adaptation_history : [];
      const narrativeHistory = Array.isArray(latestMacroHydration.narrative_history) ? latestMacroHydration.narrative_history : [];
      const lastAdaptationState = adaptationHistory.length > 0 ? adaptationHistory[adaptationHistory.length - 1] : null;
      const currentDate = new Date((global as any).currentDate || new Date().toISOString());
      const profileDate = latestMacroHydration?.week_start ? new Date(latestMacroHydration.week_start) : null;
      const staleDays = profileDate ? Math.floor((currentDate.getTime() - profileDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

      initialHydrationContext.weekly_profile = latestMacroHydration;

      // Legacy compatibility during migration.
      initialHydrationContext.macro_profile = latestMacroHydration;
      initialHydrationContext.macro_narrative = {
        narrative_state: latestMacroHydration.narrative_state,
        narrative_scope: latestMacroHydration.narrative_scope,
        narrative_as_of: latestMacroHydration.narrative_as_of,
        narrative_event_category: latestMacroHydration.narrative_event_category,
        macro_bias: latestMacroHydration.macro_bias,
        regime: latestMacroHydration.regime,
        narrative_confidence: latestMacroHydration.narrative_confidence,
        latest_adaptation_state: lastAdaptationState,
        active_events: activeEvents,
        macro_themes: latestMacroHydration.macro_themes || [],
        macro_timeline: latestMacroHydration.macro_timeline || [],
        retrieval_queries: latestMacroHydration.retrieval_queries || [],
        narrative_history: narrativeHistory.slice(-5),
      };
      initialHydrationContext.event_windows = {
        active: activeEvents.filter((event: any) => event?.lifecycle_phase === "ACTIVE" || event?.window_state === "active"),
        upcoming: activeEvents.filter((event: any) => event?.lifecycle_phase === "UPCOMING" || event?.window_state === "upcoming"),
        embargo: activeEvents.filter((event: any) => event?.embargo_active === true || event?.window_state === "embargo"),
        cooldown: activeEvents.filter((event: any) => event?.lifecycle_phase === "COOLDOWN" || event?.window_state === "cooldown"),
        post_event_stabilization: activeEvents.filter((event: any) => event?.lifecycle_phase === "POST_EVENT_STABILIZATION" || event?.window_state === "post_event_stabilization"),
      };

      log({
        stage: "[NEWS][HYDRATION]",
        message: "Loaded macro profile",
        data: {
          captureId: (global as any).currentCaptureId || "unknown",
          hasProfile: true,
          narrativeState: latestMacroHydration?.narrative_state,
          activeEvents: activeEvents.length,
          staleDays,
        }
      });
      if (typeof staleDays === "number" && staleDays > 10) {
        log({
          stage: "[NEWS][HYDRATION]",
          message: "Weekly macro profile appears stale",
          data: {
            captureId: (global as any).currentCaptureId || "unknown",
            weekStart: latestMacroHydration?.week_start,
            staleDays,
          },
          level: "WARN"
        });
      }
    } else {
      log({
        stage: "[NEWS][HYDRATION]",
        message: "Weekly macro profile unavailable",
        data: {
          captureId: (global as any).currentCaptureId || "unknown",
          hasProfile: false
        },
        level: "WARN"
      });
    }

    if (latestDailyHydration) {
      initialHydrationContext.daily_profile = latestDailyHydration;
      log({
        stage: "[NEWS][HYDRATION]",
        message: "Loaded daily profile",
        data: {
          captureId: (global as any).currentCaptureId || "unknown",
          marketDate: latestDailyHydration.market_date,
          weekday: latestDailyHydration.market_weekday,
          catalysts: Array.isArray(latestDailyHydration.todays_catalysts) ? latestDailyHydration.todays_catalysts.length : 0
        }
      });
    } else {
      log({
        stage: "[NEWS][HYDRATION]",
        message: "Daily profile unavailable",
        data: {
          captureId: (global as any).currentCaptureId || "unknown"
        },
        level: "WARN"
      });
    }
  } catch (error: any) {
    log({
      stage: "[NEWS][HYDRATION]",
      message: "Macro hydration unavailable",
      data: {
        captureId: (global as any).currentCaptureId || "unknown",
        error: error?.message
      },
      level: "WARN"
    });
  }

  log({
    stage: "NEWS_INPUT",
    message: "Macro events received at runSystem entry (post-exposure-bridge)",
    data: {
      raw_calendar_events_count: initialHydrationContext.raw_calendar_events?.length || 0,
      sample: initialHydrationContext.raw_calendar_events?.slice(0, 2),
      passed_to_master_orchestrator_raw_calendar_events_count:
        initialHydrationContext.raw_calendar_events?.length || 0,
      exposurePolicy_count: exposurePolicy.length,
      weekly_profile_loaded: !!initialHydrationContext.weekly_profile,
      daily_profile_loaded: !!initialHydrationContext.daily_profile
    },
  });

  // Surface canonical macro context propagation trace
  log({ stage: "MACRO_CONTEXT_PROPAGATION", message: "Initial hydration context created", data: { pmso_present: !!initialHydrationContext.pmso_context, pmso_snapshot: ((initialHydrationContext.pmso_context?.metadata as any)?.cognition_id) || null, raw_calendar_events: (initialHydrationContext.raw_calendar_events || []).length, has_weekly_profile: !!initialHydrationContext.weekly_profile, has_daily_profile: !!initialHydrationContext.daily_profile } });

  try {
    console.log("RUNNING TIME ORCHESTRATOR");
    log({ stage: "BOUNDARY_TRACE", message: "Calling Time Orchestrator", data: { stage: "runSystem -> TimeOrchestrator" } });
    const timeResult = await runTimeOrchestrator(input, initialHydrationContext);
    validateOrchestratorOutput("TIME", timeResult);

    // Phase 2: time-layer hydration into shared PMSO context (minimal delta)
    // Ensures downstream hydration has non-default session/timing cognition.
    const timeConfidence = typeof timeResult.confidence === 'number' ? timeResult.confidence : 0;
    const hydratedSession: ProbabilisticValue<string> = {
      value:
        timeResult.trading_window === "inactive"
          ? "inactive_session"
          : "active_session",
      confidence: timeConfidence,
      source: "time-orchestrator:hydration",
      opposing_evidence: [],
      invalidation_triggers: []
    };

    const pmsoContext = initialHydrationContext.pmso_context;

    if (pmsoContext) {
      initialHydrationContext.pmso_context = {
        ...pmsoContext,
        market_context: {
          ...pmsoContext.market_context,
          current_session: hydratedSession
        }
      };
    }

    if (pmsoContext) {
      log({
        stage: "PM_SO_HYDRATION_TIME",
        message: "Hydrated current_session from TimeOrchestrator",
        data: {
          value: pmsoContext.market_context.current_session.value,
          confidence: timeConfidence,
          trading_window: timeResult.trading_window,
          timing_bias: timeResult.timing_bias
        }
      });
    }

    log({ stage: "FLOW", message: "DONE TIME", data: { output: { trading_window: timeResult.trading_window, narrative: timeResult.narrative } } });


    console.log("RUNNING HTF ORCHESTRATOR");
    log({ stage: "FLOW", message: "CALL HTF" });
    log({ stage: "BOUNDARY_TRACE", message: "Calling HTF Orchestrator", data: { stage: "runSystem -> HTFOrchestrator" } });
    const htfResponse = await runHTFOrchestrator(input as any, initialHydrationContext);
    const itfHydrationContext = htfResponse.hydrationContext;
    const htfResult = {
      ...htfResponse,
      htf_bias: normalizeDirection(htfResponse.htf_bias),
      next_candle_bias: normalizeDirection(htfResponse.next_candle_bias),
      confidence: normalizeConfidence(htfResponse.confidence)
    };
    validateOrchestratorOutput("HTF", htfResult);
    log({ stage: "FLOW", message: "DONE HTF", data: { output: { htf_bias: htfResult.htf_bias, confidence: htfResult.confidence } } });

    console.log("RUNNING ITF ORCHESTRATOR");
    log({ stage: "FLOW", message: "CALL ITF" });
    log({ stage: "BOUNDARY_TRACE", message: "Calling ITF Orchestrator", data: { stage: "runSystem -> ITFOrchestrator" } });
    const itfInput = buildITFInput(htfResult, itfHydrationContext);
    const itfResponse = await runITFOrchestrator({ ...input, htf: itfInput } as any, itfHydrationContext);
    const ltfHydrationContext = itfResponse.hydrationContext;
    const itfResult = {
      ...itfResponse,
      itf_bias: normalizeDirection(itfResponse.itf_bias),
      confidence: normalizeConfidence(itfResponse.confidence)
    };
    validateOrchestratorOutput("ITF", itfResult);
    log({ stage: "FLOW", message: "DONE ITF", data: { output: { itf_bias: itfResult.itf_bias, confidence: itfResult.confidence } } });

    console.log("RUNNING LTF ORCHESTRATOR");
    log({ stage: "FLOW", message: "CALL LTF" });
    log({ stage: "BOUNDARY_TRACE", message: "Calling LTF Orchestrator", data: { stage: "runSystem -> LTFOrchestrator" } });
    const ltfInput = buildLTFInput(itfInput, itfResult, ltfHydrationContext);
    const ltfResponse = await runLTFOrchestrator({ ...input, htf: htfResult, itf: itfResult }, ltfHydrationContext);
    const ltfResult = ltfResponse;

    // Fail-fast guard for LTF pipeline
    const ltfComplete = ltfResult && ltfResult.execute !== undefined;
    if (!ltfComplete) {
      log({ stage: "PIPELINE_GUARD", message: "LTF pipeline incomplete. Halting execution.", data: { ltfResult }, level: "ERROR" });
      // You might want to return a specific error response here
      return {
        execute: false,
        direction: "neutral",
        confidence: 0.4,
        score: 0,
        entry: "none",
        reasoning: "LTF pipeline failed to produce a complete result.",
        layers: {
          time: timeResult,
          htf: htfResult,
          itf: itfResult,
          ltf: ltfResult,
          master: null,
          confluence: null
        },
        state: "NO_TRADE",
        entry_zone: "none",
        notes: "LTF pipeline failed to produce a complete result."
      };
    }
    const masterHydrationContext = ltfResponse.hydrationContext;
    const validatedLtfResult = {
      ...ltfResponse,
      direction: normalizeDirection(ltfResult.direction),
      confidence: normalizeConfidence(ltfResult.confidence)
    };
    validateOrchestratorOutput("LTF", validatedLtfResult);
    log({ stage: "FLOW", message: "DONE LTF", data: { output: { execute: validatedLtfResult.execute, confidence: validatedLtfResult.confidence } } });

    console.log("RUNNING MASTER ORCHESTRATOR");
    log({
      stage: "BOUNDARY_TRACE", message: "Calling Master Orchestrator", data: {
        stage: "runSystem -> MasterOrchestrator",
        input: {
          hasTime: !!timeResult,
          hasHTF: !!htfResult,
          hasITF: !!itfResult,
          hasLTF: !!validatedLtfResult
        }
      }
    });

    const masterInput = buildMasterInput(htfResult, itfResult, validatedLtfResult, timeResult, masterHydrationContext);
    const rawResult = await runMasterOrchestrator(masterInput);
    validateOrchestratorOutput("MASTER", rawResult);

    const baseResponse: SystemResult = {
      execute: rawResult.decision.execute,
      state: rawResult.decision.state,
      direction: normalizeDirection(rawResult.decision.direction),
      confidence: normalizeConfidence(rawResult.decision.confidence),
      score: rawResult.decision.score,
      entry_zone: rawResult.decision.entry_zone,
      notes: rawResult.decision.notes,
      reasoning: rawResult.decision.notes,
      entry: rawResult.decision.entry_zone,
      layers: {
        time: timeResult,
        htf: htfResult,
        itf: itfResult,
        ltf: validatedLtfResult,
        confluence: rawResult._confluence,
        master: rawResult
      },
      _raw: rawResult._raw,
      _pmso: rawResult._pmso
    };

    const runId = (global as any).currentCaptureId || Date.now().toString();

    if (options?.debug) {
      const mapAgents = (layer: any) => {
        if (!layer || !layer._debug) return [];
        return Object.entries(layer._debug).map(([key, val]: [string, any]) => ({
          name: key,
          expandedQueries: val?._debug?.expandedQueries || [],
          topKChunks: val?._debug?.topKChunks || 0,
          grounded: val?._debug?.grounded || "",
          output: val,
          confidence: val?.confidence || 0
        }));
      };

      return {
        ...baseResponse,
        debug: {
          master: rawResult._debug,
          agents: {
            htf: mapAgents(htfResult),
            itf: mapAgents(itfResult),
            ltf: mapAgents(validatedLtfResult),
            time: mapAgents(timeResult),
            confluence: mapAgents(rawResult._confluence)
          }
        }
      };
    }

    log({ stage: "OUTPUT_END", message: "runSystem complete", data: { output: baseResponse } });

    return baseResponse;
  } catch (error) {
    const errorPayload = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    log({ stage: "SYSTEM_FAILURE", message: "An unhandled error occurred in the system", level: "ERROR", data: { error: errorPayload } });
    return {
      execute: false,
      direction: "neutral",
      confidence: 0.4,
      score: 0,
      entry: "none",
      reasoning: "A critical error occurred during the run.",
      layers: {
        time: null,
        htf: null,
        itf: null,
        ltf: null,
        master: null,
        confluence: null
      },
      state: "NO_TRADE",
      entry_zone: "none",
      notes: "A critical error occurred during the run."
    };
  }
}

/**
 * Basic Schema Validation for Orchestrator Outputs
 */
function validateOrchestratorOutput(stage: string, output: any) {
  if (!output) {
    log({ stage: "SCHEMA_CHECK", message: `Missing output for ${stage}`, data: { stage, status: "ERROR" }, level: "ERROR" });
    return;
  }

  const missingFields: string[] = [];

  if (stage === "TIME") {
    if (!output.trading_window) missingFields.push("trading_window");
  } else if (stage === "HTF") {
    if (!output.htf_bias) missingFields.push("htf_bias");
  } else if (stage === "ITF") {
    if (!output.itf_bias) missingFields.push("itf_bias");
  } else if (stage === "LTF") {
    if (output.execute === undefined) missingFields.push("execute");
  } else if (stage === "MASTER") {
    if (!output.decision) {
      missingFields.push("decision");
    } else {
      if (output.decision.execute === undefined) {
        missingFields.push("decision.execute");
      }

      if (!output.decision.direction) {
        missingFields.push("decision.direction");
      }
    }
  }

  if (missingFields.length > 0) {
    log({
      stage: "SCHEMA_CHECK", message: `Incomplete output for ${stage}`, data: {
        stage,
        missingFields,
        status: "WARN"
      }, level: "WARN"
    });
  } else {
    log({ stage: "SCHEMA_CHECK", message: `Validation passed for ${stage}`, data: { stage, status: "SUCCESS" }, level: "DEBUG" });
  }
}
