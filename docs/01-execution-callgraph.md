Execution Call Graph — exhaustive trace starting from core/4.output/run-system.ts

This document enumerates the execution graph, dependency graph, artifact generation graph, and critical paths requested. Each node is documented with: File, Function, Called By, Calls Into, Produces, Consumes. Edges/nested calls are exhaustive for the runtime path originating at `runSystem()` in [core/4.output/run-system.ts](core/4.output/run-system.ts).

**Notes**: File links reference workspace-relative paths.

================================================================================
**ENTRY NODE**

- File: [core/4.output/run-system.ts](core/4.output/run-system.ts)
- Function: `runSystem(input, options)`
- Called By:
  - [app/facades/run-analysis.ts](app/facades/run-analysis.ts)::`runAnalysis()` (calls `runSystem()`)
- Calls Into:
  - [core/3.query/orchestrators/time-orchestrator.ts](core/3.query/orchestrators/time-orchestrator.ts)::`runTimeOrchestrator()`
  - [core/3.query/orchestrators/htf-orchestrator.ts](core/3.query/orchestrators/htf-orchestrator.ts)::`runHTFOrchestrator()`
  - [core/3.query/orchestrators/itf-orchestrator.ts](core/3.query/orchestrators/itf-orchestrator.ts)::`runITFOrchestrator()`
  - [core/3.query/orchestrators/ltf-orchestrator.ts](core/3.query/orchestrators/ltf-orchestrator.ts)::`runLTFOrchestrator()`
  - [core/3.query/orchestrators/master-orchestrator.ts](core/3.query/orchestrators/master-orchestrator.ts)::`runMasterOrchestrator()`
  - [core/3.query/orchestrator-input-builder.js](core/3.query/orchestrator-input-builder.js)::`buildITFInput()`, `buildLTFInput()`, `buildMasterInput()`
  - [core/news/cognition/macro-context-hydrator.ts](core/news/cognition/macro-context-hydrator.ts)::`getLatestMacroHydration()`, `getLatestDailyHydration()`
  - [core/3.query/retrieval-core.js](core/3.query/retrieval-core.js)::`invalidateRetrievalCache()` (commented)
- Produces:
  - Returns `SystemResult` (the canonical system output, containing `layers.master`, `_pmso`, `_raw`, and high-level decision fields).
  - As side-effect (via callers) leads to persisted artifacts: `full.json`, `master/decision.json` (written by `runAnalysis()`), and per-layer artifacts persisted by orchestrators/agents.
- Consumes:
  - Input `symbols` (image data fields), `options.capturePath`, inherited hydration state from `getLatestMacroHydration()` and `getLatestDailyHydration()`; `stagingEventStore` (shadow macro events); global capture/session metadata.

================================================================================
**TIME LAYER**

- File: [core/3.query/orchestrators/time-orchestrator.ts](core/3.query/orchestrators/time-orchestrator.ts)
- Function: `runTimeOrchestrator(input, hydrationContext)`
- Called By: `runSystem()`
- Calls Into:
  - [core/3.query/agents/time/session-agent.ts](core/3.query/agents/time/session-agent.ts)::`sessionAgent()`
  - [core/3.query/agents/time/daily-agent.ts](core/3.query/agents/time/daily-agent.ts)::`dailyAgent()`
  - [core/3.query/agents/time/weekly-agent.ts](core/3.query/agents/time/weekly-agent.ts)::`weeklyAgent()`
  - [core/3.query/agents/time/monthly-agent.ts](core/3.query/agents/time/monthly-agent.ts)::`monthlyAgent()`
  - [core/3.query/agents/time/quarterly-agent.ts](core/3.query/agents/time/quarterly-agent.ts)::`quarterlyAgent()`
  - [core/3.query/agents/time/macro-time-agent.ts](core/3.query/agents/time/macro-time-agent.ts)::`macroTimeAgent()`
  - [core/shared/services/storage-service.ts](shared/services/storage-service.ts)::`StorageService.persistAnalysisOutput('time', 'time-orchestrator', result)`
- Produces:
  - Return: `TimeOrchestratorOutput` (trading_window, timing_bias, expectation, confidence, narrative)
  - Persisted artifact: `analysis/time/time.json` (capturePath/analysis/time/time.json) via `StorageService.persistAnalysisOutput`.
- Consumes:
  - `input` (EURUSD timeframes), `hydrationContext` (pmso_context, etc.)

--------------------------------------------------------------------------------
TIME AGENTS (each uses shared runBaseAgent — see shared node)

- File: [core/3.query/agents/time/session-agent.ts](core/3.query/agents/time/session-agent.ts)
  - Function: `sessionAgent(input, hydrationContext)`
  - Called By: `runTimeOrchestrator()`
  - Calls Into: `runBaseAgent()` (core/3.query/agents/shared/base-agent.ts)
  - Produces: returns `TimeAgentOutput`; persisted artifact: `analysis/time/session.json` (via `runBaseAgent` -> `StorageService.persistAnalysisOutput`)
  - Consumes: image base64 payloads for H1/M15/M5 timeframes, `hydrationContext` (daily/weekly profile context)

- File: [core/3.query/agents/time/daily-agent.ts](core/3.query/agents/time/daily-agent.ts)
  - Function: `dailyAgent(...)` — same contract as above; persisted artifact: `analysis/time/daily.json`

