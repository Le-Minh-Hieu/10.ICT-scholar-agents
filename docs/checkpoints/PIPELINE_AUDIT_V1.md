# PIPELINE FORMAT AUDIT REPORT — ICT SCHOLAR AGENTS V1

**Auditor:** Senior System Architect  
**Date:** 2025  
**Scope:** HTF / ITF / LTF Pipeline Format Consistency  

---

## 1. CURRENT STATE SUMMARY

### 1.1 HTF Pipeline (Migrated — STABLE)

| Property | Value |
|----------|-------|
| **Entry Point** | `core/3.query/orchestrators/htf-orchestrator.ts` |
| **Input Schema** | `HTFOrchestratorInput` — structured chart paths (EURUSD: {d,w,m}, DXY: {d,w,m}, US10Y: {d,w,m}, US20Y: {d,w,m}, GBPUSD: {d,w,m}) |
| **Internal Steps** | 4 parallel agents (macro, structure, liquidity, pd_array) → 1 bias synthesizer |
| **Retrieval** | `retrieveRAG()` via `retrieval-core.ts` using `data/htf_pipeline.json` |
| **Knowledge Map** | Consumed via `retrieval-core.ts` (RAG on vector + BM25 index) |
| **Grounding** | Per-agent: `buildGrounded(chunks)` inside each HTF agent |
| **Agent Calls** | Orchestrator calls 4 agents in parallel with `Promise.allSettled()` |
| **Output Schema** | `HTFOrchestratorOutput`: {bias, short_term_expectation, state, tradable, confidence, narrative} |
| **Key Feature** | Vision-based chart analysis (Gemini 2.5 Pro with inline images) |

### 1.2 ITF Pipeline (Partially Migrated — UNSTABLE)

| Property | Value |
|----------|-------|
| **Entry Point** | `core/3.query/orchestrators/itf-orchestrator.ts` |
| **Input Schema** | `ITFInput`: {query: string, optional_context: string} |
| **Internal Steps** | HTF bias fetch → retrieval → grounding → 3 parallel agents (structure, liquidity, pd_array) → 1 setup validator |
| **Retrieval** | `retrieveITFKnowledge()` via `retrieval.ts` using `data/itf_pipeline.json` |
| **Knowledge Map** | Consumed via `retrieval.ts` (knowledge_map.json lookup, NOT RAG) |
| **Grounding** | Centralized: `groundContext(retrievalResult)` in orchestrator |
| **Agent Calls** | Orchestrator calls HTF first, then 3 ITF agents in parallel, then setup agent |
| **Output Schema** | `ITFOutput`: {valid, direction, confidence, narrative} |
| **Key Feature** | NO vision; text-only LLM agents; injects HTF bias as context string |

### 1.3 LTF Pipeline (Partially Migrated — UNSTABLE)

| Property | Value |
|----------|-------|
| **Entry Point** | `core/3.query/orchestrators/ltf-orchestrator.ts` |
| **Input Schema** | `LTFInput`: {query: string, optional_context: string} |
| **Internal Steps** | HTF bias → ITF setup → retrieval → grounding → 3 parallel agents (structure, liquidity, pd_array) → 1 trigger agent |
| **Retrieval** | `retrieveLTFKnowledge()` via `retrieval.ts` using `data/ltf_pipeline.json` |
| **Knowledge Map** | Consumed via `retrieval.ts` (same as ITF) |
| **Grounding** | Centralized: `groundContext(retrievalResult)` in orchestrator |
| **Agent Calls** | Orchestrator calls HTF, then ITF, then 3 LTF agents, then trigger agent |
| **Output Schema** | `LTFOutput`: {execute, direction, confidence, entry, narrative, _htf, _itf} |
| **Key Feature** | NO vision; text-only; includes upstream outputs as `_htf` and `_itf` (raw passthrough) |

---

## 2. PIPELINE COMPARISON TABLE

