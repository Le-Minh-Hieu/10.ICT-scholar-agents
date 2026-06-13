# Target Flow Design

## Executive Summary

The target system uses a **market-first, concept-prioritization** approach where market images determine which concepts within the agent's domain are most relevant. This ensures grounded knowledge is both technically correct AND contextually aligned with the actual market state.

## Target Execution Graph

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: DOMAIN CONCEPTS LOADING (Unchanged)               │
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
                "Dollar Index",
                "DXY HTF Bias",
                "Seasonal Tendencies",
                "Interest Rate Triad",
                ... (all 37 concepts)
              ]
            }
          ]
        }
                            ↓
        extractConcepts(pipeline, "macro")
        Returns: ALL 37 concepts (domain boundary preserved)

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: MARKET-DRIVEN CONCEPT PRIORITIZATION (NEW)        │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (NEW: line 350)
        
        IF config.pushImages EXISTS:
          // Build parts with images
          const parts = []
          config.pushImages(parts, input, callId)
          
          // Market-driven concept prioritization
          const prioritizedConcepts = await prioritizeConceptsByMarket(
            allConcepts,        // All 37 macro concepts
            parts,              // Chart images
            agentName,
            callId
          )
                            ↓
        prioritizeConceptsByMarket() implementation:
        
        const prompt = `
        You are analyzing charts for the ${agentName}.
        
        Available concepts in your domain:
        ${allConcepts.map((c, i) => `${i+1}. ${c}`).join('\n')}
        
        Based on these charts, rank the top 10-15 most relevant concepts.
        
        Rules:
        - ONLY choose from the provided concepts
        - Prioritize concepts that match what you SEE in the charts
        - If charts show expansion, prioritize expansion-related concepts
        - If charts show liquidity runs, prioritize liquidity concepts
        - If charts show structure breaks, prioritize structure concepts
        
        Return JSON: { "prioritized": ["concept1", "concept2", ...] }
        `
        
        const result = await callLLM(prompt, `${agentName}-prioritize`, callId, parts)
                            ↓
        Returns: Top 10-15 concepts based on market state
        
        Example output for expansion market:
        [
          "Market Profile",
          "Expansion Swing",
          "Measured Moves",
          "Weekly Range Expansion",
          "Algorithmic Behavior",
          "Price Control",
          "Institutional Order Flow",
          "Smart Money Footprints",
          "Liquidity Engineering",
          "Draw on Liquidity",
          "Bullish Trending Day",
          "Market Rally",
          "Bullish Timeframe Alignment"
        ]
        
        NOT: All 37 concepts equally

┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: FOCUSED QUERY BUILDING (Modified Input)           │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 354 - modified)
        buildQueries(
          prioritizedConcepts,  // 10-15 concepts instead of 37
          knowledgeMap
        )
        
        For each of 10-15 prioritized concepts:
          1. Lookup in knowledge_map.json
          2. Get query_templates
          3. Apply ontology expansion
          
        Example for "Expansion Swing" (NOW PRIORITIZED):
        knowledge_map.json → {
          "query_templates": [
            "How to identify expansion phases?",
            "Expansion swing behavior",
            "Measured move targets during expansion"
          ]
        }
                            ↓
        Ontology expands to related concepts:
        - "Weekly Range Expansion"
        - "Measured Moves"
        - "Market Rally"
        
        Result: 30-50 queries (focused on relevant domain)

┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: FOCUSED RETRIEVAL (Unchanged Mechanism)           │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 409)
        retrieveRAG({ queries })
        
        1. BM25 search across all chunks
        2. Vector similarity search  
        3. Merge results
        4. Cross-encoder reranking
                            ↓
        Returns: Top 100 chunks
        
        BUT: Chunks now focus on expansion, structure, liquidity
        NOT: Spread thinly across all 37 concepts

┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: CONTEXTUAL GROUNDING (Unchanged Mechanism)        │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 465)
        buildGrounded(chunks, expandedQueries)
        
        Selection logic (unchanged):
        1. Score chunks by query match
        2. Deduplicate
        3. Select top 15-25 chunks
        4. Format as grounded knowledge
                            ↓
        Grounded knowledge is NOW FIXED (but market-aligned)
        
        Example output (expansion market):
        [CHUNK_ID:chunk_1201] EXPANSION PHASE DYNAMICS
        [CHUNK_ID:chunk_0876] MEASURED MOVES IN TRENDING MARKETS
        [CHUNK_ID:chunk_2341] LIQUIDITY ENGINEERING DURING EXPANSION
        [CHUNK_ID:chunk_0543] INSTITUTIONAL ORDER FLOW CHARACTERISTICS
        [CHUNK_ID:chunk_1789] SWING HIGH VALIDATION
        [CHUNK_ID:chunk_0234] ALGORITHMIC PRICE DELIVERY
        [CHUNK_ID:chunk_3456] STRUCTURE BREAK CONFIRMATION
        [CHUNK_ID:chunk_0987] MARKET PROFILE EXPANSION
        [CHUNK_ID:chunk_2109] BULLISH TRENDING DAY BEHAVIOR
        [CHUNK_ID:chunk_1654] SMART MONEY FOOTPRINTS
        [CHUNK_ID:chunk_0321] DRAW ON LIQUIDITY MECHANICS
        [CHUNK_ID:chunk_2876] WEEKLY RANGE EXPANSION TARGETS
        [CHUNK_ID:chunk_1432] TIMEFRAME ALIGNMENT CONFLUENCE
        [CHUNK_ID:chunk_0765] PRICE CONTROL MECHANISMS
        [CHUNK_ID:chunk_3210] MARKET RALLY CHARACTERISTICS

┌─────────────────────────────────────────────────────────────┐
│ PHASE 6: PROMPT CONSTRUCTION (Unchanged)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 487)
        buildPrompt({ groundedKnowledge: grounded })
        
        Prompt structure (same):
        ## ROLE
        You are an ICT HTF Structure Analysis Agent.
        
        ## GROUNDED KNOWLEDGE
        [Now 15-25 chunks about expansion, structure, liquidity]
        
        ## INPUT CONTEXT
        [Market data, timeframe info]
        
        ## CONSTRAINTS
        - Use grounded knowledge to analyze
        - Map principles to current context
        
        ## OUTPUT FORMAT
        {...}

┌─────────────────────────────────────────────────────────────┐
│ PHASE 7: IMAGE RE-INJECTION (Unchanged)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 503)
        config.pushImages(parts, input, callId)
        
        Images added AGAIN for final reasoning
        
        parts = [
          { text: prompt_with_market_aligned_grounded_knowledge },
          { inlineData: { mimeType: "image/jpeg", data: base64_chart_1 }},
          { inlineData: { mimeType: "image/jpeg", data: base64_chart_2 }},
          { inlineData: { mimeType: "image/jpeg", data: base64_chart_3 }}
        ]

┌─────────────────────────────────────────────────────────────┐
│ PHASE 8: LLM REASONING (Aligned Knowledge)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
        base-agent.ts (line 508)
        callLLM(prompt, agentName, callId, parts)
        
        Agent receives:
        ✓ Charts showing: expansion, bullish delivery, liquidity runs
        ✓ Knowledge about: expansion, structure, liquidity (15-25 chunks)
        
        Agent can reason with SUFFICIENT knowledge:
        ✓ Charts show expansion dynamics → Has expansion knowledge
        ✓ Charts show liquidity engineering → Has liquidity knowledge
        ✓ Charts show structure breaks → Has structure knowledge
        
        Result: Contextually strong analysis with deep domain coverage
```

## Key Design Decisions

### 1. Where Market Interpretation Inserts

**Location:** Between concept extraction and query building

```typescript
// base-agent.ts - BEFORE
const concepts = extractConcepts(pipeline, step)
const queries = buildQueries(concepts, knowledgeMap)

// base-agent.ts - AFTER
const allConcepts = extractConcepts(pipeline, step)
const prioritizedConcepts = await prioritizeConceptsByMarket(
  allConcepts, 
  images, 
  agentName
)
const queries = buildQueries(prioritizedConcepts, knowledgeMap)
```

**Why this location:**
- AFTER concept extraction → domain boundary preserved
- BEFORE query building → influences all downstream steps
- Minimal surface area → only affects concept list

### 2. Concept Prioritization Mechanism

**Design choice:** Use vision LLM to rank concepts, not generate new ones

```typescript
async function prioritizeConceptsByMarket(
  allConcepts: string[],
  imageParts: Part[],
  agentName: string,
  callId: string
): Promise<string[]> {
  
  const prompt = buildPrioritizationPrompt(allConcepts, agentName)
  
  const result = await callLLM(
    prompt,
    `${agentName}-prioritize`,
    callId,
    imageParts,
    { 
      returnFormat: 'json',
      schema: z.object({
        prioritized: z.array(z.string()),
        reasoning: z.string().optional()
      })
    }
  )
  
  // Validate: only return concepts from original list
  return result.prioritized.filter(c => allConcepts.includes(c))
}
```

**Why this approach:**
- LLM sees images → understands market context
- LLM ranks existing concepts → stays within domain
- LLM cannot generate new concepts → domain boundary enforced
- Validation step → ensures no concept drift

### 3. Agent Domain Boundary Preservation

**Critical constraint:** Pipeline concepts define agent domain

```
HTF Macro Agent domain = 37 "macro" concepts in htf_pipeline.json
↓
Market can only prioritize WITHIN these 37 concepts
↓
Cannot introduce concepts from other agents (structure, liquidity, etc.)
```

**Enforcement:**
1. Load all concepts from pipeline (unchanged)
2. Pass all concepts to prioritization function
3. Prioritization returns subset of original concepts
4. Validation filters any invalid concepts
5. Query building receives validated subset

### 4. Ontology Remains Expansion Layer

**No changes to ontology mechanism:**

```
Prioritized Concepts (10-15)
    ↓
