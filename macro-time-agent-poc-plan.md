# Macro-Time-Agent Vision-First POC Plan

**Generated:** 2026-06-09  
**Scope:** Minimum change POC for Macro-Time-Agent only  
**Goal:** Test market-state-anchored retrieval vs pipeline-concept retrieval

---

## EXECUTIVE SUMMARY

**FINDING:** Vision-first for Macro-Time-Agent requires **ONE 5-LINE FUNCTION MODIFICATION**

**Current Flow:**
```
time_pipeline.json (60 static concepts)
→ extractConcepts()
→ buildQueries()
→ retrieveRAG()
→ grounding
→ LLM reasoning
```

**Target Flow:**
```
Market State (weekly_profile + daily_profile + time context)
→ extractConceptsFromMarketState()
→ buildQueries()
→ retrieveRAG()
→ grounding
→ LLM reasoning
```

**Change Required:** Replace static concept source with dynamic market-state-derived concepts

**Files Touched:** 1 file (base-agent.ts)  
**Lines Modified:** ~5-10 lines  
**Risk:** LOW (isolated to Macro-Time-Agent, fallback available)

---

## PHASE 1: EXECUTION TRACE

### Macro-Time-Agent Call Graph

```
1. time-orchestrator.ts (line 77-80)
   └─> macroTimeAgent(input, hydrationContext)

2. macro-time-agent.ts (line 26)
   └─> runBaseAgent(input, config, hydrationContext)

3. base-agent.ts (line 348-354)
   ├─> loadPipeline("data/time_pipeline.json")
   ├─> extractConcepts(pipeline, "macro_time")
   ├─> buildQueries(concepts, knowledgeMap)
   ├─> embedQueries()
   └─> retrieveRAG()

4. retrieval-core.ts
   └─> BM25 + Vector search + Fusion

5. grounding.ts
   └─> buildGrounded()

6. base-agent.ts (line 450+)
   └─> buildPrompt() + callLLM()
```

### Key Discovery

**Query generation starts at line 348-354 of base-agent.ts:**

```typescript
// 1. RAG
const pipeline = loadPipeline(config.pipelinePath);  // line 348
const concepts = extractConcepts(pipeline, config.step);  // line 349

const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));

const queries = buildQueries(concepts, knowledgeMap);  // line 354
```

**This is the ONLY place where concepts are sourced.**

---

## PHASE 2: QUERY SOURCE ANALYSIS

### Current Source: Static Pipeline

**File:** `data/time_pipeline.json`

**Step:** `macro_time`

**Concepts (60 total):**
```json
[
  "Seasonal Tendencies",
  "Economic Calendar",
  "Seasonal Influences",
  "Calendar Effects",
  "Macro Time Cycles",
  "Macro Time Windows",
  "Macro Time Events",
  // ... 53 more static concepts
]
```

**Problems:**
1. **No market awareness** — same concepts for bullish/bearish/consolidation
2. **No temporal awareness** — same concepts for NFP day vs quiet day
3. **No narrative awareness** — ignores macro regime
4. **Query inflation** — retrieves irrelevant concepts

### Query Transformation Path

```
Static Concepts (60)
   ↓
extractConcepts() — filters to step
   ↓
Concepts Array (60)
   ↓
buildQueries() — expands via ontology + knowledge map
   ↓
Weighted Queries (~150-200)
   ↓
embedQueries() — creates embeddings
   ↓
retrieveRAG() — searches vector DB
```

**buildQueries() is concept-agnostic** — it accepts ANY string array and expands it.

---

## PHASE 3: MARKET STATE CANDIDATES

### Available Objects BEFORE Retrieval

**In base-agent.ts runBaseAgent():**

1. **input** (line 330)
   ```typescript
   {
     eurusd: {
       tf1: string,  // Monthly chart path
       tf2: string,  // Weekly chart path  
       tf3: string   // Daily chart path
     }
   }
   ```
   - Contains: OHLCV data (via chart images)
   - Available: ✅ YES
   - Usable: ⚠️ Indirect (via chart analysis)