- File: [core/3.query/agents/time/weekly-agent.ts](core/3.query/agents/time/weekly-agent.ts)
  - Function: `weeklyAgent(...)` persisted as `analysis/time/weekly.json`

- File: [core/3.query/agents/time/monthly-agent.ts](core/3.query/agents/time/monthly-agent.ts)
  - Function: `monthlyAgent(...)` persisted as `analysis/time/monthly.json`

- File: [core/3.query/agents/time/quarterly-agent.ts](core/3.query/agents/time/quarterly-agent.ts)
  - Function: `quarterlyAgent(...)` persisted as `analysis/time/quarterly.json`

- File: [core/3.query/agents/time/macro-time-agent.ts](core/3.query/agents/time/macro-time-agent.ts)
  - Function: `macroTimeAgent(...)` persisted as `analysis/time/macro-time.json`

================================================================================
**HTF LAYER**

- File: [core/3.query/orchestrators/htf-orchestrator.ts](core/3.query/orchestrators/htf-orchestrator.ts)
- Function: `runHTFOrchestrator(input, hydrationContext)`
- Called By: `runSystem()`
- Calls Into:
  - `runSafeAgent("htfStructureAgent", ...)` -> [core/3.query/agents/htf/htf-structure-agent.ts](core/3.query/agents/htf/htf-structure-agent.ts)::`htfStructureAgent()`
  - `runSafeAgent("htfMacroAgent", ...)` -> [core/3.query/agents/htf/htf-macro-agent.ts](core/3.query/agents/htf/htf-macro-agent.ts)::`htfMacroAgent()`
  - `runSafeAgent("htfLiquidityAgent", ...)` -> [core/3.query/agents/htf/htf-liquidity-agent.ts](core/3.query/agents/htf/htf-liquidity-agent.ts)::`htfLiquidityAgent()`
  - `runSafeAgent("htfPDArrayAgent", ...)` -> [core/3.query/agents/htf/htf-pd-array-agent.ts](core/3.query/agents/htf/htf-pd-array-agent.ts)::`htfPDArrayAgent()`
  - [core/3.query/hierarchical-summarizer.ts](core/3.query/hierarchical-summarizer.ts)::`summarizeTimeframeThesis()` (calls LLM)
  - [shared/utils/llm-utils.ts](shared/utils/llm-utils.ts)::`callLLM()` (invoked directly to produce HTF orchestrator structured output)
  - [core/3.query/reconciler.ts](core/3.query/reconciler.ts)::`PMSOReconciler` integration (extract facts, hydrate pmso)
  - [shared/services/storage-service.ts](shared/services/storage-service.ts)::`persistAnalysisOutput('htf','htf-orchestrator', finalOutput)`
- Produces:
  - Return: `HTFOrchestratorOutput` (plus `hydrationContext` extension)
  - Persisted artifact: `analysis/htf/htf.json` (htf-orchestrator -> sanitized file name `htf.json`)
- Consumes:
  - symbol inputs for D/W/M images, `hydrationContext` (weekly_profile), agent outputs

HTF AGENTS (each -> `runBaseAgent`)
- File: [core/3.query/agents/htf/htf-structure-agent.ts](core/3.query/agents/htf/htf-structure-agent.ts)
  - Function: `htfStructureAgent(input, minimal_context)`
  - Called By: `runHTFOrchestrator()` (via `runSafeAgent`)
  - Calls Into: `runBaseAgent()`
  - Produces: `HTF Structure` JSON persisted at `analysis/htf/htf-structure.json` (via `runBaseAgent` -> `StorageService.persistAnalysisOutput`)
  - Consumes: D/W/M images, retrieval chunks

- File: [core/3.query/agents/htf/htf-macro-agent.ts](core/3.query/agents/htf/htf-macro-agent.ts)
  - Function: `htfMacroAgent(...)` persisted at `analysis/htf/htf-macro.json`

- File: [core/3.query/agents/htf/htf-liquidity-agent.ts](core/3.query/agents/htf/htf-liquidity-agent.ts)
  - Function: `htfLiquidityAgent(...)` persisted at `analysis/htf/htf-liquidity.json`

- File: [core/3.query/agents/htf/htf-pd-array-agent.ts](core/3.query/agents/htf/htf-pd-array-agent.ts)
  - Function: `htfPDArrayAgent(...)` persisted at `analysis/htf/htf-pd-array.json`

- File: [core/3.query/agents/htf/htf-bias-agent.ts](core/3.query/agents/htf/htf-bias-agent.ts)
  - Function: `htfBiasAgent(input)`
  - Called By: used by higher-level code (reconciler/orchestrators) to deterministically compute HTF bias from agent outputs
  - Calls Into: local deterministic logic (no LLM)
  - Produces: object with `htf_bias`, `confidence`, `tradable`
  - Consumes: structure/macro/liquidity/pd_array objects

================================================================================
**ITF LAYER**