| Dimension | HTF | ITF | LTF |
|-----------|-----|-----|-----|
| **Input Type** | Structured chart objects | Free-text query | Free-text query |
| **Input Fields** | `eurusd`, `dxy`, `us10y`, `us20y`, `gbpusd` | `query`, `optional_context` | `query`, `optional_context` |
| **Retrieval Method** | `retrieval-core.ts` (RAG: vector + BM25) | `retrieval.ts` (knowledge map lookup) | `retrieval.ts` (knowledge map lookup) |
| **Retrieval Source** | `data/htf_pipeline.json` + vector index | `data/itf_pipeline.json` + `knowledge_map.json` | `data/ltf_pipeline.json` + `knowledge_map.json` |
| **Grounding Location** | Inside each agent | Centralized in orchestrator | Centralized in orchestrator |
| **Grounding Format** | `buildGrounded(chunks)` → string | `groundContext()` → `GroundedContext` (keyed by step) | `groundContext()` → `GroundedContext` (keyed by step) |
| **Agent Execution** | `Promise.allSettled()` (parallel) | `Promise.all()` (parallel) | `Promise.all()` (parallel) |
| **Vision Enabled** | YES (Gemini 2.5 Pro with images) | NO | NO |
| **LLM Backend** | Gemini Vision API | `callLLM()` (generic) | `callLLM()` (generic) |
| **Bias/Context Injection** | None (top of stack) | HTF bias string injected | HTF + ITF combined string injected |
| **Output Fields** | 6 fields (bias, short_term_expectation, state, tradable, confidence, narrative) | 4 fields (valid, direction, confidence, narrative) | 6 fields (execute, direction, confidence, entry, narrative, + raw passthroughs) |
| **Output Type** | `HTFOrchestratorOutput` | `ITFOutput` | `LTFOutput` |
| **Downstream Coupling** | Returns `bias` field | Consumes `htfResult.bias` | Consumes `htfResult.bias` + `itfResult.valid/direction` |
| **Error Handling** | `allSettled` with per-agent fallbacks | No explicit fallback in orchestrator | Early return if ITF invalid |
| **Pipeline JSON Format** | `{steps: [{name, concepts: [...]}]}` | `{steps: [{concept, type, layer}]}` | `{steps: [{concept, type, layer}]}` |

---

## 3. FORMAT DIFF ANALYSIS

### 3.1 Schema Differences

#### A. Input Schema Mismatch
- **HTF** expects structured chart image paths (`eurusd.d`, `eurusd.w`, `eurusd.m`, etc.)
- **ITF/LTF** expect free-text `query` + `optional_context`
- **Impact:** ITF/LTF cannot be called with the same input facade as HTF; the orchestration layer must branch

#### B. Pipeline JSON Format Mismatch
- **HTF pipeline JSON** uses: `{ "steps": [ { "name": "macro", "concepts": [...] } ] }`
- **ITF/LTF pipeline JSON** uses: `{ "steps": [ { "concept": "...", "type": "...", "layer": "ITF" } ] }`
- **Impact:** `retrieval-core.ts` and `retrieval.ts` have separate `extractConcepts()` logic to handle both formats. This is a maintenance hazard.

#### C. Output Schema Mismatch
- **HTF** outputs: `bias`, `short_term_expectation`, `state`, `tradable`, `confidence`, `narrative`
- **ITF** outputs: `valid`, `direction`, `confidence`, `narrative`
- **LTF** outputs: `execute`, `direction`, `confidence`, `entry`, `narrative`
- **Impact:** No shared output interface. The `MasterOutput` type in `types/output-schema.ts` uses `any` for all layers, effectively bypassing type safety.

#### D. Retrieval Interface Mismatch
- **HTF** uses `retrieveRAG({ pipelinePath, step })` → returns `Chunk[]`
- **ITF/LTF** use `retrieveITFKnowledge(query, optional_context)` → returns `RetrievalResult` (keyed by step name)
- **Impact:** Different retrieval signatures mean agents cannot be swapped across pipelines.

#### E. Grounding Format Mismatch
- **HTF** agents call `buildGrounded(chunks)` internally and receive a single string
- **ITF/LTF** agents receive `string[]` (array of grounded context strings) passed from orchestrator
- **Impact:** Agent signatures are incompatible. An HTF agent cannot be dropped into an ITF orchestrator.

