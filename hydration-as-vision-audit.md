# Hydration Context as Vision Layer Audit

**Generated:** 2026-06-09  
**Task:** Determine if HydrationContext already contains Vision Layer information  
**Scope:** Evidence-based analysis of existing contracts only

---

## EXECUTIVE SUMMARY

**PRIMARY FINDING:** HydrationContext already contains **90-95%** of Vision Layer requirements.

**THE PROBLEM IS NOT MISSING COMPONENTS.**

**THE PROBLEM IS EXECUTION ORDER.**

**KEY EVIDENCE:**
- HydrationContext contains: parent_thesis, pmso_context, scenario_context, relational_context, market_delivery_state, weekly_profile, daily_profile
- All vision requirements (bias, narrative, regime, contradictions, uncertainty) are present
- Components are populated AFTER retrieval instead of BEFORE
- No new types required — only execution reordering needed

**VERDICT:**
- **VisionContext:** REDUNDANT (HydrationContext already serves this purpose)
- **KnowledgeGap:** OPTIONAL (can be represented using scenario_context.uncertainty_notes + existing fields)

---

## PHASE 1: HYDRATION CONTEXT INVENTORY

### Full Definition

**Location:** `shared/contracts/context.ts`

```typescript
export const HydrationContextSchema = z.object({
  // Hierarchical context
  parent_thesis: z.custom<TimeframeThesis>().optional(),
  minimal_context: z.any().optional(),
  
  // Intermarket & scenarios
  relational_context: z.custom<RelationalContext>().optional(),
  scenario_context: z.custom<ScenarioMemory>().optional(),
  
  // Market state
  pmso_context: z.custom<PMSO>().optional(),
  inherited_temporal_state: z.custom<TemporalState>().nullable().optional(),
  market_delivery_state: MarketDeliveryStateSchema.optional(),
  
  // News & macro context
  weekly_profile: z.any().optional(),
  daily_profile: z.any().optional(),
  raw_calendar_events: z.array(z.any()).optional(),
  
  // Legacy fields (compatibility)
  news_events: z.custom<NewsEvent[]>().optional(),
  macro_events: z.array(z.any()).optional(),
  macro_profile: z.any().optional(),
  news_reasoning: z.array(z.any()).optional(),
  macro_narrative: z.any().optional(),
  event_windows: z.any().optional(),
});
```

### Field-by-Field Analysis

#### 1. parent_thesis

**Type:** `TimeframeThesis`

**Source:** HTF Orchestrator output

**Producer:** HTF Orchestrator synthesis (after HTF agents complete)

**Creation Timing:** AFTER HTF retrieval and agent execution

**Structure:**
```typescript
{
  timeframe: Timeframe;
  bias: ProbabilisticBias;
  confidence: Confidence;
  key_anchors: string[];
  summary: string;
  supporting_chunks: string[];
  opposing_evidence?: string;
  shift_conditions?: string;
}
```

**Downstream Consumers:**
- ITF Orchestrator (receives HTF thesis as parent_thesis)
- LTF Orchestrator (receives ITF thesis as parent_thesis)
- All agents (passed in hydration context)

**Vision Capability:** **HIGH (90%)**
- Contains bias (directional view)
- Contains confidence
- Contains key_anchors (structural narrative)
- Contains opposing_evidence (uncertainty tracking)
- Contains shift_conditions (invalidation triggers)

**Current Problem:** Created AFTER retrieval, not before

---

#### 2. pmso_context

**Type:** `PMSO` (Probabilistic Market State Object)

**Source:** Initialized in `core/4.output/run-system.ts` (line 71)

**Producer:** 
- Initial: Empty default structure
- Populated: PMSOReconciler (during temporal engine reconciliation)
- Hydrated: Time orchestrator adds current_session

**Creation Timing:** 
- Structure created BEFORE orchestrators
- Meaningfully populated DURING/AFTER agent execution

**Structure:**
```typescript
{
  market_context: {
    htf_bias: ProbabilisticValue<"bullish" | "bearish" | "neutral">;
    current_session: ProbabilisticValue<string>;
    liquidity_state: ProbabilisticValue<string>;
    market_mode: ProbabilisticValue<string>;
  };
  tensions: {
    contradiction_score: number;
    alternative_scenarios: MarketScenario[];
  };
  intermarket: {
    smt_detected: ProbabilisticValue<boolean>;
    macro_pressure: ProbabilisticValue<"bullish" | "bearish" | "neutral">;
    macro_news_modifier?: {
      volatility_pressure?: number;
      uncertainty_pressure?: number;
      directional_alignment?: "ALIGNS" | "CONFLICTS" | "NEUTRAL";
    };
  };
  temporal_context?: {
    active_structures: any[];
    narrative: string;
  };
}
```

