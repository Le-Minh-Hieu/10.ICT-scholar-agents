# Vision-First Prompt Generation Flow

## Overview
This document traces the complete flow for generating the HTF Macro Agent prompt, from pipeline concepts through vision-first RAG to final LLM prompt construction.

## Architecture: 3-Lane Query Merge

The system uses a **3-lane merge strategy** to combine:
1. **Lane 0 (Base)**: Pipeline-defined concepts → standard query expansion
2. **Lane 1 (Ontology)**: Vision-detected ICT concepts → query expansion via knowledge_map
3. **Lane 2 (Raw Observations)**: Direct chart observations → high-weight queries (0.9)

All lanes merge at the **query level** before retrieval, ensuring vision insights directly influence RAG without inflating token budgets.

---

## Flow Diagram

```
Pipeline (htf_pipeline.json)
  └─ Step: "macro" (32 concepts)
       ↓
  ┌────────────────────────────────────────────────┐
  │ PHASE 1: BASE QUERY EXPANSION (Lane 0)        │
  │ - buildQueries(concepts, knowledgeMap)         │
  │ - Output: 62 weighted queries                  │
  └────────────────────────────────────────────────┘
       ↓
  ┌────────────────────────────────────────────────┐
  │ PHASE 2: VISION GROUNDING                     │
  │ - buildVisionKnowledge() → grounded context   │
  │ - Vision LLM call with images                  │
  │ - Output: vision summary (market observations)│
  └────────────────────────────────────────────────┘
       ↓
  ┌────────────────────────────────────────────────┐
  │ PHASE 3: VISION CONCEPT EXTRACTION (Lane 1)   │
  │ - extractConceptsFromVision()                  │
  │ - Ontology matching: "DXY bearish" → concepts │
  │ - buildQueries(visionConcepts, knowledgeMap)   │
  │ - Dedup vs Lane 0                              │
  └────────────────────────────────────────────────┘
       ↓
  ┌────────────────────────────────────────────────┐
  │ PHASE 4: OBSERVATION EXTRACTION (Lane 2)      │
  │ - extractVisionObservations()                  │
  │ - Parse bullet points from vision summary      │
  │ - Map to high-weight queries (0.9)            │
  └────────────────────────────────────────────────┘
       ↓
  ┌────────────────────────────────────────────────┐
  │ PHASE 5: 3-LANE MERGE                         │
  │ - finalizeWeightedQueries([...all lanes])     │
  │ - Dedup + weight sort + limit to 15           │
  │ - Output: merged query list                    │
  └────────────────────────────────────────────────┘
       ↓
  ┌────────────────────────────────────────────────┐
  │ PHASE 6: RAG RETRIEVAL                        │
  │ - retrieveRAG(mergedQueries, embeddings...)    │
  │ - Search + rerank + top-k selection            │
  │ - Output: grounded chunks                      │
  └────────────────────────────────────────────────┘
       ↓
  ┌────────────────────────────────────────────────┐
  │ PHASE 7: GROUNDING COMPOSITION                │
  │ - buildGrounded(chunks, queries)               │
  │ - Vision summary injected as PRIMARY context   │
  │ - Format: LIVE OBSERVATIONS + RAG SECONDARY   │
  └────────────────────────────────────────────────┘
       ↓
  ┌────────────────────────────────────────────────┐
  │ PHASE 8: PROMPT CONSTRUCTION                  │
  │ - buildPrompt(role, task, grounded, input...) │
  │ - Add minimal_context (parent_thesis, etc)     │
  │ - Output: final prompt string                  │
  └────────────────────────────────────────────────┘
       ↓
  ┌────────────────────────────────────────────────┐
  │ PHASE 9: LLM CALL                             │
  │ - callLLM(prompt, agentName, callId, parts)   │
  │ - parts = [text + images]                      │
  │ - Output: structured JSON response             │
  └────────────────────────────────────────────────┘
```

---

## Key Files

