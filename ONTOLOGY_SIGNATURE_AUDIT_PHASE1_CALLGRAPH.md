# ONTOLOGY SIGNATURE AUDIT — PHASE 1 (TRACE QUERY GENERATION PIPELINE)

**Scope:** Exact runtime call chain from `runBaseAgent()` through concept extraction → query building/expansion → retrieval → rerank.

## 1) Entry: `runBaseAgent()`
- **File:** `core/3.query/agents/shared/base-agent.ts`
- **Function:** `runBaseAgent(input, config, minimal_context)`
- **Called By:** all layer agents (HTF/ITF/LTF + time agents) under `core/3.query/agents/**`

### Inputs
- `input`: agent-specific image payloads + fields (e.g., `eurusd.d`, `gbpusd.h4`, `htf/itf/...` context)
- `config`: per-agent config including:
  - `pipelinePath` (e.g., `data/htf_pipeline.json`)
  - `step` (e.g., `structure`, `liquidity`, `pd_array`, `macro`, `setup`, `trigger`)
  - `role`, `task`, `constraints`, `outputFormat`, `schema`, `layer`
  - `buildInputContext()`
- `minimal_context`:
  - `parent_thesis`
  - `relational_context`
  - `scenario_context`

### Outputs (from this stage)
- Calls retrieval and later returns agent JSON plus `_debug`:
  - `_debug.expandedQueries` (query strings actually used for retrieval)
  - `_debug.topKChunks`
  - `_debug.grounded`

## 2) `loadPipeline()`
- **File:** `core/3.query/pipeline-processor.ts`
- **Function:** `loadPipeline(p)`
- **Called By:** `runBaseAgent()`
- **Input:** `config.pipelinePath` (e.g., `data/htf_pipeline.json`)
- **Output:** Parsed JSON pipeline object

## 3) `extractConcepts()`
- **File:** `core/3.query/pipeline-processor.ts`
- **Function:** `extractConcepts(pipeline, step?)`
- **Called By:** `runBaseAgent()`
- **Input:**
  - `pipeline`: loaded from `loadPipeline()`
  - `step`: `config.step`
- **Output:** `concepts: string[]`
  - Uses `pipeline.steps[]`:
    - if `step` present: returns the `targetStep.concepts`
    - else: unions concepts across pipeline steps
  - Dedupes via `return [...new Set(concepts)]`

## 4) Read knowledge map
- **File:** `core/3.query/agents/shared/base-agent.ts`
- **Operation:** reads `data/knowledge_map.json`
- **Input:** fixed path: `data/knowledge_map.json`
- **Output:** `knowledgeMap: KnowledgeMapEntry[]`

## 5) `buildQueries()` (ontology signature generation)
- **File:** `core/3.query/query-builder.ts`
- **Function:** `buildQueries(concepts, knowledgeMap, relational?, scenarios?)`
- **Called By:** `runBaseAgent()`
- **Inputs:**
  - `concepts`: from `extractConcepts(pipeline, config.step)`
  - `knowledgeMap`: from `data/knowledge_map.json`
  - `relational`: `minimal_context?.relational_context`
  - `scenarios`: `minimal_context?.scenario_context`

### Output
- `WeightedQuery[]`, each element:
  - `{ query: string; weight: number; type: "anchor" | "canonical" | "alias" | "context" }`

### Exact expansion logic (what becomes the rerank query inputs)
For each `concept` in `concepts`:
1. **Anchor query**
   - Adds the original concept itself as `type: "anchor"`
   - Weight: `1.0` for the first concept (`mainConcept`), else `0.8`
2. **Ontology expansion via `ontologyLoader`**
   - `canonical = ontologyLoader.getCanonical(concept)`
   - If canonical differs: add canonical as `type: "canonical"` weight `0.7`
   - `registryEntry = ontologyLoader.getRegistryEntry(canonical)`
   - For each `surface_terms` term (excluding the original concept and canonical):
     - add as `type: "alias"` weight `0.4`
3. **Knowledge map templates**
   - Attempts to find matching `kmEntry` whose `e.concept` matches/includes the concept string (substring heuristics)
   - Adds every `kmEntry.agent.query_templates` item (filtered by `isValidQuery`) as `type: "context"` weight `0.5`
   - Excludes templates containing: `when`, `explain`, `retrieve`
