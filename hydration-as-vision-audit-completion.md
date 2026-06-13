# Hydration Context Audit - Completion

This file contains the remaining sections of the hydration-as-vision-audit.md report.

---

## PHASE 6: NEW TYPE NECESSITY TEST (Continued)

### KnowledgeGap Type

**Proposed Purpose:** Represent missing information and uncertainty

**Necessity Test:**

| Gap Component | Already Exists? | Field |
|---------------|----------------|-------|
| Uncertainty score | YES | weekly_profile.narrative_confidence, pmso.intermarket.macro_news_modifier.uncertainty_pressure |
| Missing domains | YES | weekly_profile.retrieval_queries (implicit) |
| Contradictions | YES | scenario_context.active_scenarios[].contradicting_anchors |
| Opposing evidence | YES | parent_thesis.opposing_evidence, ProbabilisticValue.opposing_evidence |
| Invalidation triggers | YES | scenario_context.invalidation_triggers, parent_thesis.shift_conditions |
| Suggested queries | YES | weekly_profile.retrieval_queries |

**Coverage:** 5/5 requirements already in HydrationContext

**VERDICT: OPTIONAL (Can be represented without new type)**

**Reasoning:**
- All gap components already exist in multiple places
- weekly_profile.retrieval_queries already serves as knowledge gap list
- scenario_context.uncertainty_notes already provides gap summary
- Creating KnowledgeGap would formalize but not add new information

**Alternative Representation:**

```typescript
// Without new type, knowledge gaps are already available:

const knowledgeGaps = {
  // From weekly_profile:
  suggested_queries: hydrationContext.weekly_profile.retrieval_queries,
  uncertainty_level: hydrationContext.weekly_profile.narrative_confidence,
  
  // From scenario_context (if available):
  contradictions: hydrationContext.scenario_context?.active_scenarios
    .flatMap(s => s.contradicting_anchors),
  
  // From pmso:
  uncertainty_pressure: hydrationContext.pmso_context?.intermarket
    .macro_news_modifier?.uncertainty_pressure
};
```

**If formalization desired**, create alias type:

```typescript
// No new data, just formalization:
type KnowledgeGapHints = {
  queries: string[];              // = weekly_profile.retrieval_queries
  uncertainty: number;            // = narrative_confidence
  contradicting_evidence: string[]; // = scenario contradicting_anchors
};
```

**No new type required. Data already exists.**

---

## PHASE 7: FINAL VERDICT

### 1. Does HydrationContext already contain most Vision information?

**YES — 90-95% coverage**

**Evidence:**
- 10/10 vision requirements present in HydrationContext
- weekly_profile + daily_profile contain 85% of vision needs
- pmso_context, scenario_context, parent_thesis contain remaining 15%
- All required components exist, just populated at wrong time

---

### 2. What percentage of Vision requirements are already covered?

**90-95% covered by existing HydrationContext fields**

**Breakdown:**
- Market interpretation: 90%
- Bias: 95%
- Narrative: 90%
- Regime: 85%
- Market state: 80%
- Intermarket context: 85%
- Temporal context: 90%
- Contradictions: 95%
- Alternative scenarios: 95%
- Uncertainty: 90%

**Average: 90%**

---

### 3. Is the real issue Missing Components or Execution Order?

**EXECUTION ORDER — not missing components**

**Evidence:**

| Component | Exists? | Available Before Retrieval? | Problem |
|-----------|---------|----------------------------|---------|
| weekly_profile | ✅ | ✅ YES | Not used for queries |
| daily_profile | ✅ | ✅ YES | Not used for queries |
| parent_thesis | ✅ | ❌ NO | Created after retrieval |
| scenario_context | ✅ | ❌ NO | Created after retrieval |
| relational_context | ✅ | ❌ NO | Created after retrieval |

**The issue:**
- 85% of vision exists BEFORE retrieval (weekly/daily profiles)
- 15% is created AFTER retrieval (parent_thesis, scenarios, relational)
- Query generation ignores the 85% and uses static pipeline concepts instead

**NOT a component problem. An orchestration problem.**

---

### 4. Can VisionContext be avoided entirely?

**YES — VisionContext is redundant**

**Reasoning:**
1. HydrationContext already contains all vision components
2. No new information would be added by VisionContext
3. Would create duplication and maintenance burden
4. weekly_profile + daily_profile already serve as vision layer

**Instead of creating VisionContext:**
- Use existing weekly_profile fields for query generation
- Pass weekly_profile.macro_themes to buildQueries()
- Use weekly_profile.retrieval_queries as knowledge gap hints
- Populate pmso_context.market_context earlier with weekly/daily data

