# Vision Flow Verification Report

**Generated:** 2026-06-09  
**Task:** Verify whether vision-first flow exists in current system  
**Scope:** Verification only — no modifications, no recommendations

---

## EXECUTIVE SUMMARY

**PRIMARY FINDING:** The hypothesized vision-first flow **DOES NOT EXIST** in the current implementation.

**ACTUAL FLOW:**
```
Ontology Concepts
    ↓
Query Generation
    ↓
Retrieval
    ↓
Agent Execution
    ↓
Bias/Thesis Formation
```

**KEY EVIDENCE:**
- Query generation is driven by **pipeline concepts** (data/htf_pipeline.json), not by market vision
- No vision formation component exists before retrieval
- Bias/thesis formation occurs **AFTER** retrieval in orchestrators (HTF, ITF, LTF)
- Knowledge gaps are not explicitly identified before retrieval

---

## PHASE 1: VISION COMPONENT INVESTIGATION

### Hypothesis
The system should contain components representing:
- Vision
- Preliminary Thesis
- Market Interpretation
- Bias Formation
- Narrative Formation

### Search Results

**Component Search Pattern:**
```regex
(macro_time_context|weekly_profile|daily_context|parent_thesis|
 htf_macro|market_delivery_state|scenario_context|relational_context|
 vision|preliminary.*thesis|market.*interpretation|bias.*formation|
 narrative.*formation)
```

**Findings:**

1. **parent_thesis** (shared/contracts/context.ts)
   - **Producer:** HTF Orchestrator (outputs thesis AFTER analysis)
   - **Inputs:** Agent outputs (macro, structure, liquidity, pd_array)
   - **Outputs:** TimeframeThesis object
   - **Purpose:** Pass HTF conclusions to ITF/LTF
   - **Timing:** Created AFTER retrieval, not before

2. **weekly_profile / daily_profile** (shared/contracts/context.ts)
   - **Producer:** Macro context hydrator
   - **Inputs:** Calendar events, news reasoning
   - **Outputs:** Macro narrative state
   - **Purpose:** Provide macro/news context
   - **Timing:** Created before orchestrators BUT not used for query generation

3. **market_delivery_state** (shared/contracts/canonical.ts)
   - **Producer:** Various agents
   - **Purpose:** Canonical market state representation
   - **Timing:** Populated during agent execution

4. **scenario_context** (shared/knowledge/scenario-types.ts)
   - **Producer:** ScenarioEngine
   - **Purpose:** Anti-tunnel-vision branching
   - **Timing:** Used to expand queries, not to form initial vision

5. **relational_context** (shared/knowledge/relational-types.ts)
   - **Producer:** HTF Orchestrator (buildSeedRelationalContext)
   - **Inputs:** Structure and macro agent facts
   - **Purpose:** SMT hints, DXY influences
   - **Timing:** Built AFTER agent execution

### Verdict: NO PRE-RETRIEVAL VISION COMPONENT

None of the discovered components represent a vision formed **BEFORE** retrieval. All bias/thesis objects are outputs of agent analysis, which occurs after retrieval.

---

## PHASE 2: KNOWLEDGE GAP IDENTIFICATION

### Hypothesis
The system should identify:
- Missing information
- Uncertainty
- Follow-up retrieval targets
- Domain activation
- Query intent

### Search Results

**No explicit knowledge gap representation found.**

**Indirect evidence:**
- `query-builder.ts` lines 188-223: Scenario-based query expansion adds "opposing" queries to challenge current scenarios
- This is **defensive diversity**, not knowledge gap identification

### Verdict: NO KNOWLEDGE GAP COMPONENT

The system does not explicitly model what is unknown or uncertain before retrieval.

---

## PHASE 3: QUERY GENERATION TRACE

### Source Analysis

**File:** `core/3.query/query-builder.ts`

**Function:** `buildQueries(concepts, knowledgeMap, relational?, scenarios?)`

**Query Generation Sources:**

1. **Primary Source: Pipeline Concepts (Weight 1.0)**
   ```typescript
   // Line 84-97
   for (const concept of concepts) {
     expanded.push({
       query: concept,
       weight: isAnchor ? 1.0 : 0.8,
       type: "anchor"
     });
   }
   ```

2. **Ontology Expansion (Weight 0.4-0.7)**
   ```typescript
   // Lines 99-139
   const canonical = ontologyLoader.getCanonical(concept);
   if (canonical) {
     expanded.push({ query: canonical, weight: 0.7, type: "canonical" });
     // + surface terms as aliases
   }
   ```