#### F. Agent Signature Mismatch
- **HTF agents**: `(input: ChartPaths) => Promise<AgentOutput>`
- **ITF agents**: `(context: string[], query: string, optional_context: string) => Promise<AgentOutput>`
- **LTF agents**: `(context: string[], query: string, htf_itf_context: string) => Promise<AgentOutput>`
- **Impact:** Complete signature divergence. No shared agent interface exists.

### 3.2 Behavioral Differences

| Behavior | HTF | ITF | LTF |
|----------|-----|-----|-----|
| **Uses RAG (vector + BM25)** | YES | NO | NO |
| **Uses Knowledge Map lookup** | NO (bypasses retrieval.ts) | YES | YES |
| **Vision analysis** | YES | NO | NO |
| **Query-first signal extraction** | NO | YES | YES |
| **Deterministic bias synthesis** | YES (rule-based `htfBiasAgent`) | NO (LLM-based `itfSetupAgent`) | NO (LLM-based `ltfTriggerAgent`) |
| **Hard conflict rules** | YES (structured) | YES (prompt-level) | YES (prompt-level) |
| **Returns raw upstream data** | NO | NO | YES (`_htf`, `_itf`) |
| **Early termination** | NO | NO | YES (if ITF invalid) |

---

## 4. ROOT CAUSE IDENTIFICATION

### 4.1 No Shared Interface Contract

**Evidence:**
- There is no `BasePipeline`, `BaseOrchestrator`, `BaseAgent`, or `PipelineInput`/`PipelineOutput` interface
- Each pipeline defines its own input/output types inline in the orchestrator file
- The `MasterOutput` type uses `any` for all layer outputs (`htf: any`, `itf: any`, `ltf: any`), indicating the system acknowledges divergence but chose not to enforce consistency

**Root Cause:** HTF was built first with a specific vision-based architecture. When ITF and LTF were added, they were built as independent text-based pipelines rather than as implementations of a shared contract.

### 4.2 Pipelines Built at Different Times Without Standardization

**Evidence:**
- `docs/checkpoints/FULL_SYSTEM_V1.md` states: "STABLE V1 — READY FOR ORCHESTRATION — NEXT: Build ITF orchestrator, Then LTF execution orchestrator"
- HTF has a `validation` block in its pipeline JSON; ITF/LTF do not
- HTF agents use `Promise.allSettled()`; ITF/LTF use `Promise.all()`
- HTF has per-agent debug file writes (`debug-*-chunks.txt`); ITF/LTF have none

**Root Cause:** HTF was developed, tested, and locked as V1 before ITF/LTF design began. ITF/LTF were built by adapting the HTF concept but using a different technical approach (text-only LLM vs vision LLM) without refactoring HTF to a common base.

### 4.3 Knowledge Map Only Integrated at ITF/LTF Layer (Not HTF)

**Evidence:**
- HTF agents import `retrieveRAG` from `retrieval-core.ts` and bypass `retrieval.ts` entirely
- ITF/LTF orchestrators import `retrieveITFKnowledge` / `retrieveLTFKnowledge` from `retrieval.ts`
- `retrieval.ts` performs knowledge map lookups and layer filtering; `retrieval-core.ts` performs vector + BM25 search

**Root Cause:** Two separate retrieval systems exist. HTF uses the original RAG system (built for chunk retrieval). ITF/LTF use the newer knowledge map system (built for agent classification). These were never unified.

### 4.4 Agents Designed Independently Without Shared Protocol

**Evidence:**
- HTF agents have no shared base class or interface
- ITF/LTF agents share a similar pattern (context, query, optional_context) but this is accidental, not by design
- Each agent defines its own fallback values inline
- Each agent has its own prompt template structure with no shared template engine

**Root Cause:** Agent development was copy-paste driven. ITF agents were created by copying HTF agent logic and removing vision, then LTF agents were copied from ITF agents. No abstraction layer was introduced.

### 4.5 Retrieval System Divergence

**Evidence:**
- `retrieval-core.ts`: 400+ lines, handles vector search, BM25, embedding batching, semantic dedup, reranking
- `retrieval.ts`: 200+ lines, handles knowledge map JSON parsing, concept matching, layer filtering
- Both have different `extractConcepts()` implementations to handle different pipeline JSON shapes

