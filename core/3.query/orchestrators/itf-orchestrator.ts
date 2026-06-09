
/// <reference types="node" />

import "dotenv/config";
import { callLLM } from "../../../shared/utils/llm-utils.js";
import { log } from "../../../shared/utils/logger.js";
import { itfStructureAgent } from "../agents/itf/itf-structure-agent.js";
import { isSymbolObject, validateSymbolData, INTERNAL_PIPELINE_KEYS } from "../../../shared/utils/validation.js";
import { itfLiquidityAgent } from "../agents/itf/itf-liquidity-agent.js";
import { itfPDArrayAgent } from "../agents/itf/itf-pd-array-agent.js";
import { itfSetupAgent } from "../agents/itf/itf-setup-agent.js";

import { runSafeAgent as originalRunSafeAgent, AgentRunResult } from "../../../shared/utils/agent-executor.js";
import { HydrationContext } from "../../../shared/contracts/context.js";
import { TimeframeThesis, HierarchicalMemory } from "../../../shared/knowledge/hierarchical-types.js";
import { RelationalContext } from "../../../shared/knowledge/relational-types.js";
import { ScenarioMemory } from "../../../shared/knowledge/scenario-types.js";
import { PMSO } from "../../../shared/contracts/pmso.js";
import { summarizeTimeframeThesis } from "../hierarchical-summarizer.js";
import { ITFOrchestratorOutputSchema, ITFOrchestratorOutput, Confidence, HTFOrchestratorOutput } from "../../../shared/contracts/canonical.js";
import { zodToToolSchema } from "../../../shared/utils/zod-to-tool.js";
import { StorageService } from "../../../shared/services/storage-service.js";

import { buildPrompt } from "../prompt-builder.js";
import { sanitizeForOrchestration } from "../agents/shared/base-agent.js";



import type { ITFOrchestratorInput } from "../../../shared/contracts/itf/orchestrator-input.js";


const itfTool = [{
  functionDeclarations: [{
    name: "generateITFOutput",
    parameters: zodToToolSchema(ITFOrchestratorOutputSchema.omit({ structure: true, liquidity: true, pd_array: true, setup: true, _debug: true, _raw: true }))
  }]
}];