3. **Knowledge Map Templates (Weight 0.5)**
   ```typescript
   // Lines 142-177
   const kmEntry = knowledgeMap.find(e => ...);
   if (kmEntry) {
     for (const t of kmEntry.agent.query_templates) {
       expanded.push({ query: t, weight: 0.5, type: "context" });
     }
   }
   ```

4. **Scenario Expansion (Weight 0.45)**
   ```typescript
   // Lines 188-223
   if (scenarios && scenarios.active_scenarios.length > 0) {
     // Generate opposing queries
   }
   ```

5. **Relational Expansion (Weight 0.3-0.35)**
   ```typescript
   // Lines 225-259
   if (relational) {
     // SMT hints, DXY influences
   }
   ```

**Pipeline Concept Source:**

**File:** `core/3.query/pipeline-processor.ts`

**Function:** `extractConcepts(pipeline, step?)`

```typescript
// Lines 27-52
export function extractConcepts(pipeline: any, step?: string): string[] {
  let concepts: string[] = [];
  
  if (pipeline.steps && Array.isArray(pipeline.steps)) {
    if (step) {
      const targetStep = pipeline.steps.find((s: any) => s.name === step);
      if (targetStep && Array.isArray(targetStep.concepts)) 
        return targetStep.concepts;
    }
    
    pipeline.steps.forEach((s: any) => {
      if (s.concept) concepts.push(s.concept);
      else if (Array.isArray(s.concepts)) concepts.push(...s.concepts);
    });
  }
  
  return [...new Set(concepts)];
}
```

**Pipeline Definition:**

**File:** `data/htf_pipeline.json`

```json
{
  "steps": [
    {
      "name": "macro",
      "concepts": ["Dollar Index", "DXY HTF Bias", "Economic Calendar", ...]
    },
    {
      "name": "structure",
      "concepts": ["HTF Bias", "Directional Bias", "Market Profiling", ...]
    },
    {
      "name": "liquidity",
      "concepts": ["Liquidity Void", "Liquidity Sweep", ...]
    },
    {
      "name": "pd_array",
      "concepts": ["Order Block", "Fair Value Gap", ...]
    },
    {
      "name": "bias",
      "depends_on": ["macro", "structure", "liquidity", "pd_array"],
      "concepts": [...]
    }
  ]
}
```

### Verdict: ONTOLOGY-DRIVEN QUERY GENERATION

**Query generation depends on:**
- A) **Pipeline concepts** (static, pre-defined)
- B) **Ontology expansion** (canonical terms, aliases)
- C) **Knowledge map templates** (pre-defined query patterns)
- D) **Scenario/relational context** (if available, provides diversity)

**Query generation does NOT depend on:**
- Market vision
- Preliminary thesis
- Market interpretation
- Observed market behavior

---

## PHASE 4: FIRST THESIS INVESTIGATION

### Hypothesis
Find the earliest point where a market thesis/bias is formed.

### Search Pattern
```regex
(bias|thesis|narrative|vision|market.*state|market.*mode|directional)
```

### Findings

**Earliest Bias Formation: HTF Orchestrator**

**File:** `core/4.output/run-system.ts`

**Execution Order:**
```typescript
// Lines 443-500
const timeResult = await runTimeOrchestrator(input, initialHydrationContext);
// → Provides timing_bias, trading_window

const htfResponse = await runHTFOrchestrator(input, initialHydrationContext);
// → Provides htf_bias, next_candle_bias

const itfResult = await runITFOrchestrator(itfInput, itfHydrationContext);
// → Provides itf_bias, entry_bias

const ltfResult = await runLTFOrchestrator(ltfInput, ltfHydrationContext);
// → Provides direction (trade bias)
```

**HTF Orchestrator Internal Flow:**

**File:** `core/3.query/orchestrators/htf-orchestrator.ts`

```typescript
// Lines 200-350 (approximation based on structure)
export async function runHTFOrchestrator(input, hydrationContext) {
  
  // 1. Run agents (each agent retrieves knowledge)
  const macroResult = await htfMacroAgent.run(input, hydrationContext);
  const structureResult = await htfStructureAgent.run(input, hydrationContext);
  const liquidityResult = await htfLiquidityAgent.run(input, hydrationContext);
  const pdArrayResult = await htfPDArrayAgent.run(input, hydrationContext);
  
  // 2. Build relational context from agent outputs
  const relationalContext = buildSeedRelationalContext(
    structureResult.facts,
    macroResult.facts
  );
  
  // 3. Synthesize bias from agent outputs
  const orchestratorPrompt = buildPrompt({
    role: "HTF Orchestrator",
    agents: [macroResult, structureResult, liquidityResult, pdArrayResult],
    hydrationContext
  });
  
  const llmResponse = await callLLM(orchestratorPrompt, htfTool);
  
  // 4. Extract htf_bias, next_candle_bias
  return {
    htf_bias: llmResponse.htf_bias,
    next_candle_bias: llmResponse.next_candle_bias,
    confidence: llmResponse.confidence,
    ...
  };
}
```