**Root Cause:** The knowledge map was introduced after the RAG system was built. Instead of extending `retrieval-core.ts` to support knowledge map lookups, a parallel `retrieval.ts` was created. Both systems remain active with no unification plan.

---

## 5. UNIFIED PIPELINE CONTRACT DESIGN

### 5.1 Design Principles

1. **Single Input Contract:** All pipelines accept the same base input, with optional extensions
2. **Single Output Contract:** All pipelines emit the same base output shape, with layer-specific extensions
3. **Shared Retrieval Interface:** One retrieval system serves all pipelines
4. **Shared Grounding Format:** One grounding function produces context for all agents
5. **Shared Agent Protocol:** One agent interface that all agents implement
6. **Composability:** Each layer's output can be fed into the next layer as typed input

### 5.2 Unified Input Contract

```typescript
interface UnifiedPipelineInput {
  // Core query (required for all pipelines)
  query: string;
  
  // Optional chart data (required for HTF, optional for ITF/LTF)
  charts?: {
    eurusd?: { d?: string; w?: string; m?: string };
    gbpusd?: { d?: string; w?: string; m?: string };
    dxy?:    { d?: string; w?: string; m?: string };
    us10y?:  { d?: string; w?: string; m?: string };
    us20y?:  { d?: string; w?: string; m?: string };
  };
  
  // Optional context injection
  optional_context?: string;
  
  // Layer control (for partial execution or testing)
  layers?: ("htf" | "itf" | "ltf")[];
  
  // Metadata
  session_id?: string;
  timestamp?: string;
}
```

### 5.3 Unified Intermediate Representation (IR)

```typescript
interface PipelineIR {
  // Retrieved knowledge (shared across all layers)
  retrieved: {
    htf: KnowledgeChunk[];
    itf: KnowledgeChunk[];
    ltf: KnowledgeChunk[];
  };
  
  // Grounded context (shared across all layers)
  grounded: {
    htf: GroundedContext;
    itf: GroundedContext;
    ltf: GroundedContext;
  };
  
  // Layer outputs (composable)
  layers: {
    htf: HTFLayerOutput;
    itf: ITFLayerOutput;
    ltf: LTFLayerOutput;
  };
  
  // Execution trace
  trace: {
    agent: string;
    input: any;
    output: any;
    duration_ms: number;
    error?: string;
  }[];
}

interface KnowledgeChunk {
  chunk_id: string;
  text: string;
  score: number;
  source: string;        // "rag" | "knowledge_map"
  layer: string;         // "htf" | "itf" | "ltf"
  step: string;          // "macro" | "structure" | "liquidity" | "pd_array" | ...
}
```

### 5.4 Unified Retrieval Interface

```typescript
interface UnifiedRetrievalConfig {
  pipeline_path: string;
  layer: "htf" | "itf" | "ltf";
  step?: string;           // Optional: filter to specific step
  query: string;
  use_rag?: boolean;       // Enable vector + BM25 search
  use_knowledge_map?: boolean; // Enable knowledge map lookup
  top_k?: number;
}

async function unifiedRetrieve(config: UnifiedRetrievalConfig): Promise<KnowledgeChunk[]> {
  // 1. Load pipeline JSON (handles both format shapes)
  // 2. Extract concepts (unified extractor)
  // 3. If use_rag: call retrieval-core.ts
  // 4. If use_knowledge_map: call retrieval.ts
  // 5. Merge, deduplicate, score
  // 6. Return unified KnowledgeChunk[]
}
```

### 5.5 Unified Grounding Format

```typescript
interface GroundedContext {
  [stepName: string]: {
    concept: string;
    type: string;
    signal: string;
    focus: string[];
    when_to_use: string;
    invalid_when: string;
    source_chunks: KnowledgeChunk[];
  }[];
}

function unifiedGround(chunks: KnowledgeChunk[]): GroundedContext {
  // Groups chunks by step
  // Enriches with knowledge map metadata if available
  // Returns structured context for agent consumption
}
```

### 5.6 Unified Agent Protocol