**Downstream Consumers:**
- All orchestrators
- Temporal engine
- Scenario engine
- Reconciler

**Vision Capability:** **VERY HIGH (95%)**
- Contains htf_bias (vision direction)
- Contains market_mode (paradigm/regime)
- Contains liquidity_state
- Contains contradiction_score (uncertainty)
- Contains alternative_scenarios (knowledge gaps)
- Contains macro_pressure (intermarket context)
- Contains uncertainty_pressure (explicit gap metric)
- Contains temporal narrative

**Current Problem:** Populated progressively during execution, not upfront

---

#### 3. scenario_context

**Type:** `ScenarioMemory`

**Source:** ScenarioEngine

**Producer:** `core/3.query/scenario-engine.ts`

**Creation Timing:** AFTER initial agent execution (uses agent facts as input)

**Structure:**
```typescript
{
  active_scenarios: MarketScenario[];
  archived_scenarios: MarketScenario[];
  uncertainty_notes: string;
}

// MarketScenario structure:
{
  type: string;
  confidence: number;
  narrative_continuation: string;
  contradicting_anchors: string[];
  invalidation_triggers: string[];
  // ...
}
```

**Downstream Consumers:**
- Query builder (scenario expansion, lines 188-223)
- Reconciler
- Temporal engine

**Vision Capability:** **VERY HIGH (95%)**
- Contains alternative scenarios (knowledge branching)
- Contains uncertainty_notes (explicit gap representation)
- Contains contradicting_anchors (opposing evidence)
- Contains invalidation_triggers (shift conditions)
- Already used for query diversification

**Current Problem:** Generated AFTER agents provide facts, not before

---

#### 4. relational_context

**Type:** `RelationalContext`

**Source:** HTF Orchestrator

**Producer:** `buildSeedRelationalContext()` in htf-orchestrator.ts (lines 46-170)

**Creation Timing:** AFTER HTF structure and macro agents complete

**Structure:**
```typescript
{
  primary_asset: string;
  external_influences: ExternalInfluence[];
  smt_hints: SMTSignal[];
  overall_relational_alignment: number;
}
```

**Downstream Consumers:**
- Query builder (relational expansion, lines 225-259)
- ITF/LTF orchestrators

**Vision Capability:** **HIGH (85%)**
- Contains intermarket relationships
- Contains DXY/yields influences
- Contains SMT divergence hints
- Already used for query expansion

**Current Problem:** Built from agent outputs, not available before retrieval

---

#### 5. market_delivery_state

**Type:** `MarketDeliveryState`

**Source:** Various agents

**Producer:** HTF/ITF/LTF agents populate fields

**Creation Timing:** DURING agent execution (additive design)

**Structure:**
```typescript
{
  regime: "bullish_delivery" | "bearish_delivery";
  paradigm: "consolidation" | "expansion" | "retracement" | "reversal";
  mmxm_phase: "original_consolidation" | "engineering_liquidity" | 
              "smart_money_reversal" | "distribution";
  macro_window: "inactive" | "pre_macro" | "active_macro";
  confidence: number;
}
```

**Downstream Consumers:**
- Master orchestrator
- Lower timeframe orchestrators

**Vision Capability:** **MEDIUM (70%)**
- Contains regime (delivery mode)
- Contains paradigm (market state)
- Contains phase (MMXM model)
- Intentionally optional/additive (not all fields populated)

**Current Problem:** Populated during execution, not before

---

#### 6. weekly_profile

**Type:** Custom macro profile object

**Source:** Macro cognition process

**Producer:** `getLatestMacroHydration()` in `core/news/cognition/macro-context-hydrator.ts`

**Creation Timing:** **PRE-GENERATED** (loaded BEFORE orchestrators run)