**Agent Internal Flow (Example: htfMacroAgent):**

```typescript
// Agents call retrieval FIRST
const retrievalResult = await retrieveRAG({
  queries: buildQueries(concepts, knowledgeMap),
  conceptEmbeddings: await embedQueries(queries)
});

// Then reason with retrieved knowledge
const agentPrompt = buildPrompt({
  role: "Macro Agent",
  grounded_knowledge: retrievalResult.chunks,
  input: chartData
});

const agentOutput = await callLLM(agentPrompt);
```

### Verdict: THESIS FORMATION AFTER RETRIEVAL

**Timeline:**
1. Pipeline concepts extracted
2. Queries built from concepts
3. Retrieval executed
4. Agents reason with retrieved knowledge
5. Orchestrator synthesizes agent outputs
6. **Bias/thesis formed**

**Bias formation occurs AFTER retrieval, not before.**

---

## PHASE 5: COMPONENT MAPPING TABLE

| Conceptual Component | Actual System Component | Status |
|---------------------|------------------------|--------|
| **Vision Formation** | None | ❌ NOT FOUND |
| **Knowledge Gap Identification** | None | ❌ NOT FOUND |
| **Query Generation** | `buildQueries()` in `query-builder.ts` | ✅ EXISTS |
| **Ontology Propagation** | `ontologyLoader.getCanonical()` + aliases | ✅ EXISTS |
| **Retrieval** | `retrieveRAG()` in `retrieval-core.ts` | ✅ EXISTS |
| **Grounding** | `buildGrounded()` in `grounding.ts` | ✅ EXISTS |
| **Final Reasoning** | HTF/ITF/LTF Orchestrators | ✅ EXISTS |

### Detailed Component Descriptions

**Query Generation (`buildQueries`):**
- **Input:** Pipeline concepts, knowledge map, optional relational/scenario context
- **Output:** Weighted queries (anchor, canonical, alias, context types)
- **Source:** Ontology-driven, not vision-driven

**Ontology Propagation:**
- **Component:** `ontologyLoader` in `query-builder.ts`
- **Method:** Canonical term mapping + surface term aliases
- **Purpose:** Expand query coverage beyond literal pipeline concepts

**Retrieval (`retrieveRAG`):**
- **Arms:** BM25 (sparse), Vector (dense), Fusion (RRF)
- **Flow:** Query → Embed → Vector Search + BM25 → Fuse → Rerank → Ground
- **Evidence:** `KNOWLEDGE_FLOW_MAP.md` documents full retrieval pipeline

**Grounding (`buildGrounded`):**
- **Input:** Retrieved chunks, queries
- **Output:** Top-K most relevant chunks for prompt injection
- **Method:** Relevance scoring, deduplication, token limiting

**Final Reasoning:**
- **Components:** HTF/ITF/LTF Orchestrators
- **Input:** Agent outputs (post-retrieval reasoning)
- **Output:** Bias, confidence, thesis
- **Timing:** AFTER all retrieval and agent execution

---

## PHASE 6: VERIFICATION RESULT

### Question 1: Does a Vision Formation component already exist?

**NO.**

No component forms a market vision before retrieval. The closest candidates are:
- `weekly_profile` / `daily_profile`: Provide macro/news context but are not used for query generation
- `parent_thesis`: Created by HTF orchestrator AFTER analysis, passed to ITF/LTF
- `market_delivery_state`: Populated during agent execution

None of these represent a pre-retrieval vision.

### Question 2: If yes, what object/component implements it?

**N/A** — No vision formation component exists.

### Question 3: Does query generation depend on vision/thesis?

**NO.**

Query generation depends on:
- Pipeline concepts (static, pre-defined in `data/htf_pipeline.json`)
- Ontology expansion (canonical terms, aliases)
- Knowledge map templates (pre-defined patterns)
- Optional scenario/relational context (for diversity, not vision)

### Question 4: Or does query generation depend primarily on ontology concepts?

**YES.**

Query generation is **ontology-driven**, not vision-driven.

