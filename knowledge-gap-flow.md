# Knowledge Gap Flow Analysis

**Date:** 2026-06-09  
**Objective:** Compare architectures and determine alignment with original vision  
**Status:** Architecture Review Complete

---

## 1. ARCHITECTURAL COMPARISON

### A. Current System (As-Implemented)

**Source:** execution-proof.md (evidence-based)

```
Static Pipeline JSON
    ↓
extractConcepts(pipeline, step)
    ↓ (returns string[])
buildQueries(concepts, knowledgeMap)
    ↓ (no market input)
retrieveRAG(queries, embeddings)
    ↓
buildGrounded(chunks)
    ↓ (knowledge locked in)
buildPrompt(grounded)
    ↓
pushImages(parts) ← Images added here
    ↓
callLLM(prompt, parts)
```

**Key Characteristics:**
- **Concept Source:** Static JSON files (time_pipeline.json, htf_pipeline.json, etc.)
- **Market Input Timing:** AFTER grounding complete
- **Query Generation:** Based on pre-defined ontology, zero market awareness
- **weekly_profile Status:** Loaded but unused for retrieval

**Evidence:**
- File: core/3.query/agents/shared/base-agent.ts, line 348-354
- File: core/3.query/query-builder.ts, line 38-43
- File: core/3.query/pipeline-processor.ts, line 19-52

---

### B. Concept Prioritization Refactor (Proposed in current-flow.md)

**Source:** current-flow.md, target-flow.md, migration-plan.md

```
Market Analysis
    ↓
Concept Prioritization Agent
    ↓ (ranks existing concepts)
Ontology Expansion
    ↓
Retrieval (concept-driven)
    ↓
Grounding
    ↓
Reasoning
```

**Key Characteristics:**
- **Concept Source:** Market-prioritized ranking of existing pipeline concepts
- **Market Input Timing:** Before retrieval (via prioritization)
- **Query Generation:** Weighted by market relevance scores
- **Mechanism:** Insert prioritization layer between market and ontology

**Requires:**
- New concept-prioritization-agent.ts
- Modify buildQueries() to accept priority scores
- Modify base-agent.ts to call prioritization before retrieval

---

### C. Knowledge Gap Retrieval (Original Vision)

**Source:** Task description, original intent analysis

```
Market Image Analysis
    +
Current Grounded Knowledge
    ↓
Gap Identification
    ↓ (what's missing?)
Generate Questions
    ↓
Ontology Expansion
    ↓
Retrieval (question-driven)
    ↓
Grounding
    ↓
Reasoning
```

**Key Characteristics:**
- **Concept Source:** Market-derived questions about unknowns
- **Market Input Timing:** FIRST (drives question generation)
- **Query Generation:** Based on identified knowledge gaps
- **Mechanism:** Market state → missing knowledge → targeted retrieval

**Requires:**
- Gap identification logic
- Question generation from market state
- Comparison against current grounded knowledge
- Dynamic query formulation

---

## 2. ALIGNMENT WITH ORIGINAL VISION

### Original Intent (Evidence)

**From task description:**
> "The market should drive the questions."
> "Ontology should expand those questions."
> "Retrieval should fill knowledge gaps."
> "Grounding should become more accurate because retrieval was informed by the market."

**Key phrase:**
> "Market Image + Current Grounded Knowledge → Identify Missing Knowledge"

### Architecture Scoring

| Criterion | Current | Concept Priority | Knowledge Gap |
|-----------|---------|------------------|---------------|
| Market drives queries | ❌ No | 🟡 Partial | ✅ Yes |
| Ontology expands market questions | ❌ No | 🟡 Yes* | ✅ Yes |
| Retrieval fills gaps | ❌ No | ❌ No | ✅ Yes |
| Market-informed grounding | ❌ No | 🟡 Partial | ✅ Yes |
| **Vision Alignment** | **0%** | **40%** | **100%** |