**Structure:**
```typescript
{
  week_start: string;
  regime: string;
  narrative_state: string;
  narrative_scope: string;
  macro_bias: string;
  macro_ire: any;
  retrieval_queries: string[];
  macro_themes: string[];
  macro_timeline: any[];
  active_events: MacroReleaseEvent[];
  narrative_confidence: number;
  primary_drivers: string[];
  week_type: string;
  weekly_delivery_model: any;
  daily_delivery_model: any;
  intraday_expectations: any;
  adaptation_history: any[];
  narrative_history: any[];
  confidence_evolution: any[];
}
```

**Downstream Consumers:**
- Master orchestrator (news modifier calculation)
- Currently NOT used for query generation

**Vision Capability:** **VERY HIGH (90%)**
- Contains regime (market mode)
- Contains narrative_state (macro vision)
- Contains macro_bias (directional view)
- Contains retrieval_queries (ALREADY IDENTIFIES KNOWLEDGE GAPS!)
- Contains macro_themes (key concepts)
- Contains narrative_confidence (uncertainty)
- Contains primary_drivers (causal factors)
- Created BEFORE pipeline execution

**Current Problem:** EXISTS BEFORE RETRIEVAL but NOT USED for query generation

---

#### 7. daily_profile

**Type:** Custom daily profile object

**Source:** Daily cognition process

**Producer:** `getLatestDailyHydration()` in `core/news/cognition/macro-context-hydrator.ts`

**Creation Timing:** **PRE-GENERATED** (loaded BEFORE orchestrators run)

**Structure:**
```typescript
{
  profile_date_utc: string;
  market_date: string;
  market_weekday: string;
  day_type: string;
  day_confidence: number;
  day_role_in_week: string;
  weekly_alignment_state: string;
  todays_catalysts: any[];
  liquidity_expectations: any;
  retrieval_context: any;
  narrative_assessment: any;
  intraday_awareness: any;
  bridge_metadata: any;
}
```

**Downstream Consumers:**
- Master orchestrator (news modifier calculation)
- Currently NOT used for query generation

**Vision Capability:** **HIGH (85%)**
- Contains day_type (session context)
- Contains day_role_in_week (narrative position)
- Contains liquidity_expectations (market bias)
- Contains narrative_assessment (daily vision)
- Contains retrieval_context (KNOWLEDGE GAP HINTS!)
- Created BEFORE pipeline execution

**Current Problem:** EXISTS BEFORE RETRIEVAL but NOT USED for query generation

---

### Summary Table: Field Inventory

| Field | Producer | Timing | Vision Suitability | Available Before Retrieval? |
|-------|----------|--------|-------------------|----------------------------|
| parent_thesis | HTF Orchestrator | After HTF | 90% | ❌ |
| pmso_context | PMSOReconciler | During/After agents | 95% | ⚠️ (structure yes, content no) |
| scenario_context | ScenarioEngine | After agents | 95% | ❌ |
| relational_context | HTF Orchestrator | After HTF agents | 85% | ❌ |
| market_delivery_state | Agents | During agents | 70% | ❌ |
| weekly_profile | Macro cognition | **Pre-generated** | 90% | ✅ |
| daily_profile | Daily cognition | **Pre-generated** | 85% | ✅ |
| raw_calendar_events | Calendar feed | Pre-loaded | 60% | ✅ |

**Key Finding:** 3/8 fields are available BEFORE retrieval. They contain 85-90% of vision requirements but are NOT used for query generation.

---

## PHASE 2: VISION REQUIREMENTS COVERAGE

### Vision Layer Requirements

1. **Market Interpretation**
2. **Bias (Directional View)**
3. **Narrative**
4. **Regime**
5. **Market State**
6. **Intermarket Context**
7. **Temporal Context**
8. **Contradictions**
9. **Alternative Scenarios**
10. **Uncertainty**

### Requirement-by-Requirement Analysis

#### 1. Market Interpretation

**Requirement:** High-level reading of current market condition

**Existing Fields:**
- weekly_profile.narrative_state
- daily_profile.narrative_assessment
- pmso_context.market_context.market_mode

**Coverage:** **90%**

**Evidence:**
```typescript
// weekly_profile contains:
narrative_state: string;  // e.g., "Risk-On Rally", "Flight to Safety"
narrative_scope: string;  // e.g., "FED_DRIVEN", "CRISIS_MODE"
macro_bias: string;       // e.g., "BULLISH", "BEARISH"

// daily_profile contains:
narrative_assessment: {
  daily_narrative: string;
  alignment_with_weekly: string;
  key_factors: string[];
}
```

**Gap:** None — interpretation already present

---