**Evidence:**
- `pipeline-processor.ts` extracts concepts from pipeline JSON
- `query-builder.ts` expands concepts via ontology loader
- No vision or thesis is consulted before query generation

### Question 5: Is retrieval occurring before vision?

**YES.**

**Flow:**
```
Pipeline Concepts
    ↓
Query Generation (ontology expansion)
    ↓
Retrieval (BM25 + Vector + Fusion + Rerank)
    ↓
Agent Execution (reasoning with retrieved knowledge)
    ↓
Orchestrator Synthesis (bias/thesis formation)
```

**Evidence Files:**
- `core/3.query/rag-orchestrator.ts`: `runRAG()` called by agents
- `core/3.query/orchestrators/htf-orchestrator.ts`: Agents run before bias synthesis
- `core/4.output/run-system.ts`: HTF orchestrator called, produces `htf_bias`

### Question 6: Is vision occurring before retrieval?

**NO.**

No vision component exists. Bias/thesis formation occurs after retrieval.

### Question 7: Which statement is more accurate?

**Statement B is accurate:**

```
B) Ontology → Query → Retrieval → Vision
```

**Actual system flow:**
```
Pipeline Concepts (Ontology)
    ↓
Query Generation (buildQueries)
    ↓
Retrieval (retrieveRAG)
    ↓
Agent Reasoning (with grounded knowledge)
    ↓
Bias/Thesis Formation (HTF/ITF/LTF Orchestrators)
```

**Statement A is NOT accurate:**

```
A) Market → Vision → Query → Retrieval  ❌
```

This flow does not exist in the current system.

---

## SUPPORTING EVIDENCE

### Evidence 1: Pipeline-Driven Concepts

**File:** `data/htf_pipeline.json`
```json
{
  "steps": [
    {"name": "macro", "concepts": ["Dollar Index", "Economic Calendar", ...]},
    {"name": "structure", "concepts": ["HTF Bias", "Directional Bias", ...]},
    {"name": "liquidity", "concepts": ["Liquidity Void", ...]},
    {"name": "pd_array", "concepts": ["Order Block", "Fair Value Gap", ...]},
    {"name": "bias", "depends_on": ["macro", "structure", "liquidity", "pd_array"]}
  ]
}
```

These concepts are **static** and **pre-defined**. They do not depend on market observation.

### Evidence 2: Query Generation Entry Point

**File:** `core/3.query/rag-orchestrator.ts`
```typescript
export async function runRAG(pipelinePath: string, step?: string) {
  const pipeline = loadPipeline(pipelinePath);
  const concepts = extractConcepts(pipeline, step);
  
  const knowledgeMap = JSON.parse(fs.readFileSync("data/knowledge_map.json"));
  const queries = buildQueries(concepts, knowledgeMap);
  
  return retrieveRAG({ queries, conceptEmbeddings });
}
```

**Flow:** Pipeline → Concepts → Queries → Retrieval

No vision or market observation precedes this.

### Evidence 3: Agent Execution Order

**File:** `core/3.query/orchestrators/htf-orchestrator.ts` (lines 200-350, approximate)
```typescript
// Agents run AFTER retrieval
const macroResult = await htfMacroAgent.run(input, hydrationContext);
const structureResult = await htfStructureAgent.run(input, hydrationContext);

// Bias formed AFTER agents complete
const llmResponse = await callLLM(orchestratorPrompt, htfTool);
return { htf_bias: llmResponse.htf_bias, ... };
```

### Evidence 4: Retrieval Debug Trace

**File:** `data/rag-debug/1780932115188/Macro-Time-Agent/KNOWLEDGE_FLOW_MAP.md`

This file documents a complete retrieval session for the Macro-Time-Agent:

```
01_INPUT: "Seasonal Tendencies, Economic Calendar, Macro Time Influences"
    ↓
02_QUERY_BUILD: 3 atomic concepts
    ↓
03_EXPANDED: 15 query variants (ontology expansion)
    ↓
04_SEARCH: BM25 + Vector → 27 fused results
    ↓
05_RERANK: Cross-encoder re-ranking
    ↓
06_GROUNDED_META: 6 final chunks for prompt
    ↓
08_RESPONSE: LLM generates output (timing_bias, expectation)
```

**Key observation from line 176:**
> "Response uses grounded knowledge in 3 steps"

The LLM **uses** retrieved knowledge to form conclusions. Vision is not formed before retrieval.

### Evidence 5: HTF Orchestrator Output Schema