```typescript
interface AgentInput {
  query: string;
  context: GroundedContext;
  upstream?: LayerOutput;  // Output from previous layer
  charts?: ChartData;      // For vision-enabled agents
}

interface AgentOutput {
  status: "success" | "fallback" | "error";
  data: any;               // Layer-specific output
  confidence: "high" | "medium" | "low";
  notes: string;
  reasoning: string[];
}

interface BaseAgent {
  name: string;
  layer: "htf" | "itf" | "ltf";
  step: string;
  execute(input: AgentInput): Promise<AgentOutput>;
}
```

### 5.7 Unified Orchestrator Contract

```typescript
interface OrchestratorConfig {
  layers: ("htf" | "itf" | "ltf")[];
  enable_vision?: boolean;
  enable_knowledge_map?: boolean;
  early_termination?: boolean;  // Stop if upstream invalid
}

async function runUnifiedOrchestrator(
  input: UnifiedPipelineInput,
  config: OrchestratorConfig
): Promise<UnifiedPipelineOutput>;
```

### 5.8 Unified Output Schema

```typescript
interface UnifiedPipelineOutput {
  decision: {
    execute: boolean;
    direction: "bullish" | "bearish" | "neutral";
    confidence: "high" | "medium" | "low";
    entry_zone?: string;
    stop_loss?: string;
    target?: string;
    notes: string;
  };
  
  layers: {
    htf: {
      bias: "bullish" | "bearish" | "neutral";
      short_term_expectation: "bullish" | "bearish" | "neutral";
      state: "trending" | "pullback" | "consolidation";
      tradable: boolean;
      confidence: "high" | "medium" | "low";
      narrative: string;
    };
    
    itf: {
      valid: boolean;
      direction: "bullish" | "bearish" | "neutral";
      confidence: "high" | "medium" | "low";
      narrative: string;
    };
    
    ltf: {
      execute: boolean;
      direction: "bullish" | "bearish" | "neutral";
      confidence: "high" | "medium" | "low";
      entry: string;
      narrative: string;
    };
  };
  
  metadata: {
    query: string;
    timestamp: string;
    processing_time_ms: number;
    trace: PipelineIR["trace"];
  };
}
```

---

## 6. MIGRATION PLAN

### 6.1 Phase 1: ITF Migration (Priority: CRITICAL)

#### Step 1: Create Unified Contracts (Week 1)
- [ ] Create `shared/contracts/pipeline-contracts.ts`
- [ ] Define `UnifiedPipelineInput`, `UnifiedPipelineOutput`, `AgentInput`, `AgentOutput`, `BaseAgent`
- [ ] Define `KnowledgeChunk`, `GroundedContext`, `UnifiedRetrievalConfig`
- [ ] Update `types/output-schema.ts` to use unified types (deprecate `any`)

#### Step 2: Unify Retrieval System (Week 1-2)
- [ ] Create `core/3.query/unified-retrieval.ts`
- [ ] Port `retrieval-core.ts` logic into unified retriever as `RAGStrategy`
- [ ] Port `retrieval.ts` logic into unified retriever as `KnowledgeMapStrategy`
- [ ] Implement strategy selector based on `UnifiedRetrievalConfig`
- [ ] Update all pipeline JSONs to unified format (or add adapter)
- [ ] Add `source` field to returned chunks ("rag" | "knowledge_map")

#### Step 3: Unify Grounding (Week 2)
- [ ] Create `core/3.query/unified-grounding.ts`
- [ ] Implement `unifiedGround()` that accepts `KnowledgeChunk[]` and returns `GroundedContext`
- [ ] Update HTF agents to accept `GroundedContext` instead of raw string
- [ ] Update ITF/LTF agents to consume new `GroundedContext` shape

#### Step 4: Refactor ITF Orchestrator (Week 2-3)
- [ ] Rewrite `itf-orchestrator.ts` to use unified contracts
- [ ] Change input from `ITFInput` to `UnifiedPipelineInput`
- [ ] Change output from `ITFOutput` to `UnifiedPipelineOutput["layers"]["itf"]`
- [ ] Integrate unified retrieval (enable both RAG + knowledge map)
- [ ] Add `Promise.allSettled()` for resilience (match HTF pattern)
- [ ] Remove raw HTF string injection; pass structured `HTFLayerOutput`

