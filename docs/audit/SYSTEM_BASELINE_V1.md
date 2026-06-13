# SYSTEM BASELINE V1: CODE-LEVEL SPECIFICATION

This document details the code-level baseline of the system, extracted directly from the codebase (`*.ts`, `*.js`, `*.json`).

---

## SECTION 0 — END TO END EXECUTION GRAPH

Traced from API entry point `server.js` until the final LLM response is returned for the HTF Macro step:

```text
server.js (app.post('/api/vision/multi-tf') route handler: lines 33-207)
  ↓
server.js:L155 (calls runAnalysis)
  ↓
app/facades/run-analysis.ts:L10 (runAnalysis function definition)
app/facades/run-analysis.ts:L152 (calls runSystem)
  ↓
core/4.output/run-system.ts:L27 (runSystem function definition)
core/4.output/run-system.ts:L493 (calls runHTFOrchestrator)
  ↓
core/3.query/orchestrators/htf-orchestrator.ts:L234 (runHTFOrchestrator function definition)
core/3.query/orchestrators/htf-orchestrator.ts:L290 (calls htfMacroAgent via runSafeAgent)
  ↓
core/3.query/agents/htf/htf-macro-agent.ts:L18 (htfMacroAgent function definition)
core/3.query/agents/htf/htf-macro-agent.ts:L27 (calls runBaseAgent)
  ↓
core/3.query/agents/shared/base-agent.ts:L337 (runBaseAgent function definition)
core/3.query/agents/shared/base-agent.ts:L660 (calls callLLM for final output)
  ↓
shared/utils/llm-utils.ts:L68 (callLLM function definition)
shared/utils/llm-utils.ts:L249 (calls genAI.models.generateContent to model: gemini-2.5-flash)
```

Other HTTP API Triggers:
* `server.js:L222` inside route handler `app.post('/api/analyze-session')` calls `runAnalysis`.
* `server.js:L255` inside route handler `app.post('/api/analyze')` calls `runSystem`.

---

## SECTION 1 — HTF-MACRO EXECUTION GRAPH

Traced call graph inside `htfMacroAgent` when invoking `runBaseAgent`:

```text
htfMacroAgent (core/3.query/agents/htf/htf-macro-agent.ts:L18)
  ↓
runBaseAgent (core/3.query/agents/shared/base-agent.ts:L337)
  ├─ loadPipeline (core/3.query/pipeline-processor.ts, called at base-agent.ts:L357)
  ├─ extractConcepts (core/3.query/pipeline-processor.ts, called at base-agent.ts:L358)
  ├─ buildQueries (core/3.query/query-builder.ts:L37, called at base-agent.ts:L364 with skipFinalize: true)
  ├─ buildVisionKnowledge (core/3.query/vision-grounded-knowledge.ts:L17, called at base-agent.ts:L374)
  ├─ config.pushImages (defined in htf-macro-agent.ts:L45, called at base-agent.ts:L379)
  │    └─ pushImage (base-agent.ts:L94)
  │         └─ safeToBase64 (base-agent.ts:L72)
  ├─ callLLM (shared/utils/llm-utils.ts:L68, called at base-agent.ts:L384 for vision summary)
  ├─ extractConceptsFromVision (core/3.query/vision-grounded-knowledge.ts:L65, called at base-agent.ts:L400)
  │    └─ ontologyLoader.findConceptsInText (core/3.query/ontology/loader.ts:L116, called at vision-grounded-knowledge.ts:L67)
  ├─ buildQueries (core/3.query/query-builder.ts:L37, called at base-agent.ts:L402 for Lane 1 concepts)
  ├─ visionFactExtractor.extractFacts (core/3.query/vision-signal-extractor.ts:L44, called at base-agent.ts:L412)
  ├─ visionFactExtractor.factsToQueries (core/3.query/vision-signal-extractor.ts:L194, called at base-agent.ts:L413)
  ├─ finalizeWeightedQueries (core/3.query/query-builder.ts:L308, called at base-agent.ts:L422 for Lane Merger)
  ├─ embedQueries (core/3.query/retrieval-core.ts:L250, called at base-agent.ts:L484)
  ├─ attributionTracker.reset (core/3.query/retrieval-attribution.ts:L39, called at base-agent.ts:L487)
  ├─ attributionTracker.registerLanes (core/3.query/retrieval-attribution.ts:L47, called at base-agent.ts:L519 / L526)
  ├─ retrieveRAG (core/3.query/retrieval-core.ts:L776, called at base-agent.ts:L549)
  ├─ attributionTracker.computeMetrics (core/3.query/retrieval-attribution.ts:L69, called at base-agent.ts:L578)
  ├─ buildGrounded (core/3.query/grounding.ts, called at base-agent.ts:L610)
  ├─ buildPrompt (core/3.query/prompt-builder.ts:L50, called at base-agent.ts:L639)
  ├─ callLLM (shared/utils/llm-utils.ts:L68, called at base-agent.ts:L660 for final output generation)
  ├─ verifyGrounding (shared/utils/grounding-verify.ts:L1, called at base-agent.ts:L689)
  ├─ deriveCompactOutput (base-agent.ts:L210, called at base-agent.ts:L717)
  └─ StorageService.persistAnalysisOutput (shared/services/storage-service.ts, called at base-agent.ts:L721)
```