2. **minimal_context** (line 332) — This is HydrationContext
   ```typescript
   {
     weekly_profile: {
       regime: string,              // "BULLISH_REGIME"
       narrative_state: string,     // "FED_PIVOT_RALLY"
       macro_bias: string,          // "BULLISH"
       macro_themes: string[],      // ["FED_POLICY", "DXY_WEAKNESS"]
       retrieval_queries: string[], // Pre-generated queries!
       narrative_confidence: number,
       primary_drivers: string[]
     },
     daily_profile: {
       day_type: string,                    // "CATALYST_DAY"
       liquidity_expectations: any,
       narrative_assessment: any,
       todays_catalysts: any[]
     },
     pmso_context: PMSO,
     parent_thesis: TimeframeThesis,
     scenario_context: ScenarioMemory,
     relational_context: RelationalContext
   }
   ```
   - Contains: Pre-generated macro context
   - Available: ✅ YES (loaded in run-system.ts before orchestrators)
   - Usable: ✅ YES

3. **config.buildInputContext()** (line 58-76 in macro-time-agent.ts)
   ```typescript
   {
     NY_Time: string,
     Month: string,
     Market_Status: "OPEN" | "CLOSED"
   }
   ```
   - Contains: Current time context
   - Available: ✅ YES
   - Usable: ✅ YES

### Best Market State Representation

**Winner: minimal_context (HydrationContext)**

**Reasoning:**
1. **Already available** — loaded before Macro-Time-Agent runs
2. **Already contains vision** — weekly_profile has narrative, regime, bias
3. **Already contains knowledge gaps** — weekly_profile.retrieval_queries
4. **Already contains concepts** — weekly_profile.macro_themes
5. **No new types needed** — use existing structure

**Specifically:**
- `weekly_profile.macro_themes` → dynamic concepts
- `weekly_profile.retrieval_queries` → knowledge gap hints
- `weekly_profile.narrative_state` → contextual filter
- `weekly_profile.regime` → directional bias
- `daily_profile.day_type` → temporal context

---

## PHASE 4: MINIMUM REWIRE

### Current Implementation

**File:** `core/3.query/agents/shared/base-agent.ts`

**Lines:** 348-354

```typescript
// 1. RAG
const pipeline = loadPipeline(config.pipelinePath);       // Static file
const concepts = extractConcepts(pipeline, config.step);   // Static extraction

const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));

const queries = buildQueries(concepts, knowledgeMap);
```

### Proposed Change

**Same file, same location, add 5 lines:**

```typescript
// 1. RAG - VISION-FIRST POC
const pipeline = loadPipeline(config.pipelinePath);
let concepts = extractConcepts(pipeline, config.step);

// POC: Use market-state-derived concepts if available
if (minimal_context?.weekly_profile?.macro_themes?.length > 0) {
  concepts = minimal_context.weekly_profile.macro_themes;
  log({ stage: "POC_VISION_FIRST", message: "Using market-state concepts", data: { concepts } });
}

const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));

const queries = buildQueries(concepts, knowledgeMap);

// POC: Optionally append knowledge-gap queries
if (minimal_context?.weekly_profile?.retrieval_queries?.length > 0) {
  queries.push(...minimal_context.weekly_profile.retrieval_queries.map(q => ({ query: q, weight: 0.6 })));
  log({ stage: "POC_VISION_FIRST", message: "Appended knowledge-gap queries", data: { count: minimal_context.weekly_profile.retrieval_queries.length } });
}
```

### Input Change Summary

| Aspect | Current (X) | Candidate (Y) | Change |
|--------|-------------|---------------|--------|
| **Source** | time_pipeline.json | weekly_profile.macro_themes | Static → Dynamic |
| **Type** | string[] | string[] | Same |
| **Count** | 60 concepts | 2-5 concepts | Focused |
| **Awareness** | None | Market/Temporal/Narrative | Contextual |
| **Fallback** | N/A | Pipeline concepts if weekly_profile missing | Safe |

