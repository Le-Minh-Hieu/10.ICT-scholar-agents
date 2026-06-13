# Current Flow Analysis

## Executive Summary

The current system uses a **concept-first, ontology-driven** approach where knowledge domain selection happens **before** market interpretation. This results in grounded knowledge that is technically correct but often misaligned with the actual market context shown in the charts.

## Current Execution Graph

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: CONCEPT EXTRACTION (No Market Input)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 348)
        loadPipeline(config.pipelinePath)
        
        Example: htf_pipeline.json
        {
          "steps": [
            {
              "name": "macro",
              "concepts": [
                "Dollar Index",           // All 37 concepts
                "DXY HTF Bias",          // loaded equally
                "Seasonal Tendencies",    // regardless of
                "Interest Rate Triad",    // market state
                ...
              ]
            }
          ]
        }
                            ↓
        extractConcepts(pipeline, "macro")
        Returns: ALL 37 concepts (no prioritization)

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: QUERY BUILDING (Ontology-Driven)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 354)
        buildQueries(concepts, knowledgeMap)
        
        For each of 37 concepts:
          1. Lookup in knowledge_map.json
          2. Get query_templates
          3. Apply ontology expansion
          
        Example for "Seasonal Tendencies":
        knowledge_map.json → {
          "query_templates": [
            "How to determine seasonal bias?",
            "Seasonal tendency validation",
            "Monthly seasonal patterns"
          ]
        }
                            ↓
        Ontology expands to related concepts:
        - "Seasonal Low"
        - "Seasonal Divergence"
        - "Quarterly Shifts"
        
        Result: 50-80 queries (all concepts equally weighted)

┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: RETRIEVAL (BM25 + Vector Search)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 409)
        retrieveRAG({ queries })
        
        1. BM25 search across all chunks
        2. Vector similarity search
        3. Merge results
        4. Cross-encoder reranking
                            ↓
        Returns: Top 100 chunks (by query similarity)

┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: GROUNDING (Static Selection)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 465)
        buildGrounded(chunks, expandedQueries)
        
        Selection logic:
        1. Score chunks by query match
        2. Deduplicate
        3. Select top 5-10 chunks
        4. Format as grounded knowledge
                            ↓
        Grounded knowledge is NOW FIXED
        
        Example output:
        [CHUNK_ID:chunk_3308] SEASONAL TENDENCY CHARTS
        [CHUNK_ID:chunk_941] ECONOMIC CALENDAR & ITA
        [CHUNK_ID:chunk_734] SEASONAL TENDENCIES
        [CHUNK_ID:chunk_3594] STEP 1: SEASONAL TENDENCIES
        [CHUNK_ID:chunk_3796] SEASONAL TENDENCIES
        [CHUNK_ID:chunk_3326] FINAL ADVICE ON SEASONAL

┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: PROMPT CONSTRUCTION (Knowledge Locked In)         │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 487)
        buildPrompt({ groundedKnowledge: grounded })
        
        Prompt structure:
        ## ROLE
        You are an ICT Time Analysis Agent.
        
        ## GROUNDED KNOWLEDGE
        [Already fixed - 6 chunks about seasonal tendencies]
        
        ## INPUT CONTEXT
        [NY Time, session info]
        
        ## CONSTRAINTS
        - Use grounded knowledge to analyze
        - Map principles to current context
        
        ## OUTPUT FORMAT
        {...}

┌─────────────────────────────────────────────────────────────┐
│ PHASE 6: IMAGE INJECTION (Too Late)                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 503)
        config.pushImages(parts, input, callId)
        
        Images added AFTER grounded knowledge is finalized
        
        parts = [
          { text: prompt_with_fixed_grounded_knowledge },
          { inlineData: { mimeType: "image/jpeg", data: base64_chart_1 }},
          { inlineData: { mimeType: "image/jpeg", data: base64_chart_2 }},
          { inlineData: { mimeType: "image/jpeg", data: base64_chart_3 }}
        ]

┌─────────────────────────────────────────────────────────────┐
│ PHASE 7: LLM REASONING (Misaligned Knowledge)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 508)
        callLLM(prompt, agentName, callId, parts)
        
        Agent receives:
        ✓ Charts showing: expansion, bullish delivery, liquidity runs
        ✗ Knowledge about: seasonal tendencies only (6 chunks)
        
        Agent must reason with INSUFFICIENT knowledge:
        - Charts show expansion dynamics → No expansion knowledge
        - Charts show liquidity engineering → No liquidity knowledge
        - Charts show structure breaks → No structure knowledge
        
        Result: Technically correct but contextually weak analysis
