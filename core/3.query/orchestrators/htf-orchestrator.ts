
/// <reference types="node" />

import "dotenv/config";
import { callLLM } from "../../../shared/utils/llm-utils.js";
import { validateHTFBias } from "../../../shared/utils/htf-bias-validator.js";
import { log } from "../../../shared/utils/logger.js";
import { htfStructureAgent } from "../agents/htf/htf-structure-agent.js";
import { htfMacroAgent } from "../agents/htf/htf-macro-agent.js";
import { htfLiquidityAgent } from "../agents/htf/htf-liquidity-agent.js";
import { htfPDArrayAgent } from "../agents/htf/htf-pd-array-agent.js";
import { validateSymbolData, INTERNAL_PIPELINE_KEYS, isSymbolObject } from "../../../shared/utils/validation.js";

import { runSafeAgent as originalRunSafeAgent, AgentRunResult } from "../../../shared/utils/agent-executor.js";
import { HydrationContext } from "../../../shared/contracts/context.js";
import { TimeframeThesis, HierarchicalMemory } from "../../../shared/knowledge/hierarchical-types.js";
import {
  RelationalContext,
  SMTSignal,
  ExternalInfluence
} from "../../../shared/knowledge/relational-types.js";
import { ScenarioMemory } from "../../../shared/knowledge/scenario-types.js";
import { PMSO } from "../../../shared/contracts/pmso.js";
import { summarizeTimeframeThesis } from "../hierarchical-summarizer.js";
import { HTFOrchestratorOutputSchema, HTFOrchestratorOutput } from "../../../shared/contracts/canonical.js";
import { zodToToolSchema } from "../../../shared/utils/zod-to-tool.js";
import { StorageService } from "../../../shared/services/storage-service.js";
import { PMSOReconciler } from "../reconciler.js";

import { buildPrompt } from "../prompt-builder.js";
import { sanitizeForOrchestration } from "../agents/shared/base-agent.js";



import type { HTFOrchestratorInput } from "../../../shared/contracts/htf/orchestrator-input.js";


const htfTool = [{
  functionDeclarations: [{
    name: "generateHTFOutput",
    description: "Generate the HTF Orchestrator output based on input agents",
    parameters: zodToToolSchema(HTFOrchestratorOutputSchema.omit({ structure_state: true, macro_state: true, liquidity_state: true, pd_array_state: true, _debug: true, _raw: true }))
  }]
}];