**Reasoning:**
1. **Type compatible** — both are string arrays, buildQueries() doesn't care
2. **Focused retrieval** — 2-5 themes vs 60 static concepts = better precision
3. **Market aware** — concepts change based on actual market state
4. **Knowledge gaps included** — retrieval_queries already represent missing info
5. **Zero new types** — uses existing HydrationContext fields
6. **Fallback safe** — if weekly_profile missing, falls back to pipeline

---

## PHASE 5: POC SURFACE AREA

### Files Touched

1. **core/3.query/agents/shared/base-agent.ts**
   - Lines modified: 348-360 (~12 lines total, 5-7 new)
   - Purpose: Add conditional concept source override

### Functions Touched

1. **runBaseAgent()** (base-agent.ts)
   - Modification: Add 5 lines after line 349
   - Risk: LOW (only affects concept source, rest unchanged)

### Lines Modified

**Total: ~5-10 lines**

**Breakdown:**
- Conditional check: 1 line
- Concept override: 1 line
- Log statement: 1 line
- Optional query append: 3-4 lines
- Additional log: 1 line

### Dependencies Affected

**NONE**

**Why:**
- buildQueries() is concept-agnostic (accepts any string[])
- retrieveRAG() unchanged
- grounding unchanged
- LLM prompting unchanged
- Output format unchanged
- Other agents unchanged (HTF/ITF/LTF/Master untouched)

### Risk Assessment

**OVERALL: LOW**

**Breakdown:**

| Risk Factor | Level | Mitigation |
|-------------|-------|------------|
| Type incompatibility | NONE | Both sources are string[] |
| Missing data | LOW | Fallback to pipeline if weekly_profile missing |
| Retrieval failure | LOW | retriev

eRAG handles empty/invalid queries gracefully |
| Breaking other agents | NONE | Change isolated to Macro-Time-Agent execution path |
| Production impact | NONE | POC only, not deployed |
| Rollback complexity | VERY LOW | Remove 5 lines, revert to original |

**Safety Features:**
1. **Conditional logic** — only activates if weekly_profile.macro_themes exists
2. **Fallback** — uses pipeline concepts if market state unavailable
3. **Logging** — POC_VISION_FIRST stage tracks when override is active
4. **Isolated** — only affects Macro-Time-Agent, not HTF/ITF/LTF/Master
5. **Reversible** — delete 5 lines to revert

---

## PHASE 6: IMPLEMENTATION PLAN

### POC Implementation Steps

**Step 1: Modify base-agent.ts**
- File: `core/3.query/agents/shared/base-agent.ts`
- Location: After line 349
- Action: Add conditional concept override (5 lines)
- Test: Verify Macro-Time-Agent still compiles

**Step 2: Ensure weekly_profile is populated**
- File: `core/4.output/run-system.ts`
- Location: Lines 71-150 (already exists)
- Action: Verify weekly_profile loading works
- Test: Log weekly_profile.macro_themes availability

**Step 3: Run Macro-Time-Agent**
- Execute: Single capture with Macro-Time-Agent
- Monitor: POC_VISION_FIRST log statements
- Compare: Concepts used (static vs dynamic)

**Step 4: Analyze retrieval results**
- Check: `data/rag-debug/{captureId}/Macro-Time-Agent/04_SEARCH.json`
- Compare: Retrieval quality (static vs dynamic concepts)
- Measure: Relevance of retrieved chunks

**Step 5: Evaluate output quality**
- Compare: Macro-Time-Agent reasoning (static vs dynamic)
- Assess: Does vision-anchored retrieval improve output?
- Document: Findings

**Step 6: Decision point**
- If successful: Expand to other time agents (quarterly, monthly, weekly, daily, session)
- If unsuccessful: Revert (delete 5 lines)
- If mixed: Refine concept extraction logic

### Success Criteria

**POC is successful if:**
1. ✅ Macro-Time-Agent executes without errors
2. ✅ Concepts are dynamically sourced from weekly_profile
3. ✅ Retrieval returns relevant chunks
4. ✅ Output reasoning references market state
5. ✅ No degradation vs baseline

**POC is unsuccessful if:**
1. ❌ Errors during execution
2. ❌ Retrieval returns no/irrelevant chunks
3. ❌ Output quality degrades
4. ❌ Performance significantly slower