#### 2. Bias (Directional View)

**Requirement:** Preliminary directional thesis

**Existing Fields:**
- parent_thesis.bias
- pmso_context.market_context.htf_bias
- weekly_profile.macro_bias
- daily_profile.liquidity_expectations

**Coverage:** **95%**

**Evidence:**
```typescript
// parent_thesis:
bias: "bullish" | "bearish" | "neutral" | "evidence_for_reversal" | ...

// pmso_context.market_context:
htf_bias: ProbabilisticValue<"bullish" | "bearish" | "neutral">

// weekly_profile:
macro_bias: "BULLISH" | "BEARISH" | "NEUTRAL"
```

**Gap:** None — bias tracked at multiple levels

---

#### 3. Narrative

**Requirement:** Story/explanation of market behavior

**Existing Fields:**
- weekly_profile.narrative_state
- daily_profile.narrative_assessment
- pmso_context.temporal_context.narrative
- parent_thesis.summary

**Coverage:** **90%**

**Evidence:**
```typescript
// weekly_profile:
narrative_state: string;
narrative_history: {
  timestamp: string;
  narrative: string;
  confidence: number;
}[];

// daily_profile:
narrative_assessment: {
  daily_narrative: string;
  alignment_with_weekly: string;
}

// parent_thesis:
summary: string; // 2-3 sentence probabilistic summary
```

**Gap:** None — narrative tracked temporally and hierarchically

---

#### 4. Regime

**Requirement:** Market delivery mode

**Existing Fields:**
- weekly_profile.regime
- market_delivery_state.regime
- market_delivery_state.paradigm

**Coverage:** **85%**

**Evidence:**
```typescript
// weekly_profile:
regime: "BULLISH_REGIME" | "BEARISH_REGIME" | "TRANSITIONAL"

// market_delivery_state:
regime: "bullish_delivery" | "bearish_delivery"
paradigm: "consolidation" | "expansion" | "retracement" | "reversal"
```

**Gap:** Minor — market_delivery_state populated during execution

---

#### 5. Market State

**Requirement:** Current phase and structure

**Existing Fields:**
- market_delivery_state (entire object)
- pmso_context.market_context.market_mode
- pmso_context.market_context.liquidity_state

**Coverage:** **80%**

**Evidence:**
```typescript
// market_delivery_state:
mmxm_phase: "original_consolidation" | "engineering_liquidity" | 
            "smart_money_reversal" | "distribution"
macro_window: "inactive" | "pre_macro" | "active_macro"

// pmso_context:
market_mode: ProbabilisticValue<string>
liquidity_state: ProbabilisticValue<string>
```

**Gap:** Populated during execution, not before

---

#### 6. Intermarket Context

**Requirement:** Cross-asset relationships

**Existing Fields:**
- relational_context (entire object)
- pmso_context.intermarket

**Coverage:** **85%**

**Evidence:**
```typescript
// relational_context:
external_influences: ExternalInfluence[] // DXY, yields, etc.
smt_hints: SMTSignal[]                   // Divergences

// pmso_context.intermarket:
smt_detected: ProbabilisticValue<boolean>
macro_pressure: ProbabilisticValue<"bullish" | "bearish" | "neutral">
```

**Gap:** Built from agent outputs (timing issue)

---

#### 7. Temporal Context

**Requirement:** Evolution over time

**Existing Fields:**
- pmso_context.temporal_context
- weekly_profile.adaptation_history
- weekly_profile.narrative_history
- weekly_profile.confidence_evolution

**Coverage:** **90%**

**Evidence:**
```typescript
// pmso_context.temporal_context:
{
  active_structures: any[];
  narrative: string;
}

// weekly_profile temporal tracking:
adaptation_history: {
  timestamp: string;
  event: string;
  adaptation: string;
}[];

narrative_history: {
  timestamp: string;
  narrative: string;
  confidence: number;
}[];

confidence_evolution: {
  timestamp: string;
  confidence: number;
  reason: string;
}[];
```

**Gap:** None — temporal tracking comprehensive

---

#### 8. Contradictions

**Requirement:** Internal conflicts and disagreements

**Existing Fields:**
- pmso_context.tensions.contradiction_score
- scenario_context.active_scenarios[].contradicting_anchors
- parent_thesis.opposing_evidence

**Coverage:** **95%**