function buildSeedRelationalContext(
  structureFacts: any[],
  macroFacts: any[]
): RelationalContext {

  const smt_hints: SMTSignal[] = [];

  const external_influences:
    ExternalInfluence[] = [];

  // SMT extraction
  for (const fact of structureFacts || []) {

    const factText =
      typeof fact === "string"
        ? fact
        : `
        ${fact?.type ?? ""}
        ${fact?.anchor ?? ""}
        ${fact?.raw_output?.reasoning ?? ""}
      `;

    const lower =
      factText.toLowerCase();

    if (lower.includes("smt")) {

      const bearish =
        lower.includes("bearish");

      smt_hints.push({
        assets: ["EURUSD", "GBPUSD"],

        type:
          bearish
            ? "BEARISH_SMT"
            : "BULLISH_SMT",

        divergence_type:
          bearish
            ? "HH_VS_LH"
            : "LL_VS_HL",

        confidence:
          typeof fact?.confidence === "number"
            ? fact.confidence
            : 0.5,

        is_at_pd_array: true,

        notes:
          typeof fact === "string"
            ? fact
            : fact?.anchor || "SMT detected"
      });
    }
  }

  // Macro extraction
  for (const fact of macroFacts || []) {

    const factText =
      typeof fact === "string"
        ? fact
        : `
        ${fact?.type ?? ""}
        ${fact?.anchor ?? ""}
        ${fact?.raw_output?.reasoning ?? ""}
      `;

    const lower =
      factText.toLowerCase();

    // DXY
    if (lower.includes("dxy")) {

      const bearish =
        lower.includes("bearish");

      external_influences.push({
        source_asset: "DXY",

        relationship:
          "INVERSE_CORRELATION",

        direction:
          bearish
            ? "BULLISH_PRESSURE"
            : "BEARISH_PRESSURE",

        confidence:
          typeof fact?.confidence === "number"
            ? fact.confidence
            : 0.5,

        temporal_decay: 1.0
      });
    }

    // yields
    if (
      lower.includes("yield") ||
      lower.includes("us10y") ||
      lower.includes("us20y")
    ) {

      const rising =
        lower.includes("rising");

      external_influences.push({
        source_asset: "YIELDS",

        relationship:
          "INVERSE_CORRELATION",

        direction:
          rising
            ? "BEARISH_PRESSURE"
            : "BULLISH_PRESSURE",

        confidence:
          typeof fact?.confidence === "number"
            ? fact.confidence
            : 0.5,

        temporal_decay: 1.0
      });
    }
  }

  // alignment score
  let score = 0;

  for (const s of smt_hints) {
    score +=
      s.type === "BULLISH_SMT"
        ? s.confidence
        : -s.confidence;
  }

  for (const e of external_influences) {
    score +=
      e.direction === "BULLISH_PRESSURE"
        ? e.confidence
        : -e.confidence;
  }

  const divisor =
    smt_hints.length +
    external_influences.length;

  const alignment =
    divisor > 0
      ? Math.max(-1, Math.min(1, score / divisor))
      : 0;

  const uniqueInfluences =
    Array.from(
      new Map(
        external_influences.map(
          i => [`${i.source_asset}-${i.direction}`, i]
        )
      ).values()
    );

  const uniqueSMT =
    Array.from(
      new Map(
        smt_hints.map(
          s => [`${s.type}-${s.divergence_type}`, s]
        )
      ).values()
    );

  return {
    primary_asset: "EURUSD",

    external_influences:
      uniqueInfluences,

    smt_hints:
      uniqueSMT,

    overall_relational_alignment:
      alignment
  };
}