*Concept Prioritization expands concepts but doesn't create market-derived questions

### Detailed Analysis

**Current System:**
- Market enters AFTER grounding → 0% alignment
- Pipeline concepts are static → contradicts "market drives questions"
- No gap identification → contradicts "fill knowledge gaps"
- Images arrive too late → contradicts "market-informed grounding"

**Concept Prioritization:**
- Market influences which concepts to emphasize → better than current
- Still operates on pre-defined concepts → NOT market-derived questions
- No gap identification → doesn't address "missing knowledge"
- Closer to vision but fundamentally different mechanism

**Knowledge Gap Retrieval:**
- Market state analyzed first → perfect alignment
- Questions generated from unknowns → "market drives questions"
- Retrieval targets gaps → "fill knowledge gaps"
- Grounding informed by market needs → "market-informed grounding"

### VERDICT

**Knowledge Gap Retrieval** is the only architecture that matches the original vision.

**Evidence:**
- Task description explicitly describes gap-based retrieval
- Current system and Concept Prioritization both use concept-first approach
- Original intent was question-driven, not concept-driven

---

## 3. COMPONENT REUSE ANALYSIS

### For Knowledge Gap Retrieval

#### Fully Reusable Components

**1. buildQueries() (core/3.query/query-builder.ts)**
- **Current:** Receives concepts[], knowledgeMap
- **Required:** Receive questions[], knowledgeMap
- **Modification:** Input type change only (string[] remains string[])
- **Reuse:** 95% (logic unchanged, input semantics different)

**2. Ontology Expansion (core/3.query/ontology/loader.ts)**
- **Current:** Expands concepts to canonical + aliases
- **Required:** Expand questions to canonical + aliases
- **Modification:** None required
- **Reuse:** 100% (works on any string input)

**3. retrieveRAG() (core/3.query/retrieval-core.ts)**
- **Current:** Retrieves based on queries
- **Required:** Retrieve based on questions
- **Modification:** None required (already receives WeightedQuery[])
- **Reuse:** 100%

**4. buildGrounded() (core/3.query/grounding/index.ts)**
- **Current:** Selects and formats chunks
- **Required:** Same
- **Modification:** None required
- **Reuse:** 100%

**5. buildPrompt() (core/3.query/prompt-builder.ts)**
- **Current:** Constructs prompt from grounded knowledge
- **Required:** Same
- **Modification:** None required
- **Reuse:** 100%

**6. callLLM() (shared/utils/llm-utils.ts)**
- **Current:** Calls Gemini with prompt + images
- **Required:** Same
- **Modification:** None required
- **Reuse:** 100%

**7. pushImages() mechanism (base-agent.ts line 503-505)**
- **Current:** Adds images to parts array
- **Required:** Move earlier in pipeline
- **Modification:** Timing only (logic unchanged)
- **Reuse:** 100%

**8. weekly_profile loading (run-system.ts line 316-423)**
- **Current:** Loads macro context, unused
- **Required:** Use for gap identification
- **Modification:** Pass to new gap identifier
- **Reuse:** 100% (already loads correct data)

**9. Agent prompt construction patterns**
- **Current:** role, task, constraints, outputFormat
- **Required:** Same pattern
- **Modification:** None required
- **Reuse:** 100%

**10. Storage and logging infrastructure**
- **Current:** StorageService, log utils
- **Required:** Same
- **Modification:** None required
- **Reuse:** 100%

#### Partially Reusable Components

**1. base-agent.ts orchestration**
- **Current:** Pipeline → Concepts → Queries → Retrieval
- **Required:** Images → Gap Identification → Questions → Retrieval
- **Reuse:** 60%
- **Keep:** Retrieval, grounding, prompt, LLM sections
- **Replace:** Concept extraction section (lines 348-354)

**2. Pipeline JSON files**
- **Current:** Static concept lists
- **Required:** Agent-specific guidance (constraints, roles)
- **Reuse:** 40%
- **Keep:** Agent role definitions, constraints, output schemas
- **Remove:** Static concept lists