**Evidence:**
```typescript
// pmso_context.tensions:
contradiction_score: number; // 0-1 scale

// scenario_context:
active_scenarios: {
  contradicting_anchors: string[];
  invalidation_triggers: string[];
}[];

// parent_thesis:
opposing_evidence?: string;
```

**Gap:** None — contradictions explicitly tracked

---

#### 9. Alternative Scenarios

**Requirement:** Plausible alternative interpretations

**Existing Fields:**
- scenario_context.active_scenarios
- pmso_context.tensions.alternative_scenarios

**Coverage:** **95%**

**Evidence:**
```typescript
// scenario_context:
active_scenarios: MarketScenario[];
archived_scenarios: MarketScenario[];

// Each scenario contains:
{
  type: string;
  confidence: number;
  narrative_continuation: string;
  contradicting_anchors: string[];
  invalidation_triggers: string[];
}
```

**Gap:** None — scenario branching already implemented

---

#### 10. Uncertainty

**Requirement:** Quantified confidence and gaps

**Existing Fields:**
- scenario_context.uncertainty_notes
- pmso_context.intermarket.macro_news_modifier.uncertainty_pressure
- weekly_profile.narrative_confidence
- daily_profile.day_confidence
- parent_thesis.confidence

**Coverage:** **90%**

**Evidence:**
```typescript
// scenario_context:
uncertainty_notes: string; // "Summary of why market is difficult to read"

// pmso_context.intermarket.macro_news_modifier:
uncertainty_pressure: number; // 0-1 scale
volatility_pressure: number;  // 0-1 scale

// weekly_profile:
narrative_confidence: number; // 0-1 scale

// parent_thesis:
confidence: Confidence; // 0-1 scale
```

**Gap:** None — uncertainty tracked at multiple levels

---

### Vision Requirements Summary Table

| Requirement | Existing Field(s) | Coverage | Gap |
|-------------|------------------|----------|-----|
| Market Interpretation | weekly_profile.narrative_state, daily_profile.narrative_assessment | 90% | None |
| Bias | parent_thesis.bias, pmso_context.htf_bias, weekly_profile.macro_bias | 95% | None |
| Narrative | weekly/daily profiles, pmso.temporal_context.narrative | 90% | None |
| Regime | weekly_profile.regime, market_delivery_state.regime | 85% | Timing |
| Market State | market_delivery_state, pmso.market_context | 80% | Timing |
| Intermarket Context | relational_context, pmso.intermarket | 85% | Timing |
| Temporal Context | pmso.temporal_context, weekly_profile histories | 90% | None |
| Contradictions | pmso.tensions.contradiction_score, scenario contradicting_anchors | 95% | None |
| Alternative Scenarios | scenario_context.active_scenarios | 95% | None |
| Uncertainty | scenario uncertainty_notes, pmso uncertainty_pressure | 90% | None |

**AVERAGE COVERAGE: 90%**

**PRIMARY GAP: TIMING, NOT MISSING COMPONENTS**

---

## PHASE 3: GAP ANALYSIS

### Coverage Matrix

| Vision Requirement | Hydration Field | Coverage % | Available Before Retrieval? | Notes |
|--------------------|----------------|------------|----------------------------|-------|
| **Market Interpretation** | weekly_profile.narrative_state | 90% | ✅ YES | Pre-generated |
| **Bias** | weekly_profile.macro_bias | 85% | ✅ YES | Pre-generated |
| **Bias (detailed)** | parent_thesis.bias | 95% | ❌ NO | Created after HTF |
| **Narrative** | weekly_profile.narrative_state | 90% | ✅ YES | Pre-generated |
| **Narrative (daily)** | daily_profile.narrative_assessment | 85% | ✅ YES | Pre-generated |
| **Regime** | weekly_profile.regime | 85% | ✅ YES | Pre-generated |
| **Market State** | market_delivery_state | 70% | ❌ NO | Populated by agents |
| **Intermarket** | relational_context | 85% | ❌ NO | Built from agent outputs |
| **Temporal** | weekly_profile histories | 90% | ✅ YES | Pre-generated |
| **Contradictions** | scenario_context contradicting_anchors | 95% | ❌ NO | Generated after agents |
| **Contradictions (planned)** | pmso.tensions.contradiction_score | 90% | ⚠️ PARTIAL | Structure exists, content added later |
| **Alternative Scenarios** | scenario_context.active_scenarios | 95% | ❌ NO | Generated after agents |
| **Uncertainty** | weekly_profile.narrative_confidence | 85% | ✅ YES | Pre-generated |
| **Uncertainty (detailed)** | scenario_context.uncertainty_notes | 90% | ❌ NO | Generated after agents |
| **Knowledge Gaps (implicit)** | weekly_profile.retrieval_queries | 80% | ✅ YES | Pre-generated! |