### Rollback Plan

**If POC fails:**
1. Delete lines added to base-agent.ts
2. Verify Macro-Time-Agent reverts to pipeline concepts
3. Run test capture to confirm baseline restored
4. Document failure reasons

**Rollback time:** <2 minutes

---

## PHASE 7: DETAILED CODE CHANGE

### Exact Modification

**File:** `core/3.query/agents/shared/base-agent.ts`

**Current code (lines 348-354):**
```typescript
// 1. RAG
const pipeline = loadPipeline(config.pipelinePath);
const concepts = extractConcepts(pipeline, config.step);

const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));

const queries = buildQueries(concepts, knowledgeMap);
```

**Modified code:**
```typescript
// 1. RAG
const pipeline = loadPipeline(config.pipelinePath);
let concepts = extractConcepts(pipeline, config.step);

// POC: Vision-First concept sourcing for Macro-Time-Agent
if (config.agentName === "Macro-Time-Agent" && 
    minimal_context?.weekly_profile?.macro_themes?.length > 0) {
  concepts = minimal_context.weekly_profile.macro_themes;
  log({ 
    stage: "POC_VISION_FIRST", 
    message: "Using market-state concepts", 
    data: { 
      original_count: extractConcepts(pipeline, config.step).length,
      vision_count: concepts.length,
      vision_concepts: concepts 
    } 
  });
}

const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));

const queries = buildQueries(concepts, knowledgeMap);

// POC: Append knowledge-gap queries if available
if (config.agentName === "Macro-Time-Agent" && 
    minimal_context?.weekly_profile?.retrieval_queries?.length > 0) {
  const gapQueries = minimal_context.weekly_profile.retrieval_queries.map(q => ({ 
    query: q, 
    weight: 0.6 
  }));
  queries.push(...gapQueries);
  log({ 
    stage: "POC_VISION_FIRST", 
    message: "Appended knowledge-gap queries", 
    data: { gap_query_count: gapQueries.length } 
  });
}
```

**Changes:**
- Line 349: `const` → `let` (allow reassignment)
- Lines 351-361: Add conditional concept override (11 lines)
- Lines 367-378: Add optional knowledge-gap query append (12 lines)
- **Total new code:** 23 lines
- **Total modified code:** 1 line (const→let)

**Agent-specific guard:** `config.agentName === "Macro-Time-Agent"` ensures only Macro-Time-Agent is affected.

---

## ANSWERS TO KEY QUESTIONS

### 1. Where does query generation start?

**Answer:** `core/3.query/agents/shared/base-agent.ts`, line 348-354

**Specifically:**
```
loadPipeline() → extractConcepts() → buildQueries()
```

### 2. What should replace the current query source?

**Answer:** `minimal_context.weekly_profile.macro_themes`

**Reasoning:**
- Available before retrieval ✅
- Contains market-aware concepts ✅
- Dynamic based on macro narrative ✅
- Type-compatible with buildQueries() ✅
- No new types needed ✅

**Optional addition:** `minimal_context.weekly_profile.retrieval_queries` (knowledge gaps)

### 3. What files would actually change?

**Answer:** 1 file

**File:** `core/3.query/agents/shared/base-agent.ts`

**No changes to:**
- macro-time-agent.ts
- time-orchestrator.ts
- retrieval-core.ts
- query-builder.ts
- grounding.ts
- run-system.ts
- Any contracts/types
- Any other agents

### 4. How many lines would change?

**Answer:** ~24 lines total

**Breakdown:**
- Modified: 1 line (const→let)
- Added: 23 lines (conditional logic + logging)
- Deleted: 0 lines
- Net: +23 lines

**Percentage of base-agent.ts:** 23/619 = 3.7%

**Percentage of system:** 23/~50,000 = 0.046%

### 5. Is this truly a small rewire or are hidden dependencies involved?

**Answer:** Truly a small rewire, zero hidden dependencies

**Evidence:**