#### New Components Required

**1. Gap Identification Function**
```typescript
function identifyKnowledgeGaps(
  marketImages: ChartImage[],
  currentGrounded: string,
  weekly_profile: MacroProfile
): string[] {
  // Returns: ["What is the DXY bias?", "Where is liquidity?", ...]
}
```

**Location:** core/3.query/gap-identifier.ts (new file)
**Size:** ~150 lines
**Dependencies:** None (standalone logic)

**2. Question Generator**
```typescript
function generateQuestions(
  gaps: string[],
  agentRole: string,
  constraints: string[]
): string[] {
  // Returns: ["DXY directional bias", "liquidity sweep zones", ...]
}
```

**Location:** core/3.query/question-generator.ts (new file)
**Size:** ~100 lines
**Dependencies:** Gap identifier

**3. Modified base-agent.ts orchestration**
- **Change:** Replace lines 348-354 (concept extraction)
- **Add:** Gap identification + question generation
- **Size:** ~50 lines changed

---

## 4. CODE SURFACE ANALYSIS

### A. Concept Prioritization

**Files Modified:**
1. core/3.query/agents/shared/base-agent.ts (~30 lines)
2. core/3.query/query-builder.ts (~40 lines)
3. New: core/3.query/agents/concept-prioritization-agent.ts (~200 lines)

**Total:**
- Files modified: 3
- Lines modified: 70
- Lines added: 200
- **Total surface: ~270 lines**

---

### B. Knowledge Gap Retrieval

**Files Modified:**
1. core/3.query/agents/shared/base-agent.ts (~50 lines)
   - Move pushImages to line 350 (before query building)
   - Replace concept extraction with gap identification
   - Pass images to gap identifier

2. core/4.output/run-system.ts (~10 lines)
   - Pass weekly_profile to gap identifier

**Files Created:**
1. core/3.query/gap-identifier.ts (~150 lines)
2. core/3.query/question-generator.ts (~100 lines)

**Total:**
- Files modified: 2
- Lines modified: 60
- Lines added: 250
- **Total surface: ~310 lines**

---

### Comparison

| Metric | Concept Priority | Knowledge Gap |
|--------|------------------|---------------|
| Files modified | 3 | 2 |
| Lines modified | 70 | 60 |
| New files | 1 | 2 |
| Lines added | 200 | 250 |
| **Total impact** | **270 lines** | **310 lines** |

**Analysis:** Similar code surface (~40 line difference).

---

## 5. RISK ANALYSIS

### A. Concept Prioritization

**Implementation Risk: MEDIUM**
- New agent pattern (prioritization) not proven
- Requires modifying query-builder signature
- Risk of priority scores being ignored by retrieval

**Architecture Risk: HIGH**
- Still concept-first, not market-first
- Doesn't align with original vision
- May require re-refactor later

**Drift Risk: HIGH**
- Adds new abstraction (prioritization) not in original design
- Creates two concept paths (static + prioritized)
- Increases system complexity

**Rollback Complexity: LOW**
- New agent can be removed
- Query-builder changes are localized
- Base-agent changes are minimal

---

### B. Knowledge Gap Retrieval

**Implementation Risk: LOW**
- Uses existing components (buildQueries, retrieval, grounding)
- Gap identifier is new but isolated
- Question generation is straightforward string manipulation

**Architecture Risk: LOW**
- Aligns with original vision
- Reduces drift from intended design
- Simplifies pipeline (removes static concepts)

**Drift Risk: LOW**
- Returns architecture to original intent
- Removes unintended abstraction (pipeline JSON concepts)
- Reduces system complexity

**Rollback Complexity: MEDIUM**
- Gap identifier is new dependency
- Base-agent orchestration changes are structural
- But changes are localized to one file

---

### Risk Matrix

