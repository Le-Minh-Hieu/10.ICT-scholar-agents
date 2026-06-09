
/// <reference types="node" />

import "dotenv/config";
import { callLLM } from "../../../shared/utils/llm-utils.js";
import { log } from "../../../shared/utils/logger.js";
import { ltfStructureAgent } from "../agents/ltf/ltf-structure-agent.js";
import { isSymbolObject, validateSymbolData, INTERNAL_PIPELINE_KEYS } from "../../../shared/utils/validation.js";
import { ltfLiquidityAgent } from "../agents/ltf/ltf-liquidity-agent.js";
import { ltfPDArrayAgent } from "../agents/ltf/ltf-pd-array-agent.js";
import { ltfTriggerAgent } from "../agents/ltf/ltf-trigger-agent.js";

import { runSafeAgent as originalRunSafeAgent, AgentRunResult } from "../../../shared/utils/agent-executor.js";
import { HydrationContext } from "../../../shared/contracts/context.js";
import { TimeframeThesis, HierarchicalMemory } from "../../../shared/knowledge/hierarchical-types.js";
import { RelationalContext } from "../../../shared/knowledge/relational-types.js";
import { ScenarioMemory } from "../../../shared/knowledge/scenario-types.js";
import { PMSO } from "../../../shared/contracts/pmso.js";
import { summarizeTimeframeThesis } from "../hierarchical-summarizer.js";
import { LTFOrchestratorOutputSchema, LTFOrchestratorOutput, HTFOrchestratorOutput, ITFOrchestratorOutput, LTFOrchestratorOutputObject } from "../../../shared/contracts/canonical.js";
import { zodToToolSchema } from "../../../shared/utils/zod-to-tool.js";
import { StorageService } from "../../../shared/services/storage-service.js";

import { buildPrompt } from "../prompt-builder.js";
import { sanitizeForOrchestration } from "../agents/shared/base-agent.js";



import type { LTFOrchestratorInput } from "../../../shared/contracts/ltf/orchestrator-input.js";


const ltfTool = [{
  functionDeclarations: [{
    name: "generateLTFOutput",
    parameters: zodToToolSchema(LTFOrchestratorOutputObject.omit({ _debug: true, _raw: true }))
  }]
}];

