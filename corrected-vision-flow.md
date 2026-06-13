# Corrected Vision Flow Analysis

**Date:** 2026-06-09  
**Status:** ARCHITECTURE CORRECTION  
**Previous Error:** Misidentified knowledge_map.json and pipeline JSON as query sources

---

## CRITICAL CORRECTION

### What I Got Wrong

**Previous Understanding (INCORRECT):**
- Pipeline JSON = query source
- Knowledge Map = query generator
- Market images arrive after grounding

**Correct Understanding:**
- Pipeline JSON + Knowledge Map = **vision rules and domain knowledge**
- These form **initial grounded knowledge** for interpreting market images
- Market images are **interpreted through** this grounded knowledge
- Vision extraction produces **market interpretation + knowledge gaps**
- **Only gaps generate queries**, not concepts

---

## THE ACTUAL ARCHITECTURE

### Knowledge Map Structure (Evidence)

From data/knowledge_map.json:

```json
{
  "concept": "Morning Bias",
  "agent": {
    "role": "Detects the morning's directional bias...",
    "query_templates": [...],
    "focus": ["time of day", "liquidity levels", "news events"],
    "signal": "Outputs initial liquidity targets...",
    "when_to_use": "During morning session...",
    "invalid_when": "Outside morning session..."
  }
}
```

**This is NOT a query generator.**

**This is a vision ontology:**
- `role` = what to look for
- `focus` = what to pay attention to
- `signal` = what to output
- `when_to_use` = activation conditions
- `invalid_when` = deactivation conditions
- `query_templates` = questions to ask **IF knowledge gap detected**

---

## CORRECT EXECUTION ORDER

```
Pipeline JSON + Knowledge Map
    ↓
Initial Grounded Knowledge (Vision Rules)
    ↓
Market Images + Initial Grounded Knowledge
    ↓
Vision Extraction
    ↓
Market Interpretation
    ↓
Knowledge Gap Detection
    ↓
Query Generation (ONLY from gaps)
    ↓
Ontology Expansion (expands queries)
    ↓
Retrieval (fills gaps)
    ↓
Final Grounded Knowledge (domain + retrieved)
    ↓
Reasoning
```

---

## PHASE-BY-PHASE BREAKDOWN

### Phase 1: Initial Grounding

**Input:**
- Pipeline JSON (agent role, constraints, task)
- Knowledge Map (vision rules, focus areas, activation conditions)

**Process:**
- Load domain knowledge
- Build vision interpretation framework
- Establish what to look for in charts

**Output:**
- Initial grounded knowledge
- Vision rules for market interpretation

**Purpose:**
Agent needs to know HOW to look at charts before seeing them.

---

### Phase 2: Vision Extraction

**Input:**
- Market images (charts)
- Initial grounded knowledge (vision rules)

**Process:**
- Apply vision rules to charts
- Interpret market structure using domain knowledge
- Identify what is visible vs what is unknown