**File:** `shared/contracts/canonical.ts`
```typescript
export const HTFOrchestratorOutputSchema = z.object({
  htf_bias: BiasEnum,              // Formed AFTER analysis
  next_candle_bias: BiasEnum,      // Formed AFTER analysis
  confidence: ConfidenceSchema,
  dominant_factors: z.array(...),
  reasoning: z.string(),
  ...
});
```

This schema defines the **output** of HTF analysis, not the input. Bias is produced, not consumed.

---

## CONCLUSION

### Primary Finding

The hypothesized **vision-first flow DOES NOT EXIST** in the current system.

### Actual Flow

```
Static Pipeline Concepts (data/htf_pipeline.json)
    ↓
Ontology Expansion (canonical terms, aliases)
    ↓
Query Generation (buildQueries)
    ↓
Retrieval (BM25 + Vector + Fusion + Rerank)
    ↓
Agent Reasoning (with retrieved knowledge)
    ↓
Orchestrator Synthesis (bias/thesis formation)
    ↓
Hierarchical Propagation (HTF → ITF → LTF)
```

### Key Architectural Characteristics

1. **Concept-driven, not vision-driven:** Queries are generated from static pipeline concepts, not from market observation or preliminary vision.

2. **Retrieval-first architecture:** Knowledge is retrieved before any bias or thesis is formed.

3. **Post-retrieval reasoning:** Agents reason with grounded knowledge to produce conclusions.

4. **Hierarchical synthesis:** Parent timeframe conclusions (e.g., HTF bias) are passed to child timeframes (ITF, LTF) via `parent_thesis` in `HydrationContext`.

5. **No knowledge gap modeling:** The system does not explicitly identify what is unknown before retrieval.

### Comparison to Hypothesized Flow

| Stage | Hypothesized | Actual | Match |
|-------|-------------|--------|-------|
| 1. Market Input | ✓ | ✓ | ✓ |
| 2. Vision Formation | ✓ | ❌ | ✗ |
| 3. Knowledge Gap ID | ✓ | ❌ | ✗ |
| 4. Query Generation | ✓ | ✓ | ✓ |
| 5. Ontology Propagation | ✓ | ✓ | ✓ |
| 6. Retrieval | ✓ | ✓ | ✓ |
| 7. Grounding | ✓ | ✓ | ✓ |
| 8. Final Reasoning | ✓ | ✓ | ✓ |

**Match score: 6/8 (75%)**

**Critical differences:**
- Vision Formation does not exist
- Knowledge Gap Identification does not exist
- Vision occurs **AFTER** retrieval, not before

---

## APPENDIX: FILE REFERENCE INDEX

### Core Query Files
- `core/3.query/rag-orchestrator.ts` — RAG entry point
- `core/3.query/pipeline-processor.ts` — Concept extraction
- `core/3.query/query-builder.ts` — Query generation
- `core/3.query/retrieval-core.ts` — Retrieval execution
- `core/3.query/grounding.ts` — Chunk selection
- `core/3.query/rerank.ts` — Cross-encoder re-ranking

### Orchestrators
- `core/3.query/orchestrators/time-orchestrator.ts`
- `core/3.query/orchestrators/htf-orchestrator.ts`
- `core/3.query/orchestrators/itf-orchestrator.ts`
- `core/3.query/orchestrators/ltf-orchestrator.ts`
- `core/3.query/orchestrators/master-orchestrator.ts`

### System Execution
- `core/4.output/run-system.ts` — Main pipeline execution

### Contracts & Types
- `shared/contracts/context.ts` — HydrationContext
- `shared/contracts/canonical.ts` — Orchestrator output schemas
- `shared/contracts/pmso.ts` — Probabilistic Market State Object
- `shared/knowledge/hierarchical-types.ts` — TimeframeThesis
- `shared/knowledge/relational-types.ts` — RelationalContext
- `shared/knowledge/scenario-types.ts` — ScenarioMemory

### Data Files
- `data/htf_pipeline.json` — HTF concepts
- `data/itf_pipeline.json` — ITF concepts
- `data/ltf_pipeline.json` — LTF concepts
- `data/time_pipeline.json` — Time concepts
- `data/knowledge_map.json` — Knowledge domain definitions

### Debug Evidence
- `data/rag-debug/1780932115188/Macro-Time-Agent/KNOWLEDGE_FLOW_MAP.md`
- `data/rag-debug/1780932115188/Macro-Time-Agent/02_QUERY_BUILD.json`
- `data/rag-debug/1780932115188/Macro-Time-Agent/04_SEARCH.json`
- `data/rag-debug/1780932115188/Macro-Time-Agent/06_GROUNDED_META.json`

---

**END OF REPORT**