- File: [core/3.query/orchestrators/itf-orchestrator.ts](core/3.query/orchestrators/itf-orchestrator.ts)
- Function: `runITFOrchestrator(input, hydrationContext)`
- Called By: `runSystem()`
- Calls Into:
  - `runSafeAgent("itfStructureAgent", ...)` -> [core/3.query/agents/itf/itf-structure-agent.ts]::`itfStructureAgent()`
  - `runSafeAgent("itfLiquidityAgent", ...)` -> [core/3.query/agents/itf/itf-liquidity-agent.ts]::`itfLiquidityAgent()`
  - `runSafeAgent("itfPDArrayAgent", ...)` -> [core/3.query/agents/itf/itf-pd-array-agent.ts]::`itfPDArrayAgent()`
  - `runSafeAgent("itfSetupAgent", ...)` -> [core/3.query/agents/itf/itf-setup-agent.ts]::`itfSetupAgent()`
  - [shared/utils/llm-utils.ts](shared/utils/llm-utils.ts)::`callLLM()` (ITF orchestrator function call)
  - [core/3.query/hierarchical-summarizer.ts](core/3.query/hierarchical-summarizer.ts)::`summarizeTimeframeThesis()`
  - [shared/services/storage-service.ts](shared/services/storage-service.ts)::persist `analysis/itf/itf.json`
- Produces:
  - Return `ITFOrchestratorOutput` + `hydrationContext`
  - Persisted artifact: `analysis/itf/itf.json`
- Consumes:
  - Input frames H4/H1/M15, HTF compact output, hydration context

ITF AGENTS (each -> `runBaseAgent`)
- [core/3.query/agents/itf/itf-structure-agent.ts]::`itfStructureAgent()` -> `analysis/itf/itf-structure.json`
- [core/3.query/agents/itf/itf-liquidity-agent.ts]::`itfLiquidityAgent()` -> `analysis/itf/itf-liquidity.json`
- [core/3.query/agents/itf/itf-pd-array-agent.ts]::`itfPDArrayAgent()` -> `analysis/itf/itf-pd-array.json`
- [core/3.query/agents/itf/itf-setup-agent.ts]::`itfSetupAgent()` -> `analysis/itf/itf-setup.json`

================================================================================
**LTF LAYER**

- File: [core/3.query/orchestrators/ltf-orchestrator.ts](core/3.query/orchestrators/ltf-orchestrator.ts)
- Function: `runLTFOrchestrator(input, hydrationContext)`
- Called By: `runSystem()`
- Calls Into:
  - Independent agents (parallel) via `runSafeAgent`:
    - [core/3.query/agents/ltf/ltf-structure-agent.ts]::`ltfStructureAgent()`
    - [core/3.query/agents/ltf/ltf-liquidity-agent.ts]::`ltfLiquidityAgent()`
    - [core/3.query/agents/ltf/ltf-pd-array-agent.ts]::`ltfPDArrayAgent()`
  - Dependent agent:
    - `runSafeAgent("ltfTriggerAgent", ...)` -> [core/3.query/agents/ltf/ltf-trigger-agent.ts]::`ltfTriggerAgent()` (depends on the three independent agents)
  - [shared/utils/llm-utils.ts](shared/utils/llm-utils.ts)::`callLLM()` invoked for LTF orchestrator prompt
  - [core/3.query/hierarchical-summarizer.ts](core/3.query/hierarchical-summarizer.ts)::`summarizeTimeframeThesis()` (M15 thesis)
  - [shared/services/storage-service.ts](shared/services/storage-service.ts)::persist `analysis/ltf/ltf.json`
- Produces:
  - Return `LTFOrchestratorOutput` + hydrationContext
  - Persisted artifact: `analysis/ltf/ltf.json`
- Consumes:
  - M15/M5/M1 images, HTF + ITF contexts

LTF AGENTS (each -> `runBaseAgent`)
- [core/3.query/agents/ltf/ltf-structure-agent.ts]::`ltfStructureAgent()` -> `analysis/ltf/ltf-structure.json`
- [core/3.query/agents/ltf/ltf-liquidity-agent.ts]::`ltfLiquidityAgent()` -> `analysis/ltf/ltf-liquidity.json`
- [core/3.query/agents/ltf/ltf-pd-array-agent.ts]::`ltfPDArrayAgent()` -> `analysis/ltf/ltf-pd-array.json`
- [core/3.query/agents/ltf/ltf-trigger-agent.ts]::`ltfTriggerAgent()` -> `analysis/ltf/ltf-trigger.json` (final trigger/execution payload)

================================================================================
**MASTER LAYER**

- File: [core/3.query/orchestrators/master-orchestrator.ts](core/3.query/orchestrators/master-orchestrator.ts)
- Function: `runMasterOrchestrator(input)`
- Called By: `runSystem()` (the final consolidation step)
- Calls Into (exhaustive within master flow):
  - `PMSOReconciler.extractFactsFromOutputs(...)` (reconciler module)
  - [core/3.query/news-reasoner.ts](core/3.query/news-reasoner.ts)::`reasonAboutNews()` — invoked per macro event (calls LLM)
  - [core/3.query/scenario-engine.ts](core/3.query/scenario-engine.ts)::`ScenarioEngine.generateScenarios()` (calls LLM)
  - [core/3.query/temporal-engine.ts](core/3.query/temporal-engine.ts)::`TemporalEngine.reconcile()` (temporal reconciliation)
  - [core/3.query/reconciler.ts](core/3.query/reconciler.ts)::`reconcileHierarchy()`, `reconcileIntermarket()`
  - [core/3.query/hierarchical-summarizer.ts](core/3.query/hierarchical-summarizer.ts)::`summarizeTimeframeThesis()` (if used in memory)
  - [shared/utils/llm-utils.ts](shared/utils/llm-utils.ts)::`callLLM()` used to call the `generateMasterDecision` tool (structured LLM call to create master decision)
  - [shared/services/storage-service.ts](shared/services/storage-service.ts)::`persistAnalysisOutput('pmso', captureId, pmso)`, `persistAnalysisOutput('master','temporal-state', temporalState)`, `persistAnalysisOutput('master','master-orchestrator', finalOutput)`, `saveScenarios()`
  - `persistNewsArtifacts()` (local helper inside master orchestrator) -> uses `StorageService.saveCaptureArtifact(relativePath, data)` for news artifacts