```

## Problem Analysis

### 1. How Concept Selection Currently Works

**File:** `core/3.query/pipeline-processor.ts`

```typescript
export function extractConcepts(
  pipeline: Pipeline,
  stepName: string
): string[] {
  const step = pipeline.steps.find(s => s.name === stepName)
  if (!step) return []
  
  // Returns ALL concepts for the step
  return step.concepts  // No filtering, no prioritization
}
```

**Current behavior:**
- HTF Macro Agent: All 37 "macro" concepts
- HTF Structure Agent: All 106 "structure" concepts  
- ITF Setup Agent: All concepts for "setup" step
- No market input → no prioritization

### 2. Which Component Determines Concept Importance

**Currently: NONE**

All concepts are treated equally. The only "importance" comes from:
1. **Query match score** during retrieval (BM25 + Vector)
2. **Reranking score** from cross-encoder
3. **Top-N selection** in grounding

But these operate AFTER queries are already generated from ALL concepts.

### 3. Evidence: Actual Prompts

**Macro-Time-Agent (1780803485955):**
- Domain: 37 "macro" concepts in pipeline
- Grounded knowledge: **6 chunks** (all about seasonal tendencies)
- Missing: Interest rates, DXY analysis, intermarket analysis, economic calendar interpretation

**HTF-Structure-Agent (1780803570263):**
- Domain: 106 "structure" concepts in pipeline
- Grounded knowledge: **1 chunk** about structure
- Missing: BOS, CHoCH, swing analysis, market maker models

**ITF-Setup-Agent (1780803655171):**
- Domain: Setup concepts in pipeline
- Grounded knowledge: **1 chunk** about entry models
- Missing: Setup validation, confluence factors, entry timing

**Pattern:** Agents receive 1-6 chunks when they need 15-25 chunks covering their active domain.

## Why This Happens

### Root Cause: Concept → Query → Retrieval (No Market Input)

```
All Concepts (37) 
    ↓
All Queries (50-80)
    ↓
All Retrievals (spread across domain)
    ↓
Top N Chunks (5-10) - by similarity only
    ↓
Result: Shallow coverage of domain
```

### Example: HTF Macro Agent

**Pipeline concepts (37):**
- Dollar Index, DXY Bias, Seasonal Tendencies, Interest Rates, Economic Calendar, Quarterly Shifts, Intermarket Analysis, Open Interest, etc.

**What gets retrieved when ALL concepts query equally:**
- 2 chunks about seasonals (high BM25 score)
- 1 chunk about DXY (moderate score)
- 1 chunk about economic calendar (moderate score)
- 1 chunk about interest rates (moderate score)
- 1 chunk about open interest (low score)

**What's missing:**
- Deep knowledge about whichever domain is ACTIVE in the market
- If market shows expansion → need expansion knowledge
- If market shows consolidation → need consolidation knowledge
- If market shows regime shift → need regime shift knowledge

### The Core Issue

**Grounded knowledge is statically selected by query similarity, not dynamically selected by market relevance.**

Charts might show:
- Bullish delivery with liquidity engineering
- But knowledge retrieved is about seasonal tendencies

Because:
- All 37 concepts query equally
- Seasonal queries happen to match chunks better
- Market state never influences concept selection

## File Reference Map

```
Pipeline Concepts
├── data/htf_pipeline.json (206 total HTF concepts)
├── data/itf_pipeline.json (ITF concepts)
├── data/ltf_pipeline.json (LTF concepts)
└── data/time_pipeline.json (Time concepts)

Knowledge Map (Ontology)
└── data/knowledge_map.json (4,000+ concept definitions with query templates)

Concept Extraction
└── core/3.query/pipeline-processor.ts
    └── extractConcepts() - returns ALL concepts for step

Query Building
└── core/3.query/query-builder.ts
    └── buildQueries() - expands ALL concepts via ontology

Retrieval
└── core/3.query/retrieval/
    ├── retrieval-core.ts - BM25 + Vector search
    └── rerank.ts - Cross-encoder reranking

Grounding
└── core/3.query/grounding.ts
    └── buildGrounded() - selects top N chunks

Agent Execution
└── core/3.query/agents/shared/base-agent.ts
    └── runBaseAgent() - orchestrates entire flow
        ├── Line 348: extractConcepts()
        ├── Line 354: buildQueries()
        ├── Line 409: retrieveRAG()
        ├── Line 465: buildGrounded()
        ├── Line 487: buildPrompt()
        ├── Line 503: pushImages() ← TOO LATE
        └── Line 508: callLLM()
```

## Success Metrics (Current State)

| Metric | Current State | Evidence |
|--------|---------------|----------|
| Concept coverage | 100% (all concepts query) | All 37 macro concepts used |
| Knowledge depth | Low (5-10 chunks) | Macro agent: 6 chunks |
| Market alignment | None (static selection) | Images added after grounding |
| Domain focus | Shallow (spread across all) | Equal weight to all concepts |
| Retrieval quality | High (BM25+Vector+Rerank) | System works technically |
| Grounding quality | Technically correct | Chunks match queries well |
| Reasoning quality | Weak (insufficient context) | Agent lacks market-relevant knowledge |

## Conclusion

The current system is **architecturally sound** with excellent retrieval and grounding mechanisms. The problem is **not** technical quality but **temporal ordering**:

- Knowledge domain selection happens **before** market interpretation
- Market images are added **after** grounded knowledge is finalized
- Agent receives technically correct but **contextually insufficient** knowledge

The solution must **move market interpretation earlier** in the pipeline while **preserving** the existing architecture:
- Keep pipeline concepts (domain boundaries)
- Keep knowledge map (ontology)
- Keep retrieval pipeline (BM25+Vector+Rerank)
- Keep grounding mechanism (top-N selection)

Only change: **Insert market-driven concept prioritization before ontology expansion**.