### 1. Pipeline Definition
**File**: `data/htf_pipeline.json`
```json
{
  "steps": [
    {
      "name": "macro",
      "concepts": [
        "Dollar Index",
        "DXY HTF Bias",
        "Seasonal Tendencies",
        "Interest Rate Differentials",
        ...
      ]
    }
  ]
}
```

### 2. Knowledge Map
**File**: `data/knowledge_map.json`
```json
[
  {
    "concept": "Dollar Index",
    "type": "target",
    "layer": "HTF",
    "agent": {
      "role": "Detects HTF price targets...",
      "focus": ["Rejection Block", "Short-term High"],
      "signal": "Potential HTF price target...",
      "when_to_use": "When establishing HTF directional bias...",
      "invalid_when": "When seeking LTF entry triggers..."
    }
  }
]
```

**Note**: `query_templates` removed in latest version. Queries now generated via `buildQueries()` only.

### 3. Vision Grounding
**File**: `core/3.query/vision-grounded-knowledge.ts`

#### `buildVisionKnowledge(pipeline, stepName, knowledgeMap)`
Creates grounded context for vision LLM by combining:
- Pipeline step concepts (32 for "macro")
- Knowledge map entries (role, focus, signal, when_to_use, invalid_when)
- Output: ~5,400 tokens of structured ICT concept definitions

#### `extractConceptsFromVision(visionSummary)`
**NEW**: Uses ontology surface term matching instead of substring search.
```typescript
// Old (substring): if (summary.includes(concept.toLowerCase()))
// New (ontology): ontologyLoader.findConceptsInText(visionSummary)
```
Returns canonical concept names detected in vision summary.

#### `extractVisionObservations(visionSummary)`
**NEW**: Extracts bullet points and meaningful lines from vision summary.
```typescript
// Example input:
// "- DXY: Bearish displacement visible
//  - US10Y: Yields falling (price rising)"
// Output: ["DXY: Bearish displacement visible", "US10Y: Yields falling (price rising)"]
```
These become high-weight (0.9) queries in Lane 2.

### 4. Base Agent Orchestrator
**File**: `core/3.query/agents/shared/base-agent.ts`

Key change in vision block (L363-414):
```typescript
// 3-LANE VISION MERGE
if (visionSummary) {
  const baseQueries = queries; // Lane 0: frozen
  
  // Lane 1: Ontology concepts
  const visionConcepts = extractConceptsFromVision(visionSummary);
  let visionConceptQueries = buildQueries(visionConcepts, knowledgeMap);
  // Dedup vs Lane 0
  visionConceptQueries = visionConceptQueries.filter(vq => 
    !baseQueries.some(bq => normalize(bq.query) === normalize(vq.query))
  );
  
  // Lane 2: Raw observations
  const visionObservations = extractVisionObservations(visionSummary);
  const visionObservationQueries = visionObservations.map(obs => ({
    query: obs,
    weight: 0.9,
    type: "anchor"
  }));
  
  // Merge all 3 lanes
  queries = finalizeWeightedQueries(
    [...baseQueries, ...visionConceptQueries, ...visionObservationQueries],
    concepts[0]
  );
}
```

### 5. Query Builder
**File**: `core/3.query/query-builder.ts`

#### `buildQueries(concepts, knowledgeMap, relational?, scenarios?)`
Expands concepts into weighted queries via:
1. Anchor query (weight 1.0) - the concept itself
2. Ontology canonical/aliases (weight 0.7/0.4)
3. ~~Knowledge map templates~~ (REMOVED in latest version)
4. Intent-based temporal expansion
5. Anti-tunnel-vision scenario expansion
6. Context-gated relational expansion

Returns `WeightedQuery[]` with query text, weight, and type.

#### `finalizeWeightedQueries(queries, mainConcept)` 
**NOW EXPORTED** for vision merge. Post-processes queries:
- Deduplicates by query text
- Filters invalid queries (length, educational terms, etc)
- Sorts by weight descending
- Limits to 15 queries max

---

## Debug Artifacts (RAG_DEBUG_DUMP=true)

When `RAG_DEBUG_DUMP=true`, the system generates:

```
data/rag-debug/{captureId}/{agentName}/
├── 00_VISION_INPUT.txt              # Vision grounded knowledge + prompt
├── 00_VISION_SUMMARY.txt            # Vision LLM output (market observations)
├── 00_VISION_CONCEPTS.json          # Lane 1: ontology concepts detected
├── 00_VISION_OBSERVATIONS.json      # Lane 2: raw observations extracted
├── 00_VISION_OBSERVATION_QUERIES.json # Lane 2 queries with weights
├── 00_MERGED_QUERIES.json           # 3-lane merge result
├── 01_INPUT.json                    # Agent input + minimal_context
├── 02_QUERY_BUILD.json              # Concept → query expansion
├── 03_EXPANDED.json                 # Final expanded queries
├── 04_SEARCH.json                   # RAG search results
├── 05_RERANK.json                   # Post-rerank chunks
├── 06_GROUNDED.txt                  # Grounded knowledge (RAG only)
├── 06_GROUNDED_WITH_VISION.txt      # Vision + RAG composition
├── 06_GROUNDED_META.json            # Chunk IDs + token estimates
├── 07_PROMPT.txt                    # Final prompt sent to LLM
├── 08_RESPONSE.json                 # LLM response + telemetry
└── 09_SUMMARY.json                  # High-level metrics
```

### Example: 00_MERGED_QUERIES.json
```json
{
  "base_query_count": 62,
  "vision_concept_query_count": 5,
  "vision_observation_query_count": 8,
  "final_merged_query_count": 15,
  "final_queries": [
    { "query": "DXY: Bearish displacement visible", "weight": 0.9, "type": "anchor" },
    { "query": "Dollar Index", "weight": 1.0, "type": "anchor" },
    { "query": "Yield Divergence", "weight": 0.8, "type": "anchor" },
    ...
  ]
}
```

---

## Prompt Structure

### Final Prompt Template
```
Role: {role}

---

Task: {task}

---

## LIVE MARKET OBSERVATIONS (VISION PRIMARY)
{visionSummary}

## HISTORICAL REFERENCE (RAG SECONDARY)
{groundedKnowledge}

---

Input Context:
{inputContext}

---

Constraints:
{constraints}

---

Output Format:
{outputFormat}

---

Parent Thesis Context:
{minimal_context.parent_thesis}
```

### Token Budget
- **Vision summary**: ~140 tokens (direct chart observations)
- **Grounded knowledge**: ~2,000-4,000 tokens (RAG chunks)
- **Prompt structure**: ~400 tokens (role, task, constraints)
- **Total**: ~2,500-4,500 tokens input → leaves room for 8K+ output

---

## Example: HTF Macro Agent

### Input
```json
{
  "EURUSD": { "timeframe": "Daily", "current_price": 1.0850 },
  "GBPUSD": { "timeframe": "Daily", "current_price": 1.2650 }
}
```

### Pipeline Step
- **Step**: "macro"
- **Concepts**: 32 (Dollar Index, DXY HTF Bias, Seasonal Tendencies, etc.)

### Vision Phase
1. **Vision Grounded Knowledge**: 30 matched concepts, 21,648 chars (~5,400 tokens)
2. **Vision LLM Call**: With DXY daily chart, US10Y chart
3. **Vision Summary** (example):
```
- DXY: Bearish displacement visible on daily chart
- US10Y: Yields falling (price rising). Bullish engulfing.
- Divergence: DXY bearish vs US10Y bullish (yield divergence)
- Seasonal context: February typically bullish for risk assets
```

### 3-Lane Merge
- **Lane 0 (Base)**: 62 queries from 32 pipeline concepts
- **Lane 1 (Ontology)**: 5 concepts detected → 5 new queries (after dedup)
- **Lane 2 (Observations)**: 4 bullet points → 4 queries (weight 0.9)
- **Final**: 15 queries (top-weighted after merge)

### RAG Retrieval
- **Queries**: 15 merged queries
- **Search**: Semantic search across vector DB
- **Rerank**: Cross-encoder reranking
- **Output**: Top 10-15 chunks (~3,000 tokens)