export async function runLTFOrchestrator(
  input: LTFOrchestratorInput,
  hydrationContext: HydrationContext
): Promise<LTFOrchestratorOutput & { hydrationContext: HydrationContext }> {
  log({ stage: "LTF_ORCHESTRATOR", message: "Starting LTF Orchestrator", data: { input } });
  const macroSummary = (hydrationContext?.minimal_context as any)?.macro_news_summary;
  if (macroSummary) {
    log({ stage: "[NEWS][AGENT]", message: "LTF received compact macro cognition", data: { timeframe: "LTF", executionRisk: macroSummary.execution_risk, embargoSensitivity: macroSummary.embargo_sensitivity } });
  }


  const pmsoContext = hydrationContext.pmso_context;

  if (pmsoContext) {
    log({
      stage: "PMSO_PROPAGATION_LTF",
      message: "LTF received hydrated PMSO context",
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

  // Validate LTF Specific Input (use canonical pipeline keys and symbol classifier)
  const symbols = Object.keys(input).filter(k => !INTERNAL_PIPELINE_KEYS.includes(k) && isSymbolObject(input[k]));
  for (const symbol of symbols) {
    log({
      stage: "INPUT_CHECK", message: "LTF INPUT", data: {
        hasSymbol: !!input[symbol],
        tfKeys: Object.keys(input[symbol] || {})
      }
    });
    const { missing } = validateSymbolData(symbol, input[symbol]);
    if (missing.length > 0) {
      log({ stage: "LTF_ORCHESTRATOR", message: `Missing TFs for ${symbol} in LTF analysis`, data: { symbol, missing }, level: "WARN" });
    }
  }

  // 1. Execute agents, parallelizing where possible
  log({ stage: "LTF_STEP", message: "START" });

  const runSafeAgent = originalRunSafeAgent;

  const compactHTF = {
    htf_bias: input.htf?.htf_bias,
    next_candle_bias: input.htf?.next_candle_bias,
    confidence: input.htf?.confidence,
    dominant_factors: input.htf?.dominant_factors ?? [],
    reasoning: input.htf?.reasoning ?? "",
  };

  const compactITF = {
    itf_bias: input.itf?.itf_bias,
    entry_bias: input.itf?.entry_bias,
    setup_type: input.itf?.setup_type,

    confidence: input.itf?.confidence,

    dominant_factors: input.itf?.dominant_factors ?? [],
    reasoning: input.itf?.reasoning ?? "",
  };

  const liquidityInput = {
    ...input,
    htf: compactHTF,
    itf: compactITF,
  };

  const pdArrayInput = {
    ...input,
    htf: compactHTF,
    itf: compactITF,
  };

  const structureInput = {
    ...input,
    htf: compactHTF,
    itf: compactITF,
  };

  // Run independent agents in parallel
  const independentAgentPromises = [
    runSafeAgent("ltfStructureAgent", () => (ltfStructureAgent as any)(structureInput, {
      parent_thesis:
        hydrationContext.parent_thesis,

      relational_context:
        hydrationContext.relational_context,

      scenario_context:
        hydrationContext.scenario_context,

      pmso_context:
        hydrationContext.pmso_context
    })),
    runSafeAgent("ltfLiquidityAgent", () => (ltfLiquidityAgent as any)(liquidityInput, {
      parent_thesis:
        hydrationContext.parent_thesis,

      relational_context:
        hydrationContext.relational_context,

      scenario_context:
        hydrationContext.scenario_context,

      pmso_context:
        hydrationContext.pmso_context
    })),
    runSafeAgent("ltfPDArrayAgent", () => (ltfPDArrayAgent as any)(pdArrayInput, {
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

  const [structureResult, liquidityResult, pdArrayResult] = await Promise.all(independentAgentPromises);

  log({ stage: "LTF_STEP", message: "INDEPENDENT_AGENTS_DONE" });

  // Check for failures before proceeding to dependent agent
  if (structureResult.status !== 'SUCCESS') {
    log({ stage: "LTF_ORCHESTRATOR", message: "ltfStructureAgent failed. Aborting LTF orchestration.", level: "ERROR", data: structureResult._meta });
    throw new Error("LTF Orchestrator failed due to ltfStructureAgent failure.");
  }
  if (liquidityResult.status !== 'SUCCESS') {
    log({ stage: "LTF_ORCHESTRATOR", message: "ltfLiquidityAgent failed. Aborting LTF orchestration.", level: "ERROR", data: liquidityResult._meta });
    throw new Error("LTF Orchestrator failed due to ltfLiquidityAgent failure.");
  }
  if (pdArrayResult.status !== 'SUCCESS') {
    log({ stage: "LTF_ORCHESTRATOR", message: "ltfPDArrayAgent failed. Aborting LTF orchestration.", level: "ERROR", data: pdArrayResult._meta });
    throw new Error("LTF Orchestrator failed due to ltfPDArrayAgent failure.");
  }

  // The trigger agent depends on the results of the independent agents
  log({ stage: "LTF_STEP", message: "trigger START" });
  const triggerInput = {
    ...input,
    htf: compactHTF,
    itf: compactITF,
    structure: structureResult.data,
    liquidity: liquidityResult.data,
    pd_array: pdArrayResult.data,
  };
  const triggerResult = await runSafeAgent("ltfTriggerAgent", () => (ltfTriggerAgent as any)(triggerInput,
    {
      parent_thesis:
        hydrationContext.parent_thesis,

      relational_context:
        hydrationContext.relational_context,

      scenario_context:
        hydrationContext.scenario_context,

      pmso_context:
        hydrationContext.pmso_context,

      // Ensure LTF trigger has market_delivery_state context available
      market_delivery_state:
        (hydrationContext as any)?.market_delivery_state
    }));
  log({ stage: "LTF_STEP", message: "trigger DONE" });

  log({ stage: "LTF_STEP", message: "END" });

  const combinedInput = {
    structure: sanitizeForOrchestration(structureResult.data ?? {}),
    liquidity: sanitizeForOrchestration(liquidityResult.data ?? {}),
    pd_array: sanitizeForOrchestration(pdArrayResult.data ?? {}),
    trigger: sanitizeForOrchestration(triggerResult.data ?? {}),
    htf: compactHTF,
    itf: compactITF,
    macro_summary: macroSummary ? {
      execution_risk: macroSummary.execution_risk,
      embargo_sensitivity: macroSummary.embargo_sensitivity,
      execution_modifiers: macroSummary.execution_modifiers,
    } : undefined,
  };

  const fullPromptEstimate =
    Math.ceil(
      JSON.stringify({
        structure: structureResult.data ?? {},
        liquidity: liquidityResult.data ?? {},
        pd_array: pdArrayResult.data ?? {},
        trigger: triggerResult.data ?? {},
        htf: input.htf,
        itf: input.itf,
        macro_summary: combinedInput.macro_summary,
      }).length / 4
    );
  const compactPromptEstimate =
    Math.ceil(JSON.stringify(combinedInput).length / 4);
  log({
    stage: "[ORCHESTRATION][SANITIZE]",
    message: "Sanitized LTF orchestration payload",
    data: {
      removed_debug_keys: ["_debug", "_raw"],
      full_estimated_tokens: fullPromptEstimate,
      compact_estimated_tokens: compactPromptEstimate,
    }
  });
  log({
    stage: "[ORCHESTRATION][COMPACT_STATE]",
    message: "LTF orchestration switched to compact state",
    data: {
      before_token_estimate: fullPromptEstimate,
      after_token_estimate: compactPromptEstimate,
      reduction_pct: fullPromptEstimate > 0
        ? Number((((fullPromptEstimate - compactPromptEstimate) / fullPromptEstimate) * 100).toFixed(1))
        : 0,
      removed_fields: ["_debug", "_raw", "verbose upstream narratives"],
    }
  });

  log({
    stage: "COMBINED", message: "LTF", data: {
      structure: !!structureResult.data,
      liquidity: !!liquidityResult.data,
      pd_array: !!pdArrayResult.data,
      trigger: !!triggerResult.data
    }
  });

  const prompt = buildPrompt({
    role: "You are an LTF Orchestrator (final execution decision layer).",
    task: "Resolve all LTF agents into a final execution decision.",
    inputContext: JSON.stringify(combinedInput, null, 2),
    constraints: [
      "MUST ONLY use input",
      "MUST NOT invent anything",
      "MUST resolve conflicts explicitly",
      "MUST respect HTF + ITF bias",
      "MUST use hydrated PMSO context as directional regime guidance",
      "If execute is true, you MUST provide entry_price, stop_loss, and take_profit.",
      "The following fields are required: execute, direction, entry, confidence, dominant_factors, reasoning, confluence_score",
      "Always return confluence_score as a number. If uncertain, return 0.",
      "Step 1 — Direction:\n- HTF + ITF define directional bias",
      "Step 2 — Structure:\n- continuation → valid\n- pullback → conditional\n- reversal → risky",
      "Step 3 — Liquidity:\n- turtle soup → entry\n- MSS -> confirmation \n- sweeps → entry catalyst\n- inducement → targets",
      "Step 4 — PD Array:\n- discount (bullish) → buy zone\n- premium (bearish) → sell zone",
      "Step 5 — Trigger:\n- if trigger.execute = true → strong signal",
      "CONFLUENCE SCORING\n\n+1 structure aligned  \n+1 liquidity sweep present  \n+1 PD array correct zone  \n\nTotal:\n- 3 → high probability\n- 2 → moderate\n- <2 → no trade",
      "Direction MUST follow HTF unless strong reversal evidence",
      "Trigger is execution confirmation",
      "If trigger=false → execute=false",
      "If confluence <2 → execute=false",
      "Return via function call."
    ],
    outputFormat: ""
  }, hydrationContext);

  let result: LTFOrchestratorOutput;
  let telemetry: any = null;
  try {
    const rawLlmResult = await callLLM(
      prompt,
      "LTF-Orchestrator",
      Date.now().toString(),
      [{ text: prompt }],
      { tools: ltfTool, useStructured: true, schema: LTFOrchestratorOutputSchema, returnTelemetry: true }
    );
    result = rawLlmResult.data as LTFOrchestratorOutput;
    telemetry = rawLlmResult.telemetry;
    telemetry.payload_sizes = {
      structure: JSON.stringify(combinedInput.structure).length,
      liquidity: JSON.stringify(combinedInput.liquidity).length,
      pd_array: JSON.stringify(combinedInput.pd_array).length,
      trigger: JSON.stringify(combinedInput.trigger).length,
    };
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    log({ stage: "LTF_ORCHESTRATOR_FALLBACK", message: "LTF Orchestrator failed after schema retries; using safe fallback output.", level: "WARN", data: { error: errorMessage } });
    result = {
      execute: false,
      direction: "neutral",
      entry: "No trade signal due to LTF Orchestrator validation failure.",
      confidence: 0,
      dominant_factors: ["ltf_orchestrator_schema_failure"],
      reasoning: `Fallback output because LTF Orchestrator could not produce valid schema output after retries. Error: ${errorMessage}`,
      confluence_score: 0,
    };
  }

  log({
    stage: "LTF_ORCHESTRATOR", message: "LTF Orchestrator complete", data: {
      execute: result.execute,
      direction: result.direction
    }
  });

  // Generate M15 Thesis for Hierarchical Memory
  const m15Thesis = await summarizeTimeframeThesis(
    "M15",
    [structureResult.data, liquidityResult.data, pdArrayResult.data, triggerResult.data],
    [],
    hydrationContext.parent_thesis
  )

  const newHydrationContext: HydrationContext = {
    ...hydrationContext,
    parent_thesis: m15Thesis,
  };

  const finalOutput = {
    ...result,
    _debug: {
      agents: {
        structure: structureResult,
        liquidity: liquidityResult,
        pd_array: pdArrayResult,
        trigger: triggerResult,
      },
      ...(telemetry ? { telemetry } : {}),
    },
    _raw: result
  };



  StorageService.persistAnalysisOutput("ltf", "ltf-orchestrator", finalOutput);
  return { ...finalOutput, hydrationContext: newHydrationContext };
}