**No dependencies on:**
- buildQueries() — concept-agnostic, accepts any string[]
- retrieveRAG() — query-agnostic, processes any weighted queries
- buildGrounded() — chunk-agnostic, processes any retrieved chunks
- buildPrompt() — content-agnostic, accepts any grounded text
- callLLM() — prompt-agnostic, sends any prompt
- Output parsing — structure unchanged
- Other agents — isolated to Macro-Time-Agent path

**Type safety:**
- weekly_profile.macro_themes: string[] ✅
- pipeline concepts: string[] ✅
- buildQueries() expects: string[] ✅
- **No type changes required**

**Data flow:**
```
Before: pipeline.json → concepts → buildQueries()
After:  weekly_profile → concepts → buildQueries()
                                      ↓
                                  (same path)
```

**Hidden dependencies: NONE**

---

## RISK MITIGATION

### Potential Issues & Solutions

**Issue 1: weekly_profile missing or empty**
- **Mitigation:** Fallback to pipeline concepts
- **Code:** Already in place (conditional check)

**Issue 2: macro_themes are too generic**
- **Mitigation:** Use both pipeline + macro_themes
- **Code:** Append rather than replace

**Issue 3: Retrieval returns no results**
- **Mitigation:** retrieveRAG() handles gracefully, returns empty array
- **Code:** No changes needed

**Issue 4: Output quality degrades**
- **Mitigation:** Rollback (delete 23 lines)
- **Time:** <2 minutes

**Issue 5: Performance regression**
- **Mitigation:** Monitor execution time, market-state concepts should be faster (fewer concepts = faster retrieval)
- **Expected:** Performance improvement (5 concepts vs 60)

---

## COMPARISON: VISION-FIRST VS CURRENT

### Static Pipeline Concepts (Current)

**Pros:**
- Predictable
- Comprehensive coverage
- Battle-tested

**Cons:**
- No market awareness
- Query inflation (60 concepts → 150+ queries)
- Retrieves irrelevant knowledge
- Same concepts for all market conditions

### Market-State Concepts (Vision-First)

**Pros:**
- Market-aware (dynamic based on regime/narrative)
- Focused retrieval (5 concepts → ~30 queries)
- Higher precision (only relevant concepts)
- Includes knowledge gaps (retrieval_queries)

**Cons:**
- Depends on weekly_profile quality
- Less comprehensive (by design)
- Untested

### Example Comparison

**Scenario:** Bullish FED-driven rally, NFP week

**Current (Static):**
```
Concepts: [
  "Seasonal Tendencies",
  "Economic Calendar",
  "Macro Time Cycles",
  "Macro Time Windows",
  "Macro Time Events",
  ... 55 more
]
```

**Vision-First (Dynamic):**
```
Concepts: [
  "FED_POLICY",
  "NFP_WEEK",
  "DOLLAR_WEAKNESS",
  "RISK_ON_SENTIMENT"
]

Plus Knowledge Gaps: [
  "How does FED pivot affect dollar?",
  "NFP bullish continuation patterns"
]
```

**Result:** Vision-first retrieves FED/NFP-specific ICT concepts, ignoring irrelevant seasonal patterns.

---

## CONCLUSION

### Summary

**Vision-first POC for Macro-Time-Agent requires ONE FUNCTION MODIFICATION:**

- **File:** base-agent.ts
- **Lines:** ~24 lines added
- **Dependencies:** Zero
- **Risk:** LOW
- **Reversibility:** HIGH (delete 23 lines)
- **Scope:** Macro-Time-Agent only

### Why This Is Truly Minimal

1. **No new types** — uses existing weekly_profile
2. **No new functions** — modifies existing runBaseAgent()
3. **No new files** — everything in place
4. **No agent changes** — HTF/ITF/LTF/Master untouched
5. **No contract changes** — HydrationContext unchanged
6. **No retrieval changes** — buildQueries/retrieveRAG unchanged

### Next Steps

1. **Implement:** Add 24 lines to base-agent.ts
2. **Test:** Run single Macro-Time-Agent capture
3. **Analyze:** Compare retrieval quality
4. **Decide:** Expand, refine, or revert

**This is a 5-minute code change to test a fundamental architectural hypothesis.**

---

**END OF REPORT**