- Produces:
  - Return: `MasterOutput` (canonical master output and decision)
  - Persisted artifacts (via `persistAnalysisOutput` and `saveCaptureArtifact`):
    - `analysis/master/master.json` (master orchestrator canonical wrapper via `persistAnalysisOutput`)
    - `analysis/pmso/<captureId>.json` (via `persistAnalysisOutput('pmso', captureId, pmso)`) — PMSO artifact
    - `analysis/master/temporal_state.json` (via `StorageService.saveTemporalState` / `persistAnalysisOutput`)
    - `analysis/master/scenarios.json` (via `StorageService.saveScenarios`)
    - News artifacts (via `saveCaptureArtifact`):
      - `analysis/news/weekly-profile.json`
      - `analysis/news/daily-profile.json`
      - `analysis/news/macro-context.json`
      - `analysis/news/macro-narrative.json`
      - `analysis/news/raw-calendar-events.json`, etc. (see `persistNewsArtifacts()` artifactMap)
    - Final `finalOutput` (persisted and also returned to `runSystem()`)
- Consumes:
  - Inputs: `input.time`, `input.htf`, `input.itf`, `input.ltf`, `hydration_context` (weekly/daily profiles, raw_calendar_events)
  - Intermediate outputs: hierarchical memory, PMSO, temporalState, grounded news reasoning results

================================================================================
**AGENT EXECUTION HELPER (shared)**

- File: [core/3.query/agents/shared/base-agent.ts](core/3.query/agents/shared/base-agent.ts)
- Functions:
  - `runBaseAgent<TInput,TOutput>(input, config, minimal_context)` — central agent runner used by all agents
  - `pushImage(parts, path, imageName, callId)` — packages image into LLM parts
- Called By: every agent file (time/htf/itf/ltf agents) calls `runBaseAgent()`
- Calls Into:
  - [core/3.query/retrieval-core.js](core/3.query/retrieval-core.js)::`retrieveRAG()` (RAG retrieval)
  - [core/3.query/grounding/index.js] or `buildGrounded()` (grounding module)
  - [shared/utils/llm-utils.ts](shared/utils/llm-utils.ts)::`callLLM()` (the single LLM invocation for agents)
  - [shared/services/storage-service.ts](shared/services/storage-service.ts)::`persistAnalysisOutput(layer, agentName, finalResult)`
  - helpers: `embedQueries()`, `buildQueries()`, `loadPipeline()` etc.
- Produces:
  - Returns agent output object (finalResult), and persists artifact at `analysis/<layer>/<agent>.json` (sanitized name)
- Consumes:
  - `input` (image base64 payloads) and `minimal_context` (parent thesis, relational context, pmso)

================================================================================
**LLM UTIL (single implementation)**

- File: [shared/utils/llm-utils.ts](shared/utils/llm-utils.ts)
- Function: `callLLM(prompt, agentName, callId, parts, options)`
- Called By (exhaustive hits found in the runtime graph reachable from `runSystem()`):
  - [core/3.query/agents/shared/base-agent.ts](core/3.query/agents/shared/base-agent.ts)::`runBaseAgent()` (agents)
  - [core/3.query/orchestrators/htf-orchestrator.ts](core/3.query/orchestrators/htf-orchestrator.ts)::`runHTFOrchestrator()`
  - [core/3.query/orchestrators/itf-orchestrator.ts](core/3.query/orchestrators/itf-orchestrator.ts)::`runITFOrchestrator()`
  - [core/3.query/orchestrators/ltf-orchestrator.ts](core/3.query/orchestrators/ltf-orchestrator.ts)::`runLTFOrchestrator()`
  - [core/3.query/orchestrators/master-orchestrator.ts](core/3.query/orchestrators/master-orchestrator.ts)::`runMasterOrchestrator()`
  - [core/3.query/hierarchical-summarizer.ts](core/3.query/hierarchical-summarizer.ts)::`summarizeTimeframeThesis()`
  - [core/3.query/scenario-engine.ts](core/3.query/scenario-engine.ts)::`ScenarioEngine.generateScenarios()`
  - [core/3.query/news-reasoner.ts](core/3.query/news-reasoner.ts)::`reasonAboutNews()`
  - Additional news/cognition modules reachable from master: [core/news/cognition/daily-context-reasoner.ts](core/news/cognition/daily-context-reasoner.ts), [core/news/cognition/weekly-question-generator.ts](core/news/cognition/weekly-question-generator.ts), [core/news/cognition/timeline-synthesizer.ts](core/news/cognition/timeline-synthesizer.ts), [core/news/cognition/theme-synthesizer.ts](core/news/cognition/theme-synthesizer.ts) (these files call `callLLM()`; some are invoked in news pipeline or hydration builders).
- Calls Into: external LLM provider (API wrapper), internal structured-function-flow. Returns LLM responses (string/object) back to callers.
- Produces: LLM response object/JSON consumed by orchestrators/agents
- Consumes: prompt, grounded knowledge, pushed images (base64 parts)