#### Step 5: Refactor ITF Agents (Week 3)
- [ ] Update `itf-structure-agent.ts` to implement `BaseAgent`
- [ ] Update `itf-liquidity-agent.ts` to implement `BaseAgent`
- [ ] Update `itf-pd-array-agent.ts` to implement `BaseAgent`
- [ ] Update `itf-setup-agent.ts` to implement `BaseAgent`
- [ ] Standardize prompt template structure (shared template engine)
- [ ] Add structured reasoning array to outputs

#### Step 6: Testing & Validation (Week 3-4)
- [ ] Create `test-itf-unified.ts` with full pipeline test
- [ ] Verify backward compatibility with existing `test-itf-*.ts` scripts
- [ ] Run validation: compare old ITF output vs new unified ITF output
- [ ] Ensure `MasterOutput` correctly aggregates unified layer outputs

### 6.2 Phase 2: LTF Migration (Priority: HIGH)

#### Step 1: Refactor LTF Orchestrator (Week 4)
- [ ] Rewrite `ltf-orchestrator.ts` to use unified contracts
- [ ] Change input to `UnifiedPipelineInput`
- [ ] Change output to `UnifiedPipelineOutput["layers"]["ltf"]`
- [ ] Integrate unified retrieval
- [ ] Replace raw `_htf` / `_itf` passthrough with structured `upstream` field
- [ ] Add `Promise.allSettled()` for resilience

#### Step 2: Refactor LTF Agents (Week 4-5)
- [ ] Update `ltf-structure-agent.ts` to implement `BaseAgent`
- [ ] Update `ltf-liquidity-agent.ts` to implement `BaseAgent`
- [ ] Update `ltf-pd-array-agent.ts` to implement `BaseAgent`
- [ ] Update `ltf-trigger-agent.ts` to implement `BaseAgent`
- [ ] Standardize prompt templates

#### Step 3: Testing & Validation (Week 5)
- [ ] Create `test-ltf-unified.ts`
- [ ] Verify full HTF → ITF → LTF chain works with unified contracts
- [ ] Validate `MasterOutput` structure

### 6.3 Phase 3: HTF Refactor (Priority: MEDIUM)

#### Step 1: Align HTF to Unified Contracts (Week 5-6)
- [ ] Rewrite `htf-orchestrator.ts` to use `UnifiedPipelineInput`
- [ ] Change output to `UnifiedPipelineOutput["layers"]["htf"]`
- [ ] Integrate unified retrieval (currently bypasses it)
- [ ] Update HTF agents to implement `BaseAgent`
- [ ] Keep vision capability as optional `charts` field in `AgentInput`

#### Step 2: Remove Legacy Systems (Week 6)
- [ ] Deprecate `retrieval-core.ts` (port all logic to `unified-retrieval.ts`)
- [ ] Deprecate `retrieval.ts` (port all logic to `unified-retrieval.ts`)
- [ ] Deprecate `grounding.ts` (replace with `unified-grounding.ts`)
- [ ] Update all imports across codebase

### 6.4 Phase 4: Unified Orchestrator (Week 6-7)

#### Step 1: Build Top-Level Orchestrator
- [ ] Create `core/3.query/orchestrators/unified-orchestrator.ts`
- [ ] Implements `runUnifiedOrchestrator()`
- [ ] Dynamically executes layers based on `config.layers`
- [ ] Handles early termination (if ITF invalid, skip LTF)
- [ ] Aggregates all layer outputs into `UnifiedPipelineOutput`

#### Step 2: Update Facade Layer
- [ ] Update `app/facades/queryFacade.ts` to use unified orchestrator
- [ ] Ensure API routes in `server/routes/` accept unified input format

### 6.5 LTF Migration Strategy — Avoiding the Same Mistake

**Rule:** LTF must be built as a `BaseAgent` implementation from day one, not as a copy-paste of ITF.

**Enforcement:**
1. All new agents must implement `BaseAgent` interface
2. All new orchestrators must use `UnifiedPipelineInput`/`Output`
3. No inline type definitions in orchestrator files
4. All retrieval must go through `unifiedRetrieve()`
5. All grounding must go through `unifiedGround()`
6. Code review checklist must verify contract compliance

---

## 7. RISK ANALYSIS