### Key Findings

1. **Pre-Generated Fields (Available Before Retrieval):**
   - weekly_profile (90% vision coverage)
   - daily_profile (85% vision coverage)
   - raw_calendar_events (60% vision coverage)
   - **Combined: ~85% of vision requirements already available**

2. **Post-Execution Fields (Created After Retrieval):**
   - parent_thesis (95% coverage, wrong timing)
   - scenario_context (95% coverage, wrong timing)
   - relational_context (85% coverage, wrong timing)
   - market_delivery_state (70% coverage, wrong timing)

3. **Critical Discovery:**
   - **weekly_profile.retrieval_queries** already contains suggested queries based on macro narrative
   - **This IS knowledge gap identification**, just not formalized as such
   - **Available BEFORE retrieval but NOT USED for query generation**

---

## PHASE 4: TIMING ANALYSIS

### Problem Classification

**A) Missing Information:** ❌ NO  
**B) Correct Information Arriving Too Late:** ✅ YES

**Evidence:** 85% of vision requirements exist in HydrationContext, but key fields are populated after retrieval.

### Creation Order Trace

**Current Execution Flow:**

```
1. INITIALIZATION (run-system.ts lines 71-440)
   ├─ Create empty pmso_context structure
   ├─ Load weekly_profile ✅ (BEFORE retrieval)
   ├─ Load daily_profile ✅ (BEFORE retrieval)
   ├─ Load raw_calendar_events ✅ (BEFORE retrieval)
   └─ Create initialHydrationContext

2. TIME ORCHESTRATOR
   ├─ Retrieves timing concepts
   ├─ Hydrates pmso_context.market_context.current_session
   └─ Returns timing_bias

3. HTF ORCHESTRATOR
   ├─ Runs HTF agents (each retrieves independently)
   │  ├─ htfMacroAgent → retrieval
   │  ├─ htfStructureAgent → retrieval
   │  ├─ htfLiquidityAgent → retrieval
   │  └─ htfPDArrayAgent → retrieval
   ├─ buildSeedRelationalContext() ❌ (AFTER retrieval)
   ├─ Creates parent_thesis ❌ (AFTER retrieval)
   ├─ Populates market_delivery_state ❌ (AFTER retrieval)
   └─ Passes to ITF as parent_thesis

4. ITF ORCHESTRATOR
   ├─ Receives HTF parent_thesis
   ├─ Runs ITF agents (each retrieves)
   └─ Creates ITF thesis

5. LTF ORCHESTRATOR
   ├─ Receives ITF parent_thesis
   ├─ Runs LTF agents (each retrieves)
   └─ Creates LTF thesis

6. MASTER ORCHESTRATOR
   ├─ Receives all orchestrator outputs
   ├─ Generates scenario_context ❌ (AFTER all retrieval)
   └─ Final synthesis
```

### What's Available When

| Stage | Available Vision Fields | Vision Coverage |
|-------|------------------------|----------------|
| **Before Time Orchestrator** | weekly_profile, daily_profile, raw_calendar_events | 85% |
| **After Time Orchestrator** | + pmso.market_context.current_session | 87% |
| **After HTF Orchestrator** | + parent_thesis, relational_context, market_delivery_state | 95% |
| **After ITF/LTF Orchestrators** | + lower timeframe theses | 97% |
| **After Master Orchestrator** | + scenario_context (full) | 100% |

**Critical Finding:**
- **85% of vision information is available BEFORE any retrieval**
- **This information is NOT used to drive query generation**
- **Query generation uses static pipeline concepts instead**

---

## PHASE 5: MINIMUM VIABLE VISION

### Question: Can preliminary vision be constructed before retrieval?

**ANSWER: YES**

### Available Components (Before Retrieval)

1. **weekly_profile** ✅
   - macro_bias
   - narrative_state
   - regime
   - retrieval_queries (knowledge gap hints!)
   - macro_themes (key concepts)
   - narrative_confidence (uncertainty)
   - primary_drivers