================================================================================
**NEWS REASONER**

- File: [core/3.query/news-reasoner.ts](core/3.query/news-reasoner.ts)
- Function: `reasonAboutNews(event, chunksOrScored, ...)`
- Called By: `runMasterOrchestrator()` (iterates macro events and calls `reasonAboutNews()` for each event)
- Calls Into: [shared/utils/llm-utils.ts]::`callLLM()`
- Produces: `NewsReasoningResult` (evidence_summaries, chunk_citations, uncertainty_pressure, volatility_pressure, directional_pressure, ..)
- Consumes: event object (macro event), retrieved chunks/evidence

================================================================================
**HIERARCHICAL SUMMARIZER**

- File: [core/3.query/hierarchical-summarizer.ts](core/3.query/hierarchical-summarizer.ts)
- Function: `summarizeTimeframeThesis(timeframe, agentOutputs, retrievedChunks, parentThesis)`
- Called By: HTF/ITF/LTF orchestrators (to generate DAILY/H4/M15 thesis)
- Calls Into: [shared/utils/llm-utils.ts]::`callLLM()`
- Produces: `TimeframeThesis` (bias, confidence, key_anchors, summary, supporting_chunks)
- Consumes: agent outputs and retrieved chunks

================================================================================
**SCENARIO ENGINE**

- File: [core/3.query/scenario-engine.ts](core/3.query/scenario-engine.ts)
- Function: `ScenarioEngine.generateScenarios(memory, retrievedChunks, captureId, newsModifier)`
- Called By: `runMasterOrchestrator()` (when hydration_context.scenario_context is present)
- Calls Into: [shared/utils/llm-utils.ts]::`callLLM()`
- Produces: `ScenarioMemory` persisted via `StorageService.saveScenarios()` (analysis/master/scenarios.json)
- Consumes: `memory` (hierarchical memory), retrieved evidence chunks

================================================================================
**STORAGE SERVICE**

- File: [shared/services/storage-service.ts](shared/services/storage-service.ts)
- Class: `StorageService` (static methods)
- Key Methods (Called By many components):
  - `persistAnalysisOutput(layer, componentName, data, status?, error?, inputSummary?, missingTfs?)` — used by `runBaseAgent()` for agents and by orchestrators — writes `capturePath/analysis/<layer>/<component>.json` (sanitized name), logs sizes
  - `saveCaptureArtifact(relativePath, data)` — used by `master-orchestrator`'s `persistNewsArtifacts()` to write artifacts such as `analysis/news/weekly-profile.json`, `analysis/news/daily-profile.json`, etc.
  - `saveJson(filePath, data)` — general writer used by `app/facades/run-analysis.ts` to write `full.json` and `master/decision.json` (capture root)
  - `saveScenarios(scenarios)` — writes `analysis/master/scenarios.json`
  - `saveTemporalState(temporalState)` — writes `analysis/master/temporal_state.json`
  - `saveImage(capturePath, asset, timeframe, buffer)` — writes input images into capture input folder
  - `updateTimeline(date, session, entry)` — updates timeline.json
- Called By: `runBaseAgent()`, orchestrators (master, htf, ltf, itf, time), `runAnalysis()` facade, `persistNewsArtifacts()` helper
- Produces: filesystem artifacts under `capturePath` (see above)

================================================================================
**APP FACADE (captures final decision.json)**

- File: [app/facades/run-analysis.ts](app/facades/run-analysis.ts)
- Function: `runAnalysis(inputData, options)`
- Called By: external callers (CLI, tests, automation)
- Calls Into: `runSystem()` and then on success persists:
  - `full.json` at capturePath via `StorageService.saveJson()`
  - `master/decision.json` (if `result.layers.master`) via `StorageService.saveJson()`
- Produces: final persisted `capturePath/master/decision.json` (the file the user requested critical path to)
- Consumes: input images directory (capturePath/input), metadata.json (to set globals)

================================================================================
**ARTIFACT GENERATION GRAPH (exhaustive list of artifacts created on the run path)**

- capture root (set via `options.capturePath` / global.currentCapturePath)
  - `full.json` (written by [app/facades/run-analysis.ts](app/facades/run-analysis.ts)) — full SystemResult
  - `master/decision.json` (written by [app/facades/run-analysis.ts](app/facades/run-analysis.ts)) — final master decision payload
  - `analysis/` folder — produced by `StorageService.persistAnalysisOutput` and `saveCaptureArtifact`:
    - `analysis/time/session.json`, `analysis/time/daily.json`, `analysis/time/weekly.json`, `analysis/time/monthly.json`, `analysis/time/quarterly.json`, `analysis/time/macro-time.json` (time agents and time orchestrator write outputs)
    - `analysis/time/time.json` (time orchestrator summary)
    - `analysis/htf/htf-structure.json`, `analysis/htf/htf-macro.json`, `analysis/htf/htf-liquidity.json`, `analysis/htf/htf-pd-array.json` (htf agents)
    - `analysis/htf/htf.json` (htf orchestrator canonical output)
    - `analysis/itf/itf-structure.json`, `analysis/itf/itf-liquidity.json`, `analysis/itf/itf-pd-array.json`, `analysis/itf/itf-setup.json`, `analysis/itf/itf.json` (itf outputs)
    - `analysis/ltf/ltf-structure.json`, `analysis/ltf/ltf-liquidity.json`, `analysis/ltf/ltf-pd-array.json`, `analysis/ltf/ltf-trigger.json`, `analysis/ltf/ltf.json` (ltf outputs)
    - `analysis/master/master.json` (master orchestrator canonical persisted output)
    - `analysis/pmso/<captureId>.json` (PMSO snapshot persisted by master/reconciler)
    - `analysis/master/temporal_state.json` (temporal state persisted by master/temporal engine)
    - `analysis/master/scenarios.json` (scenarios persisted by ScenarioEngine)
    - `analysis/news/weekly-profile.json` (persistNewsArtifacts writes this)
    - `analysis/news/daily-profile.json` (persistNewsArtifacts writes this)
    - `analysis/news/raw-calendar-events.json` (persistNewsArtifacts)
    - other `analysis/news/*` artifacts as enumerated in `persistNewsArtifacts()` artifactMap in [core/3.query/orchestrators/master-orchestrator.ts](core/3.query/orchestrators/master-orchestrator.ts)
  - `input/<symbol>/*.jpg` (images saved by ingestion or by `StorageService.saveImage`)