### Grounded Composition
```
## LIVE MARKET OBSERVATIONS (VISION PRIMARY)
- DXY: Bearish displacement visible on daily chart
- US10Y: Yields falling (price rising)
- Divergence: DXY bearish vs US10Y bullish

## HISTORICAL REFERENCE (RAG SECONDARY)
[ICT concept: Yield Divergence]
When T-note yields and currency performance show divergence...
[ICT concept: Dollar Index Confirmation]
DXY bearish displacement signals potential EURUSD strength...
```

### Final Prompt
See `data/llm-debug/{timestamp}-HTF-Macro-Agent-PROMPT.txt` for the complete prompt structure.

---

## Performance Metrics (from demo)

| Metric | Value |
|--------|-------|
| Pipeline concepts | 32 |
| Vision grounded knowledge | 5,412 tokens |
| Concepts extracted from vision | 5 |
| Base queries (Lane 0) | 62 |
| Vision concept queries (Lane 1) | 5 (after dedup) |
| Vision observation queries (Lane 2) | 4 |
| Final merged queries | 15 (after dedup + limit) |
| RAG chunks retrieved | 10-15 |
| Grounded knowledge tokens | ~3,000 |
| Full prompt tokens | ~4,000 |

---

## Key Improvements

### Before (Old Flow)
1. Pipeline concepts → queries
2. RAG retrieval
3. Grounded knowledge
4. Prompt construction
5. **No vision integration**

### After (Vision-First Flow)
1. Pipeline concepts → Lane 0 queries
2. **Vision grounding + LLM call**
3. **Vision concepts → Lane 1 queries (ontology-based)**
4. **Vision observations → Lane 2 queries (direct)**
5. **3-lane merge at query level**
6. RAG retrieval (vision-aware queries)
7. Grounded composition (vision PRIMARY, RAG secondary)
8. Prompt construction with layered context

### Benefits
- ✅ Vision observations directly influence RAG (not post-hoc)
- ✅ Ontology-grounded concept detection (not substring matching)
- ✅ Raw observations bypass ontology (Lane 2 flexibility)
- ✅ Deduplication prevents query inflation
- ✅ Vision appears as PRIMARY context in final prompt
- ✅ Complete audit trail via RAG_DEBUG_DUMP

---

## Configuration

### Enable Vision-First
In agent config (`core/3.query/agents/htf/htf-macro-agent.ts`):
```typescript
{
  agentName: "HTF-Macro-Agent",
  pipelinePath: "data/htf_pipeline.json",
  step: "macro",
  visionPrompt: "Analyze the DXY and US10Y charts...", // Enable vision-first
  pushImages: (parts, input, callId) => {
    pushImage(parts, input.EURUSD?.image, "EURUSD_Daily", callId);
    pushImage(parts, input.US10Y?.image, "US10Y_Daily", callId);
  },
  ...
}
```

### Enable Debug Dumps
```bash
export RAG_DEBUG_DUMP=true
export VISION_DEBUG=true
node test/test-htf-macro.ts
```

Artifacts saved to: `data/rag-debug/{captureId}/HTF-Macro-Agent/`

---

## Future Enhancements

1. **VISION_DEBUG retrieval delta**: Compare Lane 0 vs final retrieval to measure vision impact
2. **Adaptive lane weighting**: Adjust Lane 2 weight based on vision LLM confidence
3. **Concept coverage metrics**: Track which pipeline concepts lack vision coverage
4. **Vision cache**: Reuse vision summaries across agents in same capture
5. **Multi-agent vision fusion**: Aggregate vision insights from HTF → ITF → LTF

---

## References

- Pipeline: `data/htf_pipeline.json`
- Knowledge Map: `data/knowledge_map.json`
- Vision Grounding: `core/3.query/vision-grounded-knowledge.ts`
- Base Agent: `core/3.query/agents/shared/base-agent.ts`
- Query Builder: `core/3.query/query-builder.ts`
- Ontology Loader: `core/3.query/ontology/loader.ts`
- Demo: `test/test-vision-first-demo.mjs`

---

**Last Updated**: 2026-06-10  
**Version**: Vision-First v2 (3-lane merge)