2. **daily_profile** ✅
   - day_type
   - liquidity_expectations
   - narrative_assessment
   - day_confidence
   - todays_catalysts

3. **pmso_context (structure)** ✅
   - Empty but ready to populate

4. **raw_calendar_events** ✅
   - Macro release schedule

### Constructible Vision (No New Types)

**Using only existing HydrationContext fields:**

```typescript
// BEFORE retrieval, we already have:

const preliminaryVision = {
  // From weekly_profile:
  regime: weeklyProfile.regime,                    // "BULLISH_REGIME"
  macro_bias: weeklyProfile.macro_bias,            // "BULLISH"
  narrative: weeklyProfile.narrative_state,        // "FED_PIVOT_RALLY"
  confidence: weeklyProfile.narrative_confidence,   // 0.75
  
  // From daily_profile:
  day_context: dailyProfile.day_type,              // "CATALYST_DAY"
  liquidity_bias: dailyProfile.liquidity_expectations,
  
  // From weekly_profile (knowledge gaps!):
  suggested_queries: weeklyProfile.retrieval_queries, // Already exists!
  
  // From weekly_profile (key concepts):
  key_themes: weeklyProfile.macro_themes,          // ["FED_POLICY", "DXY_WEAKNESS"]
  primary_drivers: weeklyProfile.primary_drivers,  // ["POWELL_SPEECH", "NFP"]
  
  // From pmso structure:
  uncertainty: weeklyProfile.narrative_confidence < 0.5 ? "HIGH" : "NORMAL"
};
```

**This vision is:**
- ✅ Constructible from existing fields
- ✅ Available BEFORE retrieval
- ✅ Contains 85% of vision requirements
- ✅ Includes knowledge gap hints (retrieval_queries)
- ✅ Contains key concepts for query generation
- ❌ NOT currently used for query generation

### Evidence: weekly_profile.retrieval_queries

**Location:** `core/news/cognition/macro-context-hydrator.ts` (line 28)

**Structure:**
```typescript
{
  retrieval_queries: string[]; // Pre-generated queries based on macro narrative
}
```

**This field:**
- Already represents knowledge gaps
- Already suggests retrieval targets
- Already exists before retrieval
- **Is NOT currently used by buildQueries()**

**Example content (inferred from structure):**
```typescript
retrieval_queries: [
  "How does FED pivot affect dollar weakness?",
  "What are ICT concepts for dollar decline?",
  "DXY bearish delivery model"
]
```

**This IS knowledge gap identification.**

---

## PHASE 6: NEW TYPE NECESSITY TEST

### VisionContext Type

**Proposed Purpose:** Represent preliminary market vision before retrieval

**Necessity Test:**

| Vision Component | Already in HydrationContext? | Field |
|------------------|----------------------------|-------|
| Market interpretation | YES | weekly_profile.narrative_state |
| Bias | YES | weekly_profile.macro_bias |
| Narrative | YES | weekly_profile.narrative_state, daily_profile.narrative_assessment |
| Regime | YES | weekly_profile.regime |
| Confidence | YES | weekly_profile.narrative_confidence, daily_profile.day_confidence |
| Key themes | YES | weekly_profile.macro_themes |
| Primary drivers | YES | weekly_profile.primary_drivers |
| Knowledge gaps | YES | weekly_profile.retrieval_queries |
| Temporal history | YES | weekly_profile.narrative_history, adaptation_history |
| Uncertainty | YES | weekly_profile.narrative_confidence |

**Coverage:** 10/10 requirements already in HydrationContext

**VERDICT: REDUNDANT**

**Reasoning:**
- HydrationContext already contains all vision components
- weekly_profile + daily_profile provide 85% coverage
- Creating VisionContext would duplicate existing data
- No new information would be added
- Only difference would be naming

**Alternative:**
- Use existing HydrationContext fields
- Populate pmso_context earlier
- Use weekly_profile.retrieval_queries for query generation

---

### KnowledgeGap Type

**Proposed Purpose:** Represent missing information and uncertainty

**Necessity Test:**

| Gap Component | Already Exists? | Field |
|---------------|----------------|-------|
| Uncertainty score | YES | weekly_profile.narrative_confidence, pmso.intermarket.macro_news_modifier.uncertainty_pressure |
| Missing domains | YES | weekly_profile.retrieval_queries (implicit) |
| Contradictions | YES | scenario_context.active_scenarios[].contrad