4. **Intent-based temporal/session expansion**
   - Uses `classifyIntent(concept)`
   - If intent is `TIME` or `SESSION` and concept contains `"silver bullet"`:
     - adds extra context queries (e.g., `"10am to 11am New York time"`, `"fvg"`)
5. **Scenario expansions** (if `scenarios.active_scenarios.length > 0` and `confidence > 0.6`)
   - Adds an “opposing evidence” query:
     - `Evidence of {asset} {opposingType} ...`
   - Adds contradiction anchors query if `contradicting_anchors` exists
6. **Relational expansions** (if `relational` exists)
   - Only if concepts indicate reversal context (`reversal/divergence/smt/turn` substring)
   - Adds:
     - external influence queries (weight `0.3`)
     - SMT divergence queries (weight `0.35`)

### Finalization in `buildQueries()`
- Performs dedup and trims to `MAX_QUERY = 15`
- Dedup key is the raw query string (`Map<string, WeightedQuery>`)
- Filters out:
  - queries failing `isValidQuery()`
  - queries containing `when|explain|retrieve`
  - queries longer than 80 chars

## 6) Embedding queries (still pre-rerank)
### `embedQueries()`
- **File:** `core/3.query/retrieval-core.ts`
- **Function:** `embedQueries(queries: string[])`
- **Called By:** `runBaseAgent()` and also used inside `retrieveRAG()`
- **Purpose:** create embeddings so vector search can run

## 7) `retrieveRAG()` (where rerank is called)
- **File:** `core/3.query/agents/shared/base-agent.ts`
  - calls `retrieveRAG()` from `core/3.query/retrieval-core.ts`
- **File (implementation):** `core/3.query/retrieval-core.ts`
- **Function:** `retrieveRAG(input)`

### Inputs to `retrieveRAG()`
- `queries`: `WeightedQuery[]` from `buildQueries()`
- `conceptEmbeddings`: embeddings for retrieval scoring/fusion
- `agentName`
- `memory`: hierarchical memory built from `minimal_context.parent_thesis`
- `relational`: `minimal_context?.relational_context`
- `scenarios`: `minimal_context?.scenario_context`
- `pmso`: `minimal_context?.pmso_context`

### Output (relevant to Phase 4/5 later)
- `{ chunks: Chunk[]; expandedQueries: string[]; topKChunks: number }`
  - `expandedQueries` is **exactly** the `query` strings used in retrieval

### Internal rerank call (the critical link)
- `retrieveRAG()` converts weighted queries to:
  - `queriesOnly = weightedQueries.map(wq => wq.query)`
- After vector+BM25 fusion:
  - `topCandidates = thresholdFiltered.slice(0, 80)`
  - if `topCandidates.length > 0`:
    - `rerankQuery = queriesOnly.join(", ")`
    - `final = await rerank(rerankQuery, topCandidates, parentThesis, input.relational)`

**Evidence that rerank inputs correspond to the expanded ontology query strings:**
- `rerankQuery` is derived **directly** from the `queriesOnly` array (the same strings returned in `expandedQueries`).

## 8) `rerank()`
- **File:** `core/3.query/rerank.ts`
- **Function:** `rerank(query, chunks, parentThesis?, relational?)`
- **Inputs:**
  - `query`: the concatenated expanded query strings: `queriesOnly.join(", ")`
  - `chunks`: retrieved candidates (`topCandidates`)
  - `parentThesis`, `relational`
- **Output:** reordered chunk array

## 9) Back to `runBaseAgent()`
- `runBaseAgent()` receives:
  - `expandedQueries`
  - `topKChunks`
  - `chunks`
- Builds grounding + prompts and later returns:
  - agent result
  - `_debug.expandedQueries`, `_debug.topKChunks`, `_debug.grounded`

---

# Summary: What generates the rerank “ontology signature” inputs?
A rerank call is driven by:
1. `extractConcepts()` (step-specific pipeline concepts)
2. `buildQueries()`
   - adds canonical + alias expansions from ontology loader
   - adds knowledge-map query templates
   - optionally adds scenario expansions
   - optionally adds relational expansions
   - dedups and keeps top 15
3. `retrieveRAG()`
   - sets `rerankQuery = expandedQueries.join(", ")`
4. `rerank()` consumes `rerankQuery`

Therefore the “ontology signature” can be evidenced by the **runtime** persisted `_debug.expandedQueries` and/or by `rerankQuery` reconstruction as `expandedQueries.join(", ")`.