================================================================================
**CRITICAL PATHS (explicit sequences of calls)

- Critical Path to `master/decision.json` (the canonical decision file written under `capturePath/master/decision.json` by the facade):
  1. [app/facades/run-analysis.ts](app/facades/run-analysis.ts)::`runAnalysis()`
  2. -> [core/4.output/run-system.ts](core/4.output/run-system.ts)::`runSystem()`
  3. -> [core/3.query/orchestrators/time-orchestrator.ts](core/3.query/orchestrators/time-orchestrator.ts)::`runTimeOrchestrator()` (hydration of time)
    - -> time agents -> `runBaseAgent()` -> `callLLM()` (agents may call LLM), `StorageService.persistAnalysisOutput(...)` (time artifacts)
  4. -> [core/3.query/orchestrators/htf-orchestrator.ts](core/3.query/orchestrators/htf-orchestrator.ts)::`runHTFOrchestrator()`
    - -> HTF agents (`htfStructureAgent`, `htfMacroAgent`, `htfLiquidityAgent`, `htfPDArrayAgent`) via `runSafeAgent()` -> each -> `runBaseAgent()` -> `callLLM()` -> `StorageService.persistAnalysisOutput`
    - -> `callLLM()` (HTF orchestrator structured call to `generateHTFOutput` tool)
    - -> `summarizeTimeframeThesis()` -> `callLLM()` (hierarchical summarizer)
    - -> `StorageService.persistAnalysisOutput('htf', 'htf-orchestrator', finalOutput)` (writes `analysis/htf/htf.json`)
  5. -> [core/3.query/orchestrators/itf-orchestrator.ts](core/3.query/orchestrators/itf-orchestrator.ts)::`runITFOrchestrator()`
    - -> ITF agents via `runSafeAgent()` -> `runBaseAgent()` -> `callLLM()` -> `StorageService.persistAnalysisOutput` (per-agent)
    - -> `callLLM()` (ITF orchestrator structured call)
    - -> `StorageService.persistAnalysisOutput('itf','itf-orchestrator', finalOutput)`
  6. -> [core/3.query/orchestrators/ltf-orchestrator.ts](core/3.query/orchestrators/ltf-orchestrator.ts)::`runLTFOrchestrator()`
    - -> LTF agents -> `runBaseAgent()` -> `callLLM()` -> `StorageService.persistAnalysisOutput`
    - -> `runSafeAgent("ltfTriggerAgent")` -> trigger agent (`ltfTriggerAgent`) -> `runBaseAgent()` -> `callLLM()` => final LTF trigger output
    - -> `callLLM()` (LTF orchestrator structured call)
    - -> `StorageService.persistAnalysisOutput('ltf','ltf-orchestrator', finalOutput)`
  7. -> [core/3.query/orchestrators/master-orchestrator.ts](core/3.query/orchestrators/master-orchestrator.ts)::`runMasterOrchestrator()`
    - -> Build `pmso` (PMSOReconciler.reconcile) and persist via `StorageService.persistAnalysisOutput('pmso', captureId, pmso)`
    - -> For each macro event: `reasonAboutNews()` -> `callLLM()` (news reasoner) -> collect grounded Reasoning
    - -> `ScenarioEngine.generateScenarios()` -> `callLLM()` -> `StorageService.saveScenarios()`
    - -> `TemporalEngine.reconcile()` -> `StorageService.persistAnalysisOutput('master', 'temporal-state', temporalState)`
    - -> Final `callLLM()` to produce `generateMasterDecision` structured output
    - -> normalizeMasterOutput() -> `StorageService.persistAnalysisOutput('master', 'master-orchestrator', finalOutput)` (writes `analysis/master/master.json`)
  8. -> Return to `runSystem()` -> return `SystemResult` to [app/facades/run-analysis.ts](app/facades/run-analysis.ts)
  9. -> [app/facades/run-analysis.ts](app/facades/run-analysis.ts)::`runAnalysis()` writes `capturePath/full.json` and then writes `capturePath/master/decision.json` with `result.layers.master` via `StorageService.saveJson()`.