### 7.1 Breaking Changes

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Input schema change** | All test scripts (`test-htf-*.ts`, `test-itf-*.ts`, `test-ltf-*.ts`) break | Create adapter layer: `legacyInputAdapter()` that converts old inputs to unified format; keep for 1 release cycle |
| **Output schema change** | `MasterOutput` consumers (frontend, API clients) break | Update `MasterOutput` to use unified types; provide JSON schema documentation |
| **Retrieval behavior change** | ITF/LTF currently use knowledge map only; unified retrieval may add RAG results | Make RAG opt-in via `use_rag: false` by default for ITF/LTF during transition |
| **Agent signature change** | All agent function signatures change | Create wrapper functions that maintain old signatures but delegate to new `BaseAgent` implementations |

### 7.2 Agent Dependency Issues

| Risk | Impact | Mitigation |
|------|--------|------------|
| **ITF depends on HTF output** | If HTF refactor breaks, ITF fails | Maintain backward-compatible `HTFLayerOutput` shape during transition |
| **LTF depends on ITF output** | If ITF refactor breaks, LTF fails | Add circuit breaker: if ITF output missing/invalid, LTF returns `execute: false` with clear error |
| **Prompt template drift** | Unified prompt engine may change LLM behavior | A/B test: run old prompts vs new prompts on same queries, measure output divergence |
| **Vision agents are special** | HTF agents use Gemini Vision; unified `BaseAgent` must support this | Add optional `charts` field to `AgentInput`; vision agents check for presence |

### 7.3 Retrieval Inconsistencies

| Risk | Impact | Mitigation |
|------|--------|------------|
| **RAG vs Knowledge Map overlap** | Same concept may appear in both systems with different metadata | Add deduplication in `unifiedRetrieve()` based on `chunk_id` or concept name |
| **Pipeline JSON format divergence** | HTF uses `{name, concepts[]}`; ITF/LTF use `{concept, type, layer}` | Create `PipelineAdapter` class that normalizes all formats to internal `PipelineStep[]` |
| **Layer filtering inconsistency** | `retrieval.ts` filters by layer; `retrieval-core.ts` does not | Move layer filtering to unified retriever, applied after retrieval |
| **Concept extraction mismatch** | `retrieval-core.ts` extracts from `steps[].concepts[]`; `retrieval.ts` extracts from `steps[].concept` | Unified `extractConcepts()` must handle both shapes |

### 7.4 Performance Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Unified retrieval slower** | Running both RAG + knowledge map may double latency | Cache retrieval results per query; add `use_rag`/`use_knowledge_map` flags to disable unused strategies |
| **Vision API still heavy** | HTF vision calls remain slow regardless of unification | Keep vision async; do not block ITF/LTF on HTF vision (already the case, but verify) |
| **LLM call volume** | Unified grounding may increase token count | Keep `limitTokens()` logic; optimize prompt templates |
| **Memory pressure** | `PipelineIR` retains full trace | Add `trace` size limit; enable trace only in debug mode |

### 7.5 Operational Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Migration downtime** | System unusable during refactor | Maintain old pipelines alongside new unified pipeline; use feature flag to switch |
| **Knowledge map out of sync** | `data/knowledge_map.json` may not cover all ITF/LTF concepts | Run validation script after migration: verify all pipeline concepts resolve to knowledge map entries |
| **Debuggability loss** | Unified system may obscure which retrieval strategy found a chunk | Add `source` and `strategy` fields to `KnowledgeChunk`; log retrieval decisions |
| **Testing gap** | Unified system requires new test coverage | Create comprehensive test suite: `test-unified-pipeline.ts`, `test-unified-retrieval.ts`, `test-unified-grounding.ts` |

---

## 8. SUMMARY OF CRITICAL ACTIONS

1. **Immediately freeze ITF/LTF agent development** until unified contracts are in place
2. **Create `shared/contracts/pipeline-contracts.ts`** within 1 week
3. **Build unified retrieval system** before refactoring any orchestrator
4. **Migrate ITF first** (it is the middle layer; if it breaks, both HTF and LTF are affected)
5. **Maintain backward compatibility** via adapter layer during transition
6. **Add contract compliance to code review checklist** to prevent future divergence
7. **Delete legacy `retrieval-core.ts` and `retrieval.ts`** only after full migration is validated

---

*End of Audit Report*