knowledge_map.json lookup (unchanged)
    ↓
query_templates extraction (unchanged)
    ↓
Ontology expansion (unchanged)
    ↓
Related concepts added (within ontology graph)
    ↓
30-50 focused queries
```

**Why this works:**
- Ontology expansion starts from prioritized concepts
- Expansion follows existing relationships in knowledge_map.json
- Result: Deep coverage of relevant domain vs shallow coverage of all domains

### 5. Retrieval Pipeline Unchanged

**Zero changes to retrieval:**
- Same BM25 search
- Same vector similarity
- Same cross-encoder reranking
- Same top-N selection

**Why it works better:**
- Receives focused queries (30-50 vs 50-80)
- Queries target relevant domain
- Retrieval naturally returns more relevant chunks
- Reranking scores are more discriminative

### 6. Grounding Unchanged

**Zero changes to grounding:**
- Same chunk scoring logic
- Same deduplication
- Same top-N selection
- Same formatting

**Why it produces better results:**
- Input chunks are already domain-focused
- Top-N naturally covers relevant topics
- 15-25 chunks provide sufficient depth

## Comparison: Current vs Target

| Aspect | Current Flow | Target Flow |
|--------|--------------|-------------|
| **Concept source** | Pipeline concepts (all) | Pipeline concepts (all) ✓ |
| **Market input** | After grounding (too late) | Before query building (optimal) |
| **Concept selection** | All 37 concepts | Top 10-15 prioritized by market |
| **Query count** | 50-80 (spread thin) | 30-50 (focused deep) |
| **Retrieval** | BM25+Vector+Rerank | BM25+Vector+Rerank ✓ |
| **Grounding** | Top 5-10 chunks | Top 15-25 chunks (deeper) |
| **Knowledge depth** | Shallow (1-6 chunks per topic) | Deep (3-5 chunks per topic) |
| **Market alignment** | Static (query-driven) | Dynamic (market-driven) |
| **Domain boundary** | Preserved | Preserved ✓ |
| **Code reuse** | Baseline | 90-95% reused |

## Example Walkthrough: HTF Macro Agent

### Current Flow

```
Input: Expansion market with bullish delivery
↓
Load: All 37 macro concepts
↓
Query: 50-80 queries (equal weight across all concepts)
↓
Retrieve: 100 chunks (spread across seasonal, DXY, rates, etc.)
↓
Ground: Top 6 chunks (seasonal tendencies dominate)
↓
Agent sees: 6 chunks about seasonals, charts showing expansion
↓
Result: Agent lacks expansion/delivery knowledge
```

### Target Flow

```
Input: Expansion market with bullish delivery
↓
Load: All 37 macro concepts (domain boundary)
↓
Prioritize: Market images → rank concepts
  Top 10: [
    "Market Profile",
    "Expansion Swing", 
    "Algorithmic Behavior",
    "Institutional Order Flow",
    "Liquidity Engineering",
    "Market Rally",
    "Bullish Trending Day",
    "Measured Moves",
    "Price Control",
    "Smart Money Footprints"
  ]