- Critical Path to `analysis/news/weekly-profile.json` (weekly-profile.json):
  1. `runSystem()` hydration obtains weekly profile from `getLatestMacroHydration()` if available (reads from MacroContextStore)
  2. `runMasterOrchestrator()` builds `newsModifier` and `groundedReasoning` (calls `reasonAboutNews()` -> `callLLM()`)
  3. `persistNewsArtifacts()` called inside `runMasterOrchestrator()` when `shouldPersistNewsArtifacts` true
  4. `persistNewsArtifacts()` -> calls `StorageService.saveCaptureArtifact('analysis/news/weekly-profile.json', weeklyProfileData)`
  5. File written at `capturePath/analysis/news/weekly-profile.json`

- Critical Path to `analysis/news/daily-profile.json` (daily-profile.json):
  1. `runSystem()` calls `getLatestDailyHydration()` to load latest daily hydrate profile (DailyContextStore)
  2. `runMasterOrchestrator()` attaches daily_profile into compact macro summary; `persistNewsArtifacts()` invoked
  3. `persistNewsArtifacts()` -> `StorageService.saveCaptureArtifact('analysis/news/daily-profile.json', dailyProfileData)`
  4. File written at `capturePath/analysis/news/daily-profile.json`

================================================================================
**DEPENDENCY GRAPH (imports / major runtime dependencies reachable from `runSystem()`)**

- `runSystem()` imports orchestrators and utilities:
  - imports `runTimeOrchestrator`, `runHTFOrchestrator`, `runITFOrchestrator`, `runLTFOrchestrator`, `runMasterOrchestrator`
  - imports `buildITFInput`, `buildLTFInput`, `buildMasterInput` (orchestrator-input-builder)
  - imports `stagingEventStore` (news staging) and macro hydration helpers
  - consumes `StorageService` via imported modules

- Orchestrators depend on:
  - `shared/utils/llm-utils.ts` (LLM client wrapper)
  - `core/3.query/agents/*` (agent functions)
  - `core/3.query/agents/shared/base-agent.ts` (agent runtime)
  - `core/3.query/hierarchical-summarizer.ts` and `core/3.query/scenario-engine.ts`
  - `shared/services/storage-service.ts`

- Agents depend on:
  - `core/3.query/agents/shared/base-agent.ts` (runBaseAgent)
  - `core/3.query/retrieval-core.js` and embedding utilities
  - grounding utilities (buildGrounded)
  - `shared/services/storage-service.ts` (persistence via runBaseAgent)

- Master orchestrator depends on additional subsystems:
  - News grounding/reasoning (`core/3.query/news-reasoner.ts`) which uses `callLLM()`
  - `TemporalEngine`, `PMSOReconciler`, `ScenarioEngine` (all in core/3.query)

================================================================================
**ARTIFACTS BY PRODUCER (concise map)**

- Agents (via `runBaseAgent()`) -> `analysis/<layer>/<agent>.json` (agent-level artifacts)
- Orchestrators (via `StorageService.persistAnalysisOutput`) -> `analysis/<layer>/<orchestrator-sanitized-name>.json` (e.g., `analysis/htf/htf.json`, `analysis/itf/itf.json`, `analysis/ltf/ltf.json`, `analysis/time/time.json`, `analysis/master/master.json`)
- Master orchestrator -> `analysis/pmso/<captureId>.json`, `analysis/master/temporal_state.json`, `analysis/master/scenarios.json`
- Master orchestrator -> News artifacts via `saveCaptureArtifact()` (writes directly to `analysis/news/*.json` including `weekly-profile.json` and `daily-profile.json`)
- App facade -> `full.json` and `master/decision.json` in capture root

================================================================================
**EXHAUSTIVE NODE LIST (alphabetical by file path) — each node shows key details**

- [app/facades/run-analysis.ts](app/facades/run-analysis.ts)
  - Function: `runAnalysis()`
  - Called By: external runner/test harness
  - Calls Into: `runSystem()` -> writes `full.json`, `master/decision.json`
  - Produces: `capturePath/full.json`, `capturePath/master/decision.json`
  - Consumes: capture `input` images, metadata

- [core/3.query/agents/shared/base-agent.ts](core/3.query/agents/shared/base-agent.ts)
  - Function: `runBaseAgent()` (central agent-runner)
  - Called By: all agents under `core/3.query/agents/*`
  - Calls Into: `retrieveRAG()`, `buildGrounded()`, `callLLM()`, `StorageService.persistAnalysisOutput()`
  - Produces: agent result object with `compact_output`; persists `analysis/<layer>/<agent>.json`
  - Consumes: input images and retrieval chunks

- [core/3.query/agents/htf/htf-structure-agent.ts](core/3.query/agents/htf/htf-structure-agent.ts)
  - Function: `htfStructureAgent()`
  - Called By: `runHTFOrchestrator()`
  - Calls Into: `runBaseAgent()`
  - Produces: `analysis/htf/htf-structure.json`; returns HTF structure facts
  - Consumes: HTF images and retrieval chunks

- [core/3.query/agents/htf/htf-macro-agent.ts](core/3.query/agents/htf/htf-macro-agent.ts)
  - Function: `htfMacroAgent()`
  - Called By: `runHTFOrchestrator()`
  - Calls Into: `runBaseAgent()`
  - Produces: `analysis/htf/htf-macro.json`
  - Consumes: HTF images and cross-asset images (DXY, yields)

- [core/3.query/agents/htf/htf-liquidity-agent.ts](core/3.query/agents/htf/htf-liquidity-agent.ts)
  - Function: `htfLiquidityAgent()`
  - Called By: `runHTFOrchestrator()`
  - Calls Into: `runBaseAgent()`
  - Produces: `analysis/htf/htf-liquidity.json`
  - Consumes: HTF images and grounding chunks