**Output:**
- Market interpretation (what agent sees)
- Knowledge gaps (what agent needs but doesn't see)

**Purpose:**
Transform visual data into structured interpretation + gap list.

---

### Phase 3: Gap-Driven Query Generation

**Input:**
- Knowledge gaps from vision extraction
- Agent role and constraints

**Process:**
- For each gap, formulate question
- Use query_templates from knowledge_map IF applicable
- Generate targeted queries to fill specific unknowns

**Output:**
- Query list (gap-specific, NOT concept-based)

**Purpose:**
Create focused retrieval questions based on actual needs.

---

### Phase 4: Ontology Expansion

**Input:**
- Gap-driven queries

**Process:**
- Expand queries using ontology (canonical + aliases)
- Broaden search scope while maintaining focus

**Output:**
- Expanded query set

**Purpose:**
Ensure retrieval catches relevant knowledge using different terminology.

**NOTE:** Ontology does NOT decide what to search. It only expands what was already decided.

---

### Phase 5: Retrieval

**Input:**
- Expanded queries (from gaps)

**Process:**
- Retrieve knowledge chunks matching queries
- Rank by relevance to gaps

**Output:**
- Retrieved knowledge chunks

**Purpose:**
Fill identified knowledge gaps with specific information.

---

### Phase 6: Final Grounding

**Input:**
- Initial grounded knowledge (domain + vision rules)
- Retrieved knowledge (gap-filling chunks)

**Process:**
- Combine domain knowledge with retrieved knowledge
- Create complete knowledge base

**Output:**
- Final grounded knowledge

**Purpose:**
Agent now has both domain expertise AND gap-specific knowledge.

---

### Phase 7: Reasoning

**Input:**
- Market interpretation (from vision)
- Final grounded knowledge (domain + retrieved)

**Process:**
- Apply complete knowledge to market interpretation
- Generate agent output

**Output:**
- Agent decision/analysis

**Purpose:**
Make informed decision with complete information.

---

## COMPARISON TO CURRENT SYSTEM

### Current System (From execution-proof.md)

```
Static Pipeline JSON
↓
extractConcepts(pipeline, step) ← WRONG: treats as query source
↓
buildQueries(concepts, knowledgeMap) ← WRONG: concepts ≠ gaps
↓
retrieveRAG(queries)
↓
buildGrounded(chunks)
↓
buildPrompt(grounded) ← Initial grounding happens HERE (too late)
↓
pushImages(parts) ← Images arrive AFTER grounding
↓
callLLM(prompt, parts)
```

**Problems:**
1. Initial grounding happens at prompt build (too late)
2. Images arrive after grounding (can't detect gaps)
3. Concepts used instead of gaps (wrong query source)
4. Knowledge Map treated as query generator (wrong role)

---

### Correct System (Vision-First)

```
Pipeline JSON + Knowledge Map
↓
Initial Grounded Knowledge ← Happens FIRST
↓
Market Images + Initial Grounded Knowledge
↓
Vision Extraction ← Images interpreted through domain knowledge
↓
Market Interpretation + Knowledge Gaps ← What's visible + what's missing
↓
Query Generation ← ONLY from gaps
↓
Ontology Expansion ← Expands gap queries
↓
Retrieval ← Fills gaps
↓
Final Grounded Knowledge ← Domain + retrieved
↓
Reasoning
```

**Fixes:**
1. Initial grounding happens first (vision rules ready)
2. Images arrive early (enable gap detection)
3. Gaps generate queries (correct source)
4. Knowledge Map provides vision rules (correct role)

---

## KNOWLEDGE MAP ROLE CLARIFICATION

### NOT a Query Generator

knowledge_map.json does NOT tell the system "retrieve everything about Morning Bias."

### IS a Vision Ontology

knowledge_map.json tells the agent:

**When looking at morning session:**
- ROLE: "Detect directional bias and liquidity objectives"
- FOCUS: "time of day, liquidity levels, news events"
- SIGNAL: "Output initial liquidity targets"
- WHEN_TO_USE: "During morning session, around news events"
- INVALID_WHEN: "Outside morning session"

**IF agent sees morning session but CANNOT determine bias:**
→ Knowledge gap detected
→ THEN use query_templates: "How to determine morning session bias?"

**IF agent sees morning session AND determines bias:**
→ No gap
→ No query
→ No retrieval needed

---

## PIPELINE JSON ROLE CLARIFICATION

### NOT Concept Lists

Pipeline JSON (time_pipeline.json, htf_pipeline.json) does NOT provide concepts to retrieve.

### IS Agent Configuration

Pipeline JSON provides:
- Agent role definition
- Task description
- Constraints
- Focus areas for THIS specific agent

**Example:**
```json
{
  "name": "macro_time",
  "role": "Macro time analysis",
  "focus": ["Seasonal tendencies", "Economic calendar", "Macro cycles"]
}
```

This tells the agent WHAT TO LOOK FOR, not WHAT TO RETRIEVE.

Retrieval only happens if agent looks but doesn't see.

---

## REUSE ANALYSIS (CORRECTED)

### Components That Work Correctly

**1. Ontology Expansion**
- ✅ Correctly expands queries (whatever their source)
- ✅ No changes needed

**2. Retrieval Core**
- ✅ Correctly retrieves based on queries
- ✅ No changes needed

**3. Grounding (buildGrounded)**
- ✅ Correctly formats chunks
- ✅ No changes needed

**4. LLM Call**
- ✅ Correctly calls with prompt + images
- ✅ No changes needed

---

### Components That Need Correction

**1. base-agent.ts (Lines 348-505)**

**Current (WRONG):**
```typescript
// Line 348: Load pipeline as query source
const pipeline = loadPipeline(config.pipelinePath);
const concepts = extractConcepts(pipeline, config.step);
const queries = buildQueries(concepts, knowledgeMap);
// ... retrieval ...
// ... grounding ...
// Line 503: Images added after grounding
if (config.pushImages) {
  config.pushImages(parts, input, callId);
}
```

**Correct:**
```typescript
// PHASE 1: Initial Grounding (FIRST)
const pipeline = loadPipeline(config.pipelinePath);
const visionRules = loadVisionRules(knowledgeMap, config.step);
const initialGrounded = buildInitialGrounded(pipeline, visionRules);

// PHASE 2: Vision Extraction (WITH IMAGES)
const parts: any[] = [];
if (config.pushImages) {
  config.pushImages(parts, input, callId);
}
const visionResult = extractVision(parts, initialGrounded, config.agentRole);

// PHASE 3: Gap Detection
const gaps = detectKnowledgeGaps(visionResult, initialGrounded);

// PHASE 4: Query Generation (FROM GAPS)
const queries = generateQueriesFromGaps(gaps, visionRules);

// PHASE 5: Ontology Expansion
const expandedQueries = expandQueries(queries, knowledgeMap);

// PHASE 6: Retrieval
const retrieved = await retrieveRAG({queries: expandedQueries, ...});

// PHASE 7: Final Grounding
const finalGrounded = combineGrounded(initialGrounded, retrieved.chunks);

// PHASE 8: Reasoning
const prompt = buildPrompt({
  role: config.role,
  task: config.task,
  groundedKnowledge: finalGrounded, // Domain + retrieved
  marketInterpretation: visionResult.interpretation,
  ...
});
```

---

## REQUIRED NEW COMPONENTS

### 1. loadVisionRules()
**Purpose:** Extract vision rules from knowledge_map.json for agent's layer/role

**Input:** knowledge_map.json, agent step

**Output:** 
```typescript
{
  role: string,
  focus: string[],
  signal: string,
  when_to_use: string,
  invalid_when: string,
  query_templates: string[]
}
```

**Size:** ~80 lines

---

### 2. buildInitialGrounded()
**Purpose:** Create initial grounded knowledge from pipeline + vision rules

**Input:** Pipeline JSON, vision rules

**Output:** Initial grounded text (domain knowledge + vision framework)

**Size:** ~100 lines

---

### 3. extractVision()
**Purpose:** Interpret market images using initial grounded knowledge

**Input:** Market images, initial grounded knowledge, agent role

**Output:**
```typescript
{
  interpretation: string, // What agent sees
  identified: string[],   // What's visible
  unknowns: string[]      // What's not visible
}
```

**Size:** ~150 lines (includes vision extraction logic)

---

### 4. detectKnowledgeGaps()
**Purpose:** Compare vision result against initial knowledge to find gaps

**Input:** Vision result, initial grounded knowledge

**Output:** Knowledge gaps array

**Size:** ~80 lines

---

### 5. generateQueriesFromGaps()
**Purpose:** Convert gaps into targeted queries using vision rules

**Input:** Gaps, vision rules

**Output:** Gap-specific queries

**Size:** ~100 lines

---

### 6. combineGrounded()
**Purpose:** Merge initial domain knowledge with retrieved gap-filling knowledge

**Input:** Initial grounded, retrieved chunks

**Output:** Final grounded knowledge

**Size:** ~60 lines

---

## CODE SURFACE (CORRECTED)

### Files Modified

**1. core/3.query/agents/shared/base-agent.ts**
- Lines changed: ~200 (complete orchestration rewrite)
- Lines 348-505 replaced with 7-phase flow

**2. core/3.query/query-builder.ts**
- Lines changed: ~30
- Modify to accept gap-derived queries instead of concepts

---

### New Files

1. `core/3.query/vision-rules-loader.ts` (~80 lines)
2. `core/3.query/initial-grounding.ts` (~100 lines)
3. `core/3.query/vision-extractor.ts` (~150 lines)
4. `core/3.query/gap-detector.ts` (~80 lines)
5. `core/3.query/gap-query-generator.ts` (~100 lines)
6. `core/3.query/grounded-combiner.ts` (~60 lines)

---

### Total Impact

- Files modified: 2
- Lines modified: ~230
- New files: 6
- Lines added: ~570
- **Total: ~800 lines**

---

## FINAL RECOMMENDATION

### IMPLEMENT: Vision-First Architecture

**This is the ONLY architecture that:**
1. Uses knowledge_map.json correctly (as vision ontology)
2. Uses pipeline JSON correctly (as agent configuration)
3. Enables market-driven retrieval (gaps from vision)
4. Matches original vision (market drives questions)

**Previous analysis was fundamentally wrong because:**
- Treated knowledge_map as query generator
- Treated pipeline concepts as retrieval targets
- Missed the vision interpretation phase
- Misunderstood the role of initial grounded knowledge

**The correct flow is:**
```
Domain Knowledge FIRST
↓
Vision Interpretation (using domain knowledge)
↓
Gap Detection (what's missing from interpretation)
↓
Query Generation (fill specific gaps)
↓
Retrieval (targeted, not broad)
↓
Final Knowledge (domain + retrieved)
↓
Reasoning (complete information)
```

---

**END OF CORRECTED ANALYSIS**