export async function runITFOrchestrator(
  input: ITFOrchestratorInput,
  hydrationContext: HydrationContext
): Promise<ITFOrchestratorOutput & { hydrationContext: HydrationContext }> {
  log({ stage: "ITF_ORCHESTRATOR", message: "Starting ITF Orchestrator", data: { input } });
  const macroSummary = (hydrationContext?.minimal_context as any)?.macro_news_summary;
  if (macroSummary) {
    log({ stage: "[NEWS][AGENT]", message: "ITF received compact macro cognition", data: { timeframe: "ITF", volatilityRegime: macroSummary.volatility_regime, continuationRetracementExpectation: macroSummary.continuation_retracement_expectation } });
  }

  const pmsoContext = hydrationContext.pmso_context;

  if (pmsoContext) {
    log({
      stage: "PMSO_PROPAGATION_ITF",
      message: "ITF received hydrated PMSO context",
      data: {
        current_session:
          pmsoContext.market_context.current_session,

        htf_bias:
          pmsoContext.market_context.htf_bias,

        market_mode:
          pmsoContext.market_context.market_mode,

        liquidity_state:
          pmsoContext.market_context.liquidity_state
      }
    });
  }


  // Validate ITF Specific Input (use canonical pipeline keys and symbol classifier)
  const symbols = Object.keys(input).filter(k => !INTERNAL_PIPELINE_KEYS.includes(k) && isSymbolObject(input[k]));
  for (const symbol of symbols) {
    log({
      stage: "INPUT_CHECK", message: "ITF INPUT", data: {
        hasSymbol: !!input[symbol],
        tfKeys: Object.keys(input[symbol] || {})
      }
    });
    const { missing } = validateSymbolData(symbol, input[symbol]);
    if (missing.length > 0) {
      log({ stage: "ITF_ORCHESTRATOR", message: `Missing TFs for ${symbol} in ITF analysis`, data: { symbol, missing }, level: "WARN" });
    }
  }

  // 1. Execute agents safely in parallel
  log({ stage: "ITF_STEP", message: "START" });

  const runSafeAgent = originalRunSafeAgent;

  const agentPromises = [
    runSafeAgent("itfStructureAgent", () => (itfStructureAgent as any)(input, {
      parent_thesis:
        hydrationContext.parent_thesis,

      relational_context:
        hydrationContext.relational_context,

      scenario_context:
        hydrationContext.scenario_context,

      pmso_context:
        hydrationContext.pmso_context
    })),
    runSafeAgent("itfLiquidityAgent", () => (itfLiquidityAgent as any)(input, {
      parent_thesis:
        hydrationContext.parent_thesis,

      relational_context:
        hydrationContext.relational_context,

      scenario_context:
        hydrationContext.scenario_context,

      pmso_context:
        hydrationContext.pmso_context
    })),
    runSafeAgent("itfPDArrayAgent", () => (itfPDArrayAgent as any)(input, {
      parent_thesis:
        hydrationContext.parent_thesis,

      relational_context:
        hydrationContext.relational_context,

      scenario_context:
        hydrationContext.scenario_context,

      pmso_context:
        hydrationContext.pmso_context
    })),
    runSafeAgent("itfSetupAgent", () => (itfSetupAgent as any)(input, {
      parent_thesis:
        hydrationContext.parent_thesis,

      relational_context:
        hydrationContext.relational_context,

      scenario_context:
        hydrationContext.scenario_context,

      pmso_context:
        hydrationContext.pmso_context
    }))
  ];

  const [structureResult, liquidityResult, pdArrayResult, setupResult] = await Promise.all(agentPromises);

  log({ stage: "ITF_STEP", message: "AGENTS_DONE" });

  // Check for agent failures
  if (structureResult.status !== 'SUCCESS') {
    log({ stage: "ITF_ORCHESTRATOR", message: "itfStructureAgent failed. Aborting ITF orchestration.", level: "ERROR", data: structureResult._meta });
    throw new Error("ITF Orchestrator failed due to itfStructureAgent failure.");
  }
  if (liquidityResult.status !== 'SUCCESS') {
    log({ stage: "ITF_ORCHESTRATOR", message: "itfLiquidityAgent failed. Aborting ITF orchestration.", level: "ERROR", data: liquidityResult._meta });
    throw new Error("ITF Orchestrator failed due to itfLiquidityAgent failure.");
  }
  if (pdArrayResult.status !== 'SUCCESS') {
    log({ stage: "ITF_ORCHESTRATOR", message: "itfPDArrayAgent failed. Aborting ITF orchestration.", level: "ERROR", data: pdArrayResult._meta });
    throw new Error("ITF Orchestrator failed due to itfPDArrayAgent failure.");
  }
  if (setupResult.status !== 'SUCCESS') {
    log({ stage: "ITF_ORCHESTRATOR", message: "itfSetupAgent failed. Aborting ITF orchestration.", level: "ERROR", data: setupResult._meta });
    throw new Error("ITF Orchestrator failed due to itfSetupAgent failure.");
  }

  const combinedInput = {
    structure: sanitizeForOrchestration(structureResult.data ?? {}),
    liquidity: sanitizeForOrchestration(liquidityResult.data ?? {}),
    pd_array: sanitizeForOrchestration(pdArrayResult.data ?? {}),
    setup: sanitizeForOrchestration(setupResult.data ?? {}),
    htf: sanitizeForOrchestration(input.htf),
    macro_summary: macroSummary ? {
      volatility_regime: macroSummary.volatility_regime,
      continuation_retracement_expectation: macroSummary.continuation_retracement_expectation,
      intermarket_macro_state: macroSummary.intermarket_macro_state,
    } : undefined,
  };

  const fullPromptEstimate =
    Math.ceil(
      JSON.stringify({
        structure: structureResult.data ?? {},
        liquidity: liquidityResult.data ?? {},
        pd_array: pdArrayResult.data ?? {},
        setup: setupResult.data ?? {},
        htf: input.htf,
        macro_summary: combinedInput.macro_summary,
      }).length / 4
    );
  const compactPromptEstimate =
    Math.ceil(JSON.stringify(combinedInput).length / 4);
  log({
    stage: "[ORCHESTRATION][SANITIZE]",
    message: "Sanitized ITF orchestration payload",
    data: {
      removed_debug_keys: ["_debug", "_raw"],
      full_estimated_tokens: fullPromptEstimate,
      compact_estimated_tokens: compactPromptEstimate,
    }
  });
  log({
    stage: "[ORCHESTRATION][COMPACT_STATE]",
    message: "ITF orchestration switched to compact state",
    data: {
      before_token_estimate: fullPromptEstimate,
      after_token_estimate: compactPromptEstimate,
      reduction_pct: fullPromptEstimate > 0
        ? Number((((fullPromptEstimate - compactPromptEstimate) / fullPromptEstimate) * 100).toFixed(1))
        : 0,
      removed_fields: ["_debug", "_raw", "verbose reasoning payloads"],
    }
  });

  log({
    stage: "COMBINED", message: "ITF", data: {
      structure: !!structureResult.data,
      liquidity: !!liquidityResult.data,
      pd_array: !!pdArrayResult.data,
      setup: !!setupResult.data
    }
  });

  const prompt = buildPrompt({
    role: "You are an ITF Orchestrator.",
    task: "Resolve all ITF agents into a final trade decision.",
    inputContext: JSON.stringify(combinedInput, null, 2),
    constraints: [
      "MUST only use input",
      "MUST NOT invent anything",
      "MUST resolve conflicts explicitly",
      "MUST prioritize real signals over weak signals",
      "MUST use hydrated PMSO context as directional regime guidance",
      "The following fields are required: itf_bias, entry_bias, setup_type, confidence, dominant_factors, reasoning",
      "Step 1 — Extract signals:\n\n* structure → direction\n* liquidity → targets / sweeps\n* pd_array → context (premium/discount)\n* setup → executable opportunity",
      "Step 2 — Alignment:\n\n* ITF vs HTF\n* setup vs structure\n* liquidity vs direction",
      "Step 3 — Resolve conflict:\n\n* setup > structure > pd_array > liquidity",
      "Step 4 — Final decision:\n\n* itf_bias\n* entry_bias\n* setup_type",
      "Structure = directional base",
      "Setup = execution signal (most important)",
      "PD = context",
      "Liquidity = targets only",
      "If setup exists → trust setup",
      "If no setup → entry_bias = none",
      "Respond using function call."
    ],
    outputFormat: ""
  }, hydrationContext);

  const rawLlmResult = await callLLM(
    prompt,
    "ITF-Orchestrator",
    Date.now().toString(),
    [{ text: prompt }],
    { tools: itfTool, useStructured: true, schema: ITFOrchestratorOutputSchema, returnTelemetry: true }
  );

  const result = rawLlmResult.data as ITFOrchestratorOutput;
  const telemetry = rawLlmResult.telemetry;
  telemetry.payload_sizes = {
    structure: JSON.stringify(combinedInput.structure).length,
    liquidity: JSON.stringify(combinedInput.liquidity).length,
    pd_array: JSON.stringify(combinedInput.pd_array).length,
    setup: JSON.stringify(combinedInput.setup).length,
  };

  log({
    stage: "ITF_ORCHESTRATOR",
    message: "ITF Orchestrator complete",
    data: {
      itf_bias: result.itf_bias,
      setup_type: result.setup_type
    }
  });

  // Generate H4 Thesis for Hierarchical Memory
  const h4Thesis = await summarizeTimeframeThesis(
    "H4",
    [structureResult.data, liquidityResult.data, pdArrayResult.data, setupResult.data],
    [],
    hydrationContext.parent_thesis
  );

  const newHydrationContext: HydrationContext = {
    ...hydrationContext,
    parent_thesis: h4Thesis,

    // MARKET_DELIVERY_STATE_V1_HEURISTIC
    // mmxm_phase heuristic is derived from ITF execution/setup signals:
    // - setup_type (continuation/pullback/reversal) maps into phase targets
    // - additive-only: only populates when upstream market_delivery_state exists
    market_delivery_state: (() => {
      const prev = hydrationContext.market_delivery_state;

      // HTF owns regime/confidence; ITF owns mmxm_phase.
      // Preserve additive semantics: keep prev unchanged except for mmxm_phase.
      if (!prev) return prev;

      const setupType = result?.setup_type as any;
      const entryBias = result?.entry_bias as any;

      // Conservative mapping:
      // - continuation => original_consolidation
      // - pullback => engineering_liquidity
      // - reversal => smart_money_reversal
      // - any other/none => distribution (weak gate) only if there's evidence
      const basePhase =
        setupType === "continuation"
          ? "original_consolidation"
          : setupType === "pullback"
            ? "engineering_liquidity"
            : setupType === "reversal"
              ? "smart_money_reversal"
              : undefined;

      // Optional conservative adjustment using entry_bias:
      // If the entry_bias explicitly aligns bullish/bearish, favor smart_money_reversal for reversal setups.
      const adjustedPhase =
        basePhase === "smart_money_reversal" && entryBias
          ? "smart_money_reversal"
          : basePhase ?? (setupType ? "distribution" : undefined);

      return {
        ...prev,
        mmxm_phase: adjustedPhase as any
      };
    })(),
  };

  const finalOutput = {
    ...result,
    structure: structureResult.data,
    liquidity: liquidityResult.data,
    pd_array: pdArrayResult.data,
    setup: setupResult.data,
    _debug: {
      agents: {
        structure: structureResult,
        liquidity: liquidityResult,
        pd_array: pdArrayResult,
        setup: setupResult,
      },
      telemetry,
    },
    _raw: result
  };



  StorageService.persistAnalysisOutput("itf", "itf-orchestrator", finalOutput);
  return { ...finalOutput, hydrationContext: newHydrationContext };
}