| Risk Type | Concept Priority | Knowledge Gap |
|-----------|------------------|---------------|
| Implementation | 🟡 Medium | 🟢 Low |
| Architecture | 🔴 High | 🟢 Low |
| Drift | 🔴 High | 🟢 Low |
| Rollback | 🟢 Low | 🟡 Medium |
| **Overall** | 🔴 **High** | 🟢 **Low** |

---

## 6. RECOMMENDATION

### CHOICE: B. Knowledge Gap Retrieval

### Reasoning

**1. Vision Alignment (Critical)**
- Knowledge Gap Retrieval is 100% aligned with original intent
- Concept Prioritization is 40% aligned
- Task explicitly asks to verify alignment with original vision
- **Verdict:** Only Knowledge Gap matches the vision

**2. Architecture Quality**
- Knowledge Gap reduces complexity (removes static pipelines)
- Concept Prioritization adds complexity (new abstraction layer)
- Knowledge Gap is more maintainable long-term
- **Verdict:** Knowledge Gap is architecturally superior

**3. Component Reuse**
- Knowledge Gap reuses 95-100% of core components
- Concept Prioritization also reuses most components
- Both require similar new code (~250-270 lines)
- **Verdict:** Tie (both reuse well)

**4. Risk Profile**
- Knowledge Gap: Low implementation risk, low architecture risk
- Concept Prioritization: Medium implementation risk, high architecture risk
- Knowledge Gap has lower drift risk
- **Verdict:** Knowledge Gap is less risky

**5. Code Surface**
- Knowledge Gap: ~310 lines
- Concept Prioritization: ~270 lines
- Difference: ~40 lines (~15%)
- **Verdict:** Essentially equivalent

### Final Assessment

**Concept Prioritization:**
- ✅ Smaller code change
- ❌ Doesn't match original vision
- ❌ Adds architectural complexity
- ❌ High risk of future re-refactor

**Knowledge Gap Retrieval:**
- ✅ Perfect alignment with original vision
- ✅ Reduces architectural complexity
- ✅ Lower overall risk
- ✅ Uses existing components effectively
- 🟡 Slightly more code (~40 lines)

### Implementation Path

**Recommended:** Knowledge Gap Retrieval

**Rationale:**
1. The task explicitly asks to verify alignment with original vision
2. Original vision clearly describes gap-based retrieval
3. Current system is 0% aligned
4. Concept Prioritization is only 40% aligned
5. Knowledge Gap is 100% aligned
6. Risk profile favors Knowledge Gap
7. Code surface difference is negligible (~15%)

**Critical Insight:**
The previous refactor documents (current-flow.md, target-flow.md, migration-plan.md) describe a system that was never aligned with the original vision. Implementing Concept Prioritization would continue this misalignment. Knowledge Gap Retrieval corrects course back to the original architectural intent.

---

## 7. IMPLEMENTATION NOTES

### Key Changes for Knowledge Gap Retrieval

**File: core/3.query/agents/shared/base-agent.ts**

**BEFORE (line 348-354):**
```typescript
const pipeline = loadPipeline(config.pipelinePath);
const concepts = extractConcepts(pipeline, config.step);
const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));
const queries = buildQueries(concepts, knowledgeMap);
```

**AFTER:**
```typescript
// Move pushImages earlier
const parts: any[] = [{ text: "" }];
if (config.pushImages) {
  config.pushImages(parts, input, callId);
}

// Identify gaps from market images + current knowledge
const gaps = identifyKnowledgeGaps(
  parts, // market images
  minimal_context?.weekly_profile,
  config.agentRole
);

// Generate questions from gaps
const questions = generateQuestions(gaps, config.agentRole, config.constraints);

// Expand questions via ontology (reuse existing logic)
const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));
const queries = buildQueries(questions, knowledgeMap);
```

**Result:**
- Market images inform gap identification
- Gaps become questions
- Questions drive retrieval
- Perfect alignment with original vision

---

**END OF ANALYSIS**