---

## SECTION 2 — QUERY GENERATION TREE

For `buildQueries()` (defined in [core/3.query/query-builder.ts#L37](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L37)):

1. **Anchor Query Branch**
   * **State**: **ACTIVE**
   * **Code Reference**: [core/3.query/query-builder.ts:L130-L134](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L130-L134)
   * **Condition**: Pushes concept query into `expanded` with weight `1.0` if it is the `mainConcept`, else `0.8`.

2. **Canonical Expansion Branch**
   * **State**: **ACTIVE**
   * **Code Reference**: [core/3.query/query-builder.ts:L137-L153](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L137-L153)
   * **Condition**: Evaluates `const canonical = ontologyLoader.getCanonical(concept)`. If found and distinct, pushes query with weight `0.7`.

3. **Alias Expansion Branch**
   * **State**: **COMMENTED OUT (DISABLED)**
   * **Code Reference**: [core/3.query/query-builder.ts:L155-L175](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L155-L175)
   * **Condition**: Commented out with header `// DISABLED: Alias Expansion`.

4. **KnowledgeMap Templates Branch**
   * **State**: **DISABLED (UNREACHABLE)**
   * **Code Reference**: [core/3.query/query-builder.ts:L44](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L44) and [core/3.query/query-builder.ts:L90-L121](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L90-L121)
   * **Condition**: Gated by `const ENABLE_KM_TEMPLATES = false;`.

5. **Scenario Expansion Branch**
   * **State**: **ACTIVE**
   * **Code Reference**: [core/3.query/query-builder.ts:L188-L222](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L188-L222)
   * **Condition**: Gated by `if (scenarios && scenarios.active_scenarios.length > 0)`. Loops active scenarios and filters for confidence `> 0.6` to generate contradictory queries.

6. **Relational Expansion Branch**
   * **State**: **ACTIVE**
   * **Code Reference**: [core/3.query/query-builder.ts:L225-L258](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L225-L258)
   * **Condition**: Gated by `if (relational)`. Evaluates if `concepts` include reversal terms (MSS, divergence, SMT) to trigger intermarket checks (DXY and yields queries).

---

## SECTION 3 — FINALIZATION GRAPH

Tracing execution order inside `finalizeWeightedQueries()` (defined in [core/3.query/query-builder.ts#L308](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L308)):

1. **Filtering & Deduplication**
   * Loops through input queries (`for (const q of queries)`).
   * Validates query string using `isValidQuery(q.query)` (discards empty, generic or educational queries).
   * Excludes queries containing SQL/retrieval instructions (`when`, `explain`, `retrieve`).
   * Excludes queries longer than 80 characters (`q.query.length > 80`).
   * **Deduplication**: Resolves to a `Map` mapping query texts to `WeightedQuery` structures. If a query is duplicated, the instance with the higher weight is kept (`q.weight > existing.weight`).

2. **Sorting**
   * Sorts unique queries in descending order of weights (`result.sort((a, b) => b.weight - a.weight)`).

3. **Slicing (Max Query Cap)**
   * Limits results to the maximum query capacity of **15** (`result.slice(0, 15)`).

---

## SECTION 4 — RETRIEVAL GRAPH

Tracing the sequential steps inside `retrieveRAG()` (defined in [core/3.query/retrieval-core.ts#L776](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts#L776)):

1. **`embedQueries`**
   * **File**: [core/3.query/retrieval-core.ts#L250](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts#L250)
   * **Caller**: `retrieveRAG` (at line 798)

2. **`vectorSearch`**
   * **File**: [core/3.query/retrieval-core.ts#L699](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts#L699)
   * **Caller**: `retrieveRAG` (at line 803)

3. **`keywordSearch`** (BM25 Index lookup)
   * **File**: [core/3.query/retrieval-core.ts#L731](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts#L731)
   * **Caller**: `retrieveRAG` (at line 804)

4. **`fuseScores`**
   * **File**: [core/3.query/retrieval-core.ts#L542](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts#L542)
   * **Caller**: `retrieveRAG` (at line 874)

5. **`semanticDedup`**
   * **File**: [core/3.query/retrieval-core.ts#L640](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts#L640)
   * **Caller**: `retrieveRAG` (at line 912)

6. **`rerank`**
   * **File**: [core/3.query/rerank.ts#L61](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/rerank.ts#L61)
   * **Caller**: `retrieveRAG` (at line 958)

7. **`limitTokens`**
   * **File**: [core/3.query/retrieval-core.ts#L673](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts#L673)
   * **Caller**: `retrieveRAG` (at line 1001)

---

## SECTION 5 — ONTOLOGY DEPENDENCY GRAPH

Traced connections of the `ontologyLoader` instantiation:

```text
ontologyLoader (instantiated in core/3.query/ontology/loader.ts:L135)
 ├─ query-builder.ts (imported at line 2; consumes getCanonical inside buildQueries at line 137)
 ├─ scorer.ts (imported at line 1; consumes getAnnotation at line 15, getCanonical at line 30)
 ├─ rerank.ts (imported at line 4; consumes getAnnotation at line 163)
 └─ vision-grounded-knowledge.ts (imported at line 2; consumes findConceptsInText inside extractConceptsFromVision at line 67)
```

---

## SECTION 6 — FEATURE FLAG INVENTORY

List of flags checked dynamically against environment configuration or local state variables:

| Flag | File | Default Value | Affects |
| :--- | :--- | :--- | :--- |
| `process.env.ENABLE_SHADOW_RUNNER` | `server.js:L467` | `false` | Gates background execution of `shadow-runner.js` news ingestion adapters. |
| `process.env.USE_JINA_RERANK` | `core/3.query/rerank.ts:L125` | `false` | Bypasses local cross-attention LLM reranking; redirects to Jina AI API endpoints. |
| `process.env.RAG_DEBUG_DUMP` | `core/3.query/retrieval-core.ts:L807`, `core/3.query/rerank.ts:L67`, `core/3.query/query-builder.ts:L49`, `core/3.query/agents/shared/base-agent.ts:L10` | `false` | Gates the filesystem output of RAG/retrieval trace documents under `data/rag-debug`. |
| `process.env.LLM_DEBUG_DUMP` | `shared/utils/llm-utils.ts:L125` | `false` | Gates output of raw prompt-response pairs to file files under `data/llm-debug`. |
| `ENABLE_KM_TEMPLATES` | `core/3.query/query-builder.ts:L44` | `false` | Hardcoded compile-time gate. If disabled, skips generating queries using knowledge map templates. |

---

## SECTION 7 — DEAD PATH INVENTORY

Inactive, unreachable, or deprecated execution pathways currently residing in the source:

1. **Knowledge Map Template Generation**
   * **Reason Unreachable**: Gated by local flag `const ENABLE_KM_TEMPLATES = false;`
   * **File**: [core/3.query/query-builder.ts](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L44)
   * **Line**: Line 44 (gated execution spans lines 90-121).

2. **Alias-based Query Expansion**
   * **Reason Unreachable**: Manually commented out.
   * **File**: [core/3.query/query-builder.ts](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L155)
   * **Line**: Lines 155-175.

3. **Vertex AI Deprecated SDK Routing**
   * **Reason Unreachable**: Gated behind `vertexai: true` options only if Project ID and Credentials are set. The old SDK import itself is commented out.
   * **File**: [core/3.query/retrieval-core.ts](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts#L61)
   * **Line**: Lines 61-63.

---

## SECTION 8 — RUNTIME DEPENDENCY MAP

For **HTF Macro Agent** only:

* **Files Loaded**:
  * [core/3.query/agents/htf/htf-macro-agent.ts](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/agents/htf/htf-macro-agent.ts) (agent script)
  * [core/3.query/agents/shared/base-agent.ts](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts) (orchestration logic)
* **JSON Configs Loaded**:
  * `data/htf_pipeline.json` (step/concept rules, loaded at [base-agent.ts:L357](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L357))
  * `data/knowledge_map.json` (grounding mapping, loaded at [base-agent.ts:L360](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L360))
* **Ontology Loaded**:
  * `data/ontology/master_registry.json` (canonical concept definitions, loaded at [loader.ts:L28](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/ontology/loader.ts#L28))
  * `data/ontology/annotations/**/*.json` (chunk-level concepts, loaded at [loader.ts:L56](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/ontology/loader.ts#L56))
* **Vectors Loaded**:
  * `data/vectors_vertex/*.vectors.json` (embedded content database, loaded at [retrieval-core.ts:L386](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts#L386))
* **External APIs Called**:
  * `https://api.jina.ai/v1/rerank` (optional, called only if `USE_JINA_RERANK === "true"` at [rerank.ts:L32](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/rerank.ts#L32)).
* **LLMs Called**:
  * Vertex AI Gemini 2.5 Flash API endpoint (invoked twice: once for chart vision fact extraction at [base-agent.ts:L384](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L384), once for final structured generation at [base-agent.ts:L660](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L660)).

---

## SECTION 9 — SYSTEM STATE TABLE

Proven codebase status for each analysis layer component:

| Component | Exists | Active | Disabled | File |
| :--- | :--- | :--- | :--- | :--- |
| **Ontology Registry** | Yes | Yes | No | [core/3.query/ontology/loader.ts](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/ontology/loader.ts) |
| **KnowledgeMap Templates** | Yes | No | Yes | [core/3.query/query-builder.ts#L44](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L44) |
| **Scenario Expansion** | Yes | Yes | No | [core/3.query/query-builder.ts#L188](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L188) |
| **Relational Expansion** | Yes | Yes | No | [core/3.query/query-builder.ts#L225](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L225) |
| **Lane0 (Baseline)** | Yes | Yes | No | [core/3.query/agents/shared/base-agent.ts#L397](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L397) |
| **Lane1 (Ontology Vision)** | Yes | Yes | No | [core/3.query/agents/shared/base-agent.ts#L400](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L400) |
| **Lane2 (Observations)** | Yes | Yes | No | [core/3.query/agents/shared/base-agent.ts#L412](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L412) |
| **Attribution Tracking** | Yes | Yes | No | [core/3.query/retrieval-attribution.ts](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-attribution.ts) |
| **Local LLM Reranking** | Yes | Yes | No | [core/3.query/rerank.ts#L61](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/rerank.ts#L61) |
| **Grounding Formatting** | Yes | Yes | No | [core/3.query/grounding.ts](file:///D:/10.%20ict-scholar-agents-V1/core/3.query/grounding.ts) |

---

## SECTION 10 — UNKNOWNS

The following values or configurations cannot be resolved from compile-time static code checks:

1. **Jina Reranker Authentication Credentials**
   * **Details**: `process.env.JINA_API_KEY` is loaded at runtime but cannot be verified from code.
2. **Vertex AI Credentials File Validity**
   * **Details**: The file specified by `process.env.GOOGLE_APPLICATION_CREDENTIALS` is checked for existence at runtime (`fs.existsSync`) but its actual authorization validity is unknown.
3. **Database Freshness and Population**
   * **Details**: The actual count, types, and quality of stored vector embeddings and markdown chunks in `data/vectors_vertex` and `data/chunk_output` are runtime values and unknown at code compilation level.