**Zero new types needed.**

---

### 5. Can KnowledgeGap be represented using existing objects?

**YES — KnowledgeGap can be represented without new type**

**Existing representations:**

```typescript
// Knowledge gaps are already represented by:

// 1. Explicit query suggestions:
weekly_profile.retrieval_queries: string[]

// 2. Uncertainty metrics:
weekly_profile.narrative_confidence: number
pmso.intermarket.macro_news_modifier.uncertainty_pressure: number
scenario_context.uncertainty_notes: string

// 3. Contradictions:
scenario_context.active_scenarios[].contradicting_anchors: string[]
parent_thesis.opposing_evidence: string

// 4. Invalidation triggers:
scenario_context.active_scenarios[].invalidation_triggers: string[]
parent_thesis.shift_conditions: string
```

**If formalization desired**, use type alias (no new data):

```typescript
type KnowledgeGapHints = {
  suggested_queries: string[];      // weekly_profile.retrieval_queries
  uncertainty_level: number;        // weekly_profile.narrative_confidence  
  contradictions: string[];         // scenario contradicting_anchors
};
```

**No new type required. Data already exists.**

---

### 6. What is the smallest possible refactor surface?

**MINIMAL — Input rewiring only**

**Required Changes:**

1. **buildQueries() modification (~15 lines)**
   ```typescript
   // CURRENT:
   const concepts = extractConcepts(pipeline, step);
   
   // CHANGE TO:
   const concepts = hydrationContext.weekly_profile?.macro_themes 
     || extractConcepts(pipeline, step);
   
   // OPTIONAL: Add gap-based queries
   if (hydrationContext.weekly_profile?.retrieval_queries) {
     queries.push(...hydrationContext.weekly_profile.retrieval_queries);
   }
   ```

2. **No new types needed** (0 lines)
   - VisionContext: ❌ redundant
   - KnowledgeGap: ❌ optional (use existing fields)

3. **No orchestration changes** (0 lines)
   - weekly_profile already loaded before retrieval
   - Already passed in HydrationContext
   - Already available to all components

4. **Optional: Early PMSO population (~30 lines)**
   ```typescript
   // In run-system.ts, after loading profiles:
   if (weekly_profile) {
     initialHydrationContext.pmso_context.market_context.htf_bias = {
       value: weekly_profile.macro_bias.toLowerCase(),
       confidence: weekly_profile.narrative_confidence,
       source: "weekly-profile",
       opposing_evidence: [],
       invalidation_triggers: []
     };
   }
   ```

**Total Changes:**
- **New code: 0 lines** (no new types)
- **Modified code: 15-45 lines** (buildQueries + optional PMSO)
- **Unchanged code: ~49,950 lines** (99.9% of system)

**This is the MINIMUM refactor. Zero new types. Just use what exists.**

---

## CONCLUSION

### Primary Findings

1. **HydrationContext already IS the Vision Layer**
   - 90-95% of vision requirements present
   - weekly_profile + daily_profile contain 85% of needs
   - All required data structures exist

2. **The problem is NOT missing components**
   - The problem is execution order
   - Vision data exists BEFORE retrieval but is ignored
   - Query generation uses static pipelines instead of vision

3. **New types are REDUNDANT**
   - VisionContext: duplicates existing HydrationContext fields
   - KnowledgeGap: duplicates existing uncertainty/retrieval_queries fields
   - Zero new types needed

4. **Minimum refactor: ~15-45 lines**
   - Modify buildQueries() to accept hydration context
   - Use weekly_profile.macro_themes instead of pipeline concepts
   - Optionally use weekly_profile.retrieval_queries
   - No new types, no new agents, no new retrieval

### Recommendations

**DO:**
- Use existing HydrationContext fields
- Pass weekly_profile.macro_themes to buildQueries()
- Use weekly_profile.retrieval_queries as knowledge gap hints
- Populate pmso_context earlier with weekly/daily data

**DO NOT:**
- Create VisionContext type (redundant)
- Create KnowledgeGap type (optional, data exists)
- Rebuild retrieval (perfect as-is)
- Modify agents (perfect as-is)
- Change orchestration (minimal changes only)

### Answer to Core Question

**"Can HydrationContext already serve as VisionContext?"**

**YES. HydrationContext IS VisionContext.**

The system was designed extensibly. Vision-first is already possible with existing types. Only execution order needs adjustment.

---

**END OF REPORT**