↓
Query: 30-50 queries (focused on expansion/delivery)
↓
Retrieve: 100 chunks (focused on relevant domain)
↓
Ground: Top 15-25 chunks (expansion, delivery, structure, liquidity)
↓
Agent sees: 15-25 chunks about expansion dynamics, charts showing expansion
↓
Result: Agent has sufficient, aligned knowledge
```

## Success Metrics (Target State)

| Metric | Target State | Improvement |
|--------|--------------|-------------|
| Concept coverage | 30-40% (relevant only) | Focused vs spread |
| Knowledge depth | High (15-25 chunks) | 3x increase |
| Market alignment | Dynamic (market-driven) | Aligned vs static |
| Domain focus | Deep (clustered topics) | 3-5 chunks per topic |
| Retrieval quality | High (unchanged) | Same quality |
| Grounding quality | Contextually relevant | Query-match + market-match |
| Reasoning quality | Strong (sufficient context) | Agent has needed knowledge |

## Risk Mitigation

### Risk 1: Concept Drift

**Risk:** Market prioritization selects concepts outside agent domain

**Mitigation:**
```typescript
// Validation in prioritizeConceptsByMarket
const validated = prioritized.filter(c => allConcepts.includes(c))
if (validated.length < 5) {
  // Fallback: return top 15 concepts from original list
  return allConcepts.slice(0, 15)
}
return validated
```

### Risk 2: LLM Hallucination

**Risk:** Vision LLM hallucinates market state or concepts

**Mitigation:**
1. Prompt constrains to existing concepts only
2. JSON schema validation enforces structure
3. Post-validation filters invalid concepts
4. Fallback to ontology-driven if prioritization fails

### Risk 3: Performance Overhead

**Risk:** Additional LLM call adds latency

**Mitigation:**
1. Prioritization is fast (single LLM call, simple prompt)
2. Parallelizable with other operations
3. Net benefit: fewer total queries → faster retrieval
4. Can cache prioritization results for same market state

### Risk 4: Over-Prioritization

**Risk:** Selecting too few concepts misses important knowledge

**Mitigation:**
1. Target 10-15 concepts (not 3-5)
2. Ontology expansion adds related concepts
3. Fallback to all concepts if prioritization returns < 5
4. Monitor knowledge depth per agent

## Implementation Considerations

### New Code Required

**File:** `core/3.query/concept-prioritizer.ts` (NEW - ~80 lines)

```typescript
export async function prioritizeConceptsByMarket(
  allConcepts: string[],
  imageParts: Part[],
  agentName: string,
  callId: string
): Promise<string[]>
```

### Modified Code

**File:** `core/3.query/agents/shared/base-agent.ts`

```typescript
// Add between line 348-354 (concept extraction and query building)
let concepts = extractConcepts(pipeline, config.step)

if (config.pushImages) {
  const parts: Part[] = []
  config.pushImages(parts, input, callId)
  
  concepts = await prioritizeConceptsByMarket(
    concepts,
    parts,
    config.agentName,
    callId
  )
}

const queries = buildQueries(concepts, knowledgeMap)
```

### Unchanged Components

- ✓ `data/htf_pipeline.json` - Agent domain definitions
- ✓ `data/knowledge_map.json` - Ontology and query templates
- ✓ `core/3.query/query-builder.ts` - Query building logic
- ✓ `core/3.query/retrieval/` - BM25, Vector, Rerank
- ✓ `core/3.query/grounding.ts` - Chunk selection and formatting
- ✓ All agent configs and schemas
- ✓ All orchestrators

## Rollout Strategy

### Phase 1: Proof of Concept

1. Implement `concept-prioritizer.ts`
2. Add opt-in flag to agent config: `usePrioritization: boolean`
3. Test with Time agents (lowest risk, clear domain)
4. Measure: knowledge depth, market alignment, latency

### Phase 2: HTF Rollout

1. Enable for HTF Macro agent
2. Enable for HTF Structure agent
3. Enable for HTF Liquidity agent
4. Enable for HTF PD Array agent
5. Compare: grounded knowledge quality before/after

### Phase 3: ITF/LTF Rollout

1. Enable for ITF agents
2. Enable for LTF agents
3. Monitor: concept selection, query focus, chunk relevance

### Phase 4: Default Behavior

1. Make prioritization default for all vision-enabled agents
2. Keep fallback for agents without images
3. Document: concept prioritization in system architecture

## Conclusion

The target flow introduces **one new component** (concept prioritizer) and **one small modification** (base-agent.ts) while preserving 90-95% of existing code.

**Key benefits:**
- Market images drive concept selection
- Knowledge depth increases 3x (5-10 → 15-25 chunks)
- Knowledge alignment: static → dynamic
- Agent domain boundaries preserved
- Ontology mechanism unchanged
- Retrieval pipeline unchanged

**The change is surgical:**
- Insert market interpretation between concept extraction and query building
- All downstream components work exactly as before
- Just receive better input (prioritized concepts vs all concepts)