- [core/3.query/agents/htf/htf-pd-array-agent.ts](core/3.query/agents/htf/htf-pd-array-agent.ts)
  - Function: `htfPDArrayAgent()`
  - Called By: `runHTFOrchestrator()`
  - Calls Into: `runBaseAgent()`
  - Produces: `analysis/htf/htf-pd-array.json`
  - Consumes: HTF images

- [core/3.query/agents/htf/htf-bias-agent.ts](core/3.query/agents/htf/htf-bias-agent.ts)
  - Function: `htfBiasAgent()` (deterministic combiner)
  - Called By: reconciler/orchestrator code paths when deterministic bias computation required
  - Calls Into: none external (pure JS logic)
  - Produces: deterministic HTF bias object

- [core/3.query/agents/itf/itf-structure-agent.ts](core/3.query/agents/itf/itf-structure-agent.ts)
  - Function: `itfStructureAgent()`
  - Called By: `runITFOrchestrator()`
  - Calls Into: `runBaseAgent()`
  - Produces: `analysis/itf/itf-structure.json`

- [core/3.query/agents/itf/itf-liquidity-agent.ts](core/3.query/agents/itf/itf-liquidity-agent.ts)
  - Function: `itfLiquidityAgent()` produces `analysis/itf/itf-liquidity.json`

- [core/3.query/agents/itf/itf-pd-array-agent.ts](core/3.query/agents/itf/itf-pd-array-agent.ts)
  - Function: `itfPDArrayAgent()` produces `analysis/itf/itf-pd-array.json`

- [core/3.query/agents/itf/itf-setup-agent.ts](core/3.query/agents/itf/itf-setup-agent.ts)
  - Function: `itfSetupAgent()` produces `analysis/itf/itf-setup.json`

- [core/3.query/agents/ltf/ltf-structure-agent.ts](core/3.query/agents/ltf/ltf-structure-agent.ts)
  - Function: `ltfStructureAgent()` produces `analysis/ltf/ltf-structure.json`

- [core/3.query/agents/ltf/ltf-liquidity-agent.ts](core/3.query/agents/ltf/ltf-liquidity-agent.ts)
  - Function: `ltfLiquidityAgent()` produces `analysis/ltf/ltf-liquidity.json`

- [core/3.query/agents/ltf/ltf-pd-array-agent.ts](core/3.query/agents/ltf/ltf-pd-array-agent.ts)
  - Function: `ltfPDArrayAgent()` produces `analysis/ltf/ltf-pd-array.json`

- [core/3.query/agents/ltf/ltf-trigger-agent.ts](core/3.query/agents/ltf/ltf-trigger-agent.ts)
  - Function: `ltfTriggerAgent()` produces `analysis/ltf/ltf-trigger.json` (final execution trigger)

- [core/3.query/agents/time/* (session,daily,weekly,monthly,quarterly,macro-time)]
  - Functions: `sessionAgent()`, `dailyAgent()`, `weeklyAgent()`, `monthlyAgent()`, `quarterlyAgent()`, `macroTimeAgent()`
  - Called By: `runTimeOrchestrator()`
  - Produce: `analysis/time/<agent>.json` files; final `analysis/time/time.json` produced by the time orchestrator itself

- [core/3.query/hierarchical-summarizer.ts]
  - Function: `summarizeTimeframeThesis()` — LLM-based summarizer producing timeframe thesis persisted implicitly when used by orchestrators

- [core/3.query/news-reasoner.ts]
  - Function: `reasonAboutNews()` — calls LLM and returns `NewsReasoningResult` used by master

- [core/3.query/scenario-engine.ts]
  - Function: `ScenarioEngine.generateScenarios()` — LLM-based scenario generation; persists via `StorageService.saveScenarios()`

- [core/news/cognition/macro-context-hydrator.ts](core/news/cognition/macro-context-hydrator.ts)
  - Functions: `getLatestMacroHydration()`, `getLatestDailyHydration()`
  - Called By: `runSystem()` to hydrate `initialHydrationContext`
  - Produces: hydration payloads used downstream by master and orchestrators

- [shared/services/storage-service.ts](shared/services/storage-service.ts)
  - Methods: `persistAnalysisOutput()`, `saveCaptureArtifact()`, `saveJson()`, `saveScenarios()`, `saveTemporalState()`
  - Called By: `runBaseAgent()`, orchestrators, master `persistNewsArtifacts()`, facade `runAnalysis()`
  - Produces: files under `capturePath/analysis/*`, `capturePath/full.json`, `capturePath/master/decision.json`, images under `capturePath/input/*`

- [shared/utils/llm-utils.ts](shared/utils/llm-utils.ts)
  - Function: `callLLM()` (single LLM client wrapper)
  - Called By: `runBaseAgent()`, orchestrators, `news-reasoner`, `hierarchical-summarizer`, `ScenarioEngine`, news cognition modules

================================================================================
End of exhaustive execution/dependency/artifact graph originating from `runSystem()`.

If you'd like, I can:
- produce a Graphviz/DOT or Mermaid diagram for the Execution Call Graph, Dependency Graph and Artifact Graph, or
- export this as JSON nodes/edges for further tooling.

Which output (diagram or JSON) do you prefer next?