export async function runHTFOrchestrator(
  input: HTFOrchestratorInput,
  hydrationContext: HydrationContext
): Promise<HTFOrchestratorOutput & { hydrationContext: HydrationContext }> {
  log({ stage: "HTF_ORCHESTRATOR", message: "Starting HTF Orchestrator", data: { input } });
  const macroProfile =
    (hydrationContext as any)?.weekly_profile ??
    (hydrationContext as any)?.macro_profile;

  const macroNarrative =
    (hydrationContext as any)?.macro_narrative ??
    (macroProfile ? {
      narrative_state: macroProfile?.narrative_state,
      macro_bias: macroProfile?.macro_bias,
      narrative_confidence: macroProfile?.narrative_confidence
    } : null);
  if (macroNarrative) {
    log({
      stage: "[NEWS][AGENT]",
      message: "HTF received macro narrative",
      data: {
        timeframe: "HTF",
        narrative_state:
          macroNarrative.narrative_state,

        macro_bias:
          macroNarrative.macro_bias,

        confidence:
          macroNarrative.narrative_confidence
      }
    });
  }

  // Validate HTF Specific Input (use canonical pipeline keys and symbol classifier)
  const symbols = Object.keys(input).filter(k => !INTERNAL_PIPELINE_KEYS.includes(k) && isSymbolObject(input[k]));
  for (const symbol of symbols) {
    log({
      stage: "INPUT_CHECK", message: "HTF INPUT", data: {
        hasSymbol: !!input[symbol],
        tfKeys: Object.keys(input[symbol] || {})
      }
    });
    const { missing } = validateSymbolData(symbol, input[symbol]);
    if (missing.length > 0) {
      log({ stage: "HTF_ORCHESTRATOR", message: `Missing TFs for ${symbol} in HTF analysis`, data: { symbol, missing }, level: "WARN" });
    }
  }

  // 1. Execute agents safely in parallel
  log({ stage: "HTF_STEP", message: "START" });

  const runSafeAgent = originalRunSafeAgent;

  const agentPromises = [
    runSafeAgent("htfStructureAgent", () => (htfStructureAgent as any)(input, { parent_thesis: hydrationContext.parent_thesis })),
    runSafeAgent("htfMacroAgent", () => (htfMacroAgent as any)(input, { parent_thesis: hydrationContext.parent_thesis })),
    runSafeAgent("htfLiquidityAgent", () => (htfLiquidityAgent as any)(input, { parent_thesis: hydrationContext.parent_thesis })),
    runSafeAgent("htfPDArrayAgent", () => (htfPDArrayAgent as any)(input, { parent_thesis: hydrationContext.parent_thesis }))
  ];

  const [structureResult, macroResult, liquidityResult, pdArrayResult] = await Promise.all(agentPromises);

  log({ stage: "HTF_STEP", message: "AGENTS_DONE" });

  // Check for agent failures
  if (structureResult.status !== 'SUCCESS') {
    log({ stage: "HTF_ORCHESTRATOR", message: "htfStructureAgent failed. Aborting HTF orchestration.", level: "ERROR", data: structureResult._meta });
    throw new Error("HTF Orchestrator failed due to htfStructureAgent failure.");
  }
  if (macroResult.status !== 'SUCCESS') {
    log({ stage: "HTF_ORCHESTRATOR", message: "htfMacroAgent failed. Aborting HTF orchestration.", level: "ERROR", data: macroResult._meta });
    throw new Error("HTF Orchestrator failed due to htfMacroAgent failure.");
  }
  if (liquidityResult.status !== 'SUCCESS') {
    log({ stage: "HTF_ORCHESTRATOR", message: "htfLiquidityAgent failed. Aborting HTF orchestration.", level: "ERROR", data: liquidityResult._meta });
    throw new Error("HTF Orchestrator failed due to htfLiquidityAgent failure.");
  }
  if (pdArrayResult.status !== 'SUCCESS') {
    log({ stage: "HTF_ORCHESTRATOR", message: "htfPDArrayAgent failed. Aborting HTF orchestration.", level: "ERROR", data: pdArrayResult._meta });
    throw new Error("HTF Orchestrator failed due to htfPDArrayAgent failure.");
  }

  const combinedInput = {
    structure: sanitizeForOrchestration(structureResult.data ?? {}),
    macro: sanitizeForOrchestration(macroResult.data ?? {}),
    liquidity: sanitizeForOrchestration(liquidityResult.data ?? {}),
    pd_array: sanitizeForOrchestration(pdArrayResult.data ?? {}),
    weekly_profile: macroProfile
      ? {
        week_type: macroProfile.week_type,
        macro_bias: macroProfile.macro_bias,
        narrative_confidence:
          macroProfile.narrative_confidence,

        regime: macroProfile.regime,

        macro_ire: macroProfile.macro_ire,

        active_events:
          macroProfile.active_events?.slice(0, 5)
      }
      : undefined,
  };

  const fullPromptEstimate =
    Math.ceil(
      JSON.stringify({
        structure: structureResult.data ?? {},
        macro: macroResult.data ?? {},
        liquidity: liquidityResult.data ?? {},
        pd_array: pdArrayResult.data ?? {},
        macro_summary: combinedInput.weekly_profile,
      }).length / 4
    );
  const compactPromptEstimate =
    Math.ceil(JSON.stringify(combinedInput).length / 4);
  log({
    stage: "[ORCHESTRATION][SANITIZE]",
    message: "Sanitized HTF orchestration payload",
    data: {
      removed_debug_keys: ["_debug", "_raw"],
      full_estimated_tokens: fullPromptEstimate,
      compact_estimated_tokens: compactPromptEstimate,
    }
  });
  log({
    stage: "[ORCHESTRATION][COMPACT_STATE]",
    message: "HTF orchestration switched to compact state",
    data: {
      before_token_estimate: fullPromptEstimate,
      after_token_estimate: compactPromptEstimate,
      reduction_pct: fullPromptEstimate > 0
        ? Number((((fullPromptEstimate - compactPromptEstimate) / fullPromptEstimate) * 100).toFixed(1))
        : 0,
      removed_fields: ["_debug", "_raw", "full narrative payloads"],
    }
  });

  log({
    stage: "COMBINED", message: "HTF", data: {
      structure: !!structureResult.data,
      macro: !!macroResult.data,
      liquidity: !!liquidityResult.data,
      pd_array: !!pdArrayResult.data
    }
  });

  const prompt = buildPrompt({
    role: "You are an HTF Orchestrator.",
    task: "Determine:\n1. HTF bias (bullish or bearish)\n2. Next candle bias (bullish or bearish)",
    inputContext: JSON.stringify(combinedInput, null, 2),
    constraints: [
      "You MUST ONLY use the provided input",
      "You MUST NOT introduce new concepts or external knowledge",
      "You MUST NOT assume anything outside the input",
      "You MUST resolve conflicts explicitly",
      "Every conclusion MUST be supported by evidence from input",
      "The following fields are required: htf_bias, next_candle_bias, confidence, dominant_factors, reasoning",
      "You are NOT a rule executor.",
      "You must follow this reasoning framework:\n1. **Form Primary Bias:** Use a combined reading of the `structure` and `macro` agent outputs to establish a primary directional bias. `structure` provides the foundational market direction, while `macro` provides the broader economic context.\n2. **Confirm with Liquidity:** Use the `liquidity` agent's output to confirm or question the primary bias. If the identified liquidity targets (the draw on liquidity) align with the primary bias, confidence increases. If they oppose the primary bias, this is a significant conflict that must be explained in the `reasoning` and should lower the `confidence` score.\n3. **Use PD Array for Context:** Use the `pd_array` agent's output to understand the current price location. Is price in a premium or discount zone? This provides context for the potential moves identified in the other steps.",
      "Respond by calling the \"generateHTFOutput\" tool with the exact JSON structure required."
    ],
    outputFormat: ""
  }, hydrationContext);

  // Use structured output via function calling
  const rawLlmResult = await callLLM(
    prompt,
    "HTF-Orchestrator",
    Date.now().toString(),
    [{ text: prompt }],
    { tools: htfTool, useStructured: true, schema: HTFOrchestratorOutputSchema, returnTelemetry: true }
  );

  const llmResult = rawLlmResult.data as HTFOrchestratorOutput;
  const telemetry = rawLlmResult.telemetry;
  telemetry.payload_sizes = {
    structure: JSON.stringify(combinedInput.structure).length,
    macro: JSON.stringify(combinedInput.macro).length,
    liquidity: JSON.stringify(combinedInput.liquidity).length,
    pd_array: JSON.stringify(combinedInput.pd_array).length,
  };

  log({
    stage: "HTF_ORCHESTRATOR", message: "HTF Orchestrator complete", data: {
      htf_bias: llmResult.htf_bias,
      confidence: llmResult.confidence
    }
  });

  // Generate DAILY Thesis for Hierarchical Memory
  const dailyThesis = await summarizeTimeframeThesis(
    "DAILY",
    [structureResult.data, macroResult.data, liquidityResult.data, pdArrayResult.data],
    [], // No retrieved chunks at this level
    hydrationContext.parent_thesis
  );

  const pmsoContext = hydrationContext.pmso_context;
  let updatedPmsoContext = pmsoContext;
  if (pmsoContext) {
    const normalizedHTFBias =
      llmResult.htf_bias === "bullish" ||
        llmResult.htf_bias === "bearish"
        ? llmResult.htf_bias
        : "neutral";

    const htfFacts = PMSOReconciler.extractFactsFromOutputs([
      structureResult.data,
      liquidityResult.data,
      pdArrayResult.data
    ]);

    const updatedMarketContext = {
      ...pmsoContext.market_context,

      htf_bias: {
        value: normalizedHTFBias,
        confidence: llmResult.confidence,
        source: "htf-orchestrator:hydration",
        opposing_evidence: [],
        invalidation_triggers: []
      },

      market_mode:
        PMSOReconciler.reconcileMarketMode(htfFacts),

      liquidity_state:
        PMSOReconciler.reconcileLiquidityState(htfFacts)
    };

    updatedPmsoContext = {
      ...pmsoContext,
      market_context:
        updatedMarketContext as any
    };

    log({
      stage: "PM_SO_HYDRATION_HTF",
      message: "Hydrated HTF PMSO delta",
      data: {
        htf_bias:
          updatedMarketContext.htf_bias,

        market_mode:
          updatedMarketContext.market_mode,

        liquidity_state:
          updatedMarketContext.liquidity_state
      }
    });
  }

  const relationalContext =
    buildSeedRelationalContext(
      (structureResult.data as any)?.facts || [],
      (macroResult.data as any)?.facts || []
    );

  const newHydrationContext: HydrationContext = {
    ...hydrationContext,

    // MARKET_DELIVERY_STATE_V1_HEURISTIC
    // paradigm heuristic is intentionally deterministic + conservative:
    // - It does NOT attempt to mirror ICT macro delivery windows.
    // - It uses weekly_profile/week_type + HTF macro regime/bias as primary anchors.
    // - Only produces one of: consolidation | expansion | retracement | reversal.
    market_delivery_state: (() => {
      const base =
        llmResult?.htf_bias === "bullish"
          ? { regime: "bullish_delivery" as const, confidence: llmResult.confidence }
          : llmResult?.htf_bias === "bearish"
            ? { regime: "bearish_delivery" as const, confidence: llmResult.confidence }
            : undefined;

      if (!base) return undefined;

      const weeklyProfile = macroProfile;
      const weeklyType: string | undefined =
        weeklyProfile?.week_type ?? (weeklyProfile as any)?.narrative_event_category ?? undefined;

      const macroRegime: string | undefined = weeklyProfile?.regime;

      // Conservative mapping:
      // - If macro regime implies a shift (bearish/bullish delivery extremes) -> reversal.
      // - If weekly type suggests stabilization/accumulation -> consolidation.
      // - If weekly type suggests trend/continuation -> expansion.
      // - Otherwise default to consolidation.
      const paradigm =
        typeof macroRegime === "string" && ["reversal", "transition", "chop-to-trend", "choppy-to-trend"].some(k =>
          macroRegime.toLowerCase().includes(k)
        )
          ? "reversal"
          : typeof weeklyType === "string" && /accumulation|consolidation|range|chop/i.test(weeklyType)
            ? "consolidation"
            : typeof weeklyType === "string" && /expansion|trend|impulse|continuation|breakout/i.test(weeklyType)
              ? "expansion"
              : typeof weeklyType === "string" && /retracement|pullback|mean[-\s]?revert|retrace/i.test(weeklyType)
                ? "retracement"
                : "consolidation";

      return {
        ...base,
        paradigm: paradigm as any
      };
    })(),

    pmso_context:
      pmsoContext
        ? updatedPmsoContext
        : hydrationContext.pmso_context,


    parent_thesis: dailyThesis,

    relational_context:
      relationalContext,

    minimal_context: {
      htf_bias: llmResult.htf_bias,

      next_candle_bias:
        llmResult.next_candle_bias,

      confidence:
        llmResult.confidence,

      dominant_factors:
        llmResult.dominant_factors,

      reasoning_summary:
        llmResult.reasoning,

      // enrichment hydration
      parent_thesis:
        dailyThesis,

      pmso_context:
        pmsoContext
          ? updatedPmsoContext
          : hydrationContext.pmso_context,

      relational_context:
        relationalContext,

      scenario_context:
        hydrationContext.scenario_context
    }
  };


  const finalOutput = {
    ...llmResult,
    structure_state: combinedInput.structure,
    macro_state: combinedInput.macro,
    liquidity_state: combinedInput.liquidity,
    pd_array_state: combinedInput.pd_array,
    _debug: {
      agents: {
        structure: structureResult,
        macro: macroResult,
        liquidity: liquidityResult,
        pd_array: pdArrayResult,
      },
      telemetry,
    },
    _raw: llmResult
  };

  StorageService.persistAnalysisOutput('htf', 'htf-orchestrator', finalOutput);
  return { ...finalOutput, hydrationContext: newHydrationContext };
}
