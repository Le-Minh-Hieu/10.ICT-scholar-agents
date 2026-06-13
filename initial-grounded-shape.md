# Initial Grounded Knowledge Shape Audit

**Date:** 2026-06-09  
**Objective:** Determine the correct SHAPE of Initial Grounded Knowledge  
**Method:** Evidence-based mapping only, no design or implementation

---

## EXECUTIVE SUMMARY

**Finding:** knowledge_map.json is **CONCEPT-CENTRIC**

**Structure:** Each concept has its own entry with complete vision rules

**Shape Recommendation:** **OPTION B - Aggregated per agent**

**Evidence:** Multiple entries for same concept exist, requiring aggregation at agent level

---

## 1. IS KNOWLEDGE_MAP.JSON CONCEPT-CENTRIC OR AGENT-CENTRIC?

**ANSWER: CONCEPT-CENTRIC**

### Evidence

**Structure Pattern:**
```json
[
  {
    "cluster_id": "rc_263",
    "concept": "Seasonal Tendencies",  // ← Concept is primary key
    "type": "timing",
    "layer": "HTF",
    "agent": { ... },                   // ← Vision rules nested under concept
    "size": 17
  },
  {
    "cluster_id": "rc_429",
    "concept": "Seasonal Tendencies",  // ← SAME concept, DIFFERENT entry
    "type": "concept",
    "layer": "HTF",
    "agent": { ... },                   // ← Different vision rules
    "size": 11
  }
]
```

**Key Observation:**
- Primary organization: by concept name
- Each concept can have MULTIPLE entries
- Each entry has different vision rules
- No agent-level aggregation exists

**Conclusion:** knowledge_map.json is organized around concepts, not agents

---

## 2. MACRO-TIME-AGENT CONCEPT MAPPING

### Macro-Time-Agent Concepts (from time_pipeline.json)

**Step:** "macro_time"

**Concepts (first 10 of 60):**
1. Seasonal Tendencies
2. Economic Calendar
3. Seasonal Influences
4. Calendar Effects
5. Macro Time Cycles
6. Macro Time Windows
7. Macro Time Events
8. Macro Time Patterns
9. Macro Time Anomalies
10. Macro Time Seasonality

---

### Concept → knowledge_map Entry → Vision Rule Mapping

#### CONCEPT 1: "Seasonal Tendencies"

**Found:** 3 entries in knowledge_map.json

**Entry 1 (cluster_id: rc_263)**
```
Type: timing
Layer: HTF

Vision Rule:
{
  role: "Identifies potential long-term directional bias based on historical patterns",
  
  query_templates: [
    "How do seasonal tendencies impact the market's long-term direction?",
    "What are the historical seasonal patterns for [asset] during [month/quarter]?",
    "Can seasonal tendencies be used to determine market bias and major turns?"
  ],
  
  focus: [
    "Historical price action over specific periods (months/quarters)",
    "Market context and overall cycle",
    "Strategic timeframe alignment"
  ],
  
  signal: "Probable long-term bullish or bearish bias for a given seasonal period.",
  
  when_to_use: "When establishing a higher timeframe directional bias or seeking confluence for strategic positioning.",
  
  invalid_when: "For precise short-term entry or exit signals, or during periods dominated by extreme, news-driven market events."
}

Size: 17 chunks
```

**Entry 2 (cluster_id: rc_429)**
```
Type: concept
Layer: HTF

Vision Rule:
{
  role: "Detects long-term directional probabilities based on historical seasonal patterns.",
  
  query_templates: [
    "What are the seasonal tendencies for [asset]?",
    "How do seasonal tendencies influence price action in [month/quarter]?",
    "Identify historical seasonal patterns for high/low of the year."
  ],
  
  focus: [
    "Current seasonal tendencies",
    "Specific time periods (month/quarter)",
    "Historical probabilities for directional movement"
  ],
  
  signal: "Probabilistic long-term directional bias for a specific period.",
  
  when_to_use: "When seeking a long-term directional bias or identifying potential high/low of the year based on historical calendar patterns.",
  
  invalid_when: "When looking for precise short-term entry timing or intraday reversals."
}

Size: 11 chunks
```

**Entry 3 (cluster_id: rc_446)**
```
Type: pattern
Layer: HTF

Vision Rule:
{
  role: "Detects recurring price patterns based on calendar time",
  
  query_templates: [
    "What are the seasonal tendencies for [asset]?",
    "How does seasonality affect [asset] prices?",
    "When is the best time to buy/sell [asset] based on seasonal patterns?"
  ],
  
  focus: [
    "Asset",
    "Time of year (months/quarters)",
    "Historical price performance"
  ],
  
  signal: "Indication of typical periods of strength or weakness for an asset",
  
  when_to_use: "When establishing long-term market bias or macro timing insights",
  
  invalid_when: "For short-term trading signals or precise entry/exit timing"
}

Size: 3 chunks
```

---

#### CONCEPT 2: "Economic Calendar"

**Found:** 2 entries in knowledge_map.json

**Entry 1 (cluster_id: rc_266)**
```
Type: concept
Layer: HTF

Vision Rule:
{
  role: "Identifies scheduled news events that impact market volatility and direction",
  
  focus: [
    "Scheduled economic releases",
    "News event timing",
    "Expected market impact"
  ],
  
  signal: "Key upcoming events that may affect price action",
  
  when_to_use: "When planning trade timing around scheduled news releases",
  
  invalid_when: "For analyzing past price action unrelated to scheduled events"
}
```

**Entry 2 (cluster_id: rc_432)**
```
Type: timing
Layer: HTF

Vision Rule:
{
  role: "Detects economic event timing and impact potential",
  
  focus: [
    "Economic calendar events",
    "Release timing",
    "Volatility expectations"
  ],
  
  signal: "Scheduled events requiring trade adjustments",
  
  when_to_use: "Before major economic releases",
  
  invalid_when: "During quiet calendar periods"
}
```

---

#### CONCEPT 3: "Seasonal Influences"

**Found:** 1 entry in knowledge_map.json

**Entry (cluster_id: unknown)**
```
Type: timing
Layer: HTF

Vision Rule:
{
  role: "Detects broader seasonal factors affecting market behavior",
  
  focus: [
    "Seasonal patterns",
    "Calendar effects",
    "Market cycles"
  ],
  
  signal: "Seasonal context for market interpretation",
  
  when_to_use: "When establishing macro market context",
  
  invalid_when: "For short-term tactical decisions"
}
```

---

### Pattern Observed

**For Macro-Time-Agent:**

```
Concept: "Seasonal Tendencies"
    ↓
knowledge_map entries: 3 different entries
    ↓
Vision rules: 3 different rule sets (timing, concept, pattern)
    ↓
Result: Multiple vision perspectives for same concept
```

**Implication:** Agent needs to aggregate multiple vision rules per concept

---

## 3. SHAPE DETERMINATION

### Option A: Per-Concept Structure

```typescript
// One entry per concept
{
  concept: "Seasonal Tendencies",
  role: "Identifies potential long-term directional bias...",
  focus: ["Historical price action", "Market context", ...],
  signal: "Probable long-term bullish or bearish bias...",
  when_to_use: "When establishing a higher timeframe...",
  invalid_when: "For precise short-term entry..."
}
```

**Problems with Option A:**
1. ❌ Same concept has MULTIPLE entries (3 for "Seasonal Tendencies")
2. ❌ Agent would need to handle multiple vision rules per concept
3. ❌ No natural aggregation point
4. ❌ Redundant information across similar rules

---

### Option B: Aggregated per Agent

```typescript
// One structure per agent
{
  agent_role: "You are an ICT Time Analysis Agent focusing on macro time-based market regime",
  
  agent_task: "Analyze macro time-based market regime, seasonal patterns, and economic calendar impacts",
  
  concepts: [
    "Seasonal Tendencies",
    "Economic Calendar",
    "Seasonal Influences",
    "Calendar Effects",
    "Macro Time Cycles"
    // ... all 60 concepts
  ],
  
  vision_rules: [
    {
      concept: "Seasonal Tendencies",
      roles: [
        "Identifies potential long-term directional bias based on historical patterns",
        "Detects long-term directional probabilities based on historical seasonal patterns",
        "Detects recurring price patterns based on calendar time"
      ],
      combined_focus: [
        "Historical price action over specific periods (months/quarters)",
        "Current seasonal tendencies",
        "Asset",
        "Time of year (months/quarters)",
        "Market context and overall cycle"
      ],
      combined_signal: "Long-term directional bias for specific seasonal periods",
      when_to_use: "When establishing higher timeframe directional bias or macro timing insights",
      invalid_when: "For short-term trading signals or precise entry/exit timing"
    },
    {
      concept: "Economic Calendar",
      roles: [
        "Identifies scheduled news events that impact market volatility",
        "Detects economic event timing and impact potential"
      ],
      combined_focus: [
        "Scheduled economic releases",
        "Economic calendar events",
        "News event timing",
        "Release timing",
        "Volatility expectations"
      ],
      combined_signal: "Key upcoming events and required trade adjustments",
      when_to_use: "When planning trade timing around scheduled news releases",
      invalid_when: "During quiet calendar periods or analyzing past unrelated action"
    }
    // ... for each concept
  ],
  
  interpretation_guidelines: [
    "Look for long-term seasonal patterns in chart structure",
    "Identify upcoming economic calendar events that may disrupt patterns",
    "Assess whether current timing aligns with seasonal tendencies",
    "Determine if market context supports seasonal probability"
  ]
}
```

**Benefits of Option B:**
1. ✅ Aggregates multiple vision rules per concept
2. ✅ Natural agent-level organization
3. ✅ Removes redundancy through consolidation
4. ✅ Provides complete agent context in one structure
5. ✅ Matches agent execution model (one agent = one role)

---

## 4. REAL EXAMPLE: MACRO-TIME-AGENT INITIAL GROUNDED KNOWLEDGE

### Option A Output (Per-Concept)

```
CONCEPT: Seasonal Tendencies
Role: Identifies potential long-term directional bias based on historical patterns
Focus: Historical price action over specific periods (months/quarters), Market context and overall cycle
Signal: Probable long-term bullish or bearish bias for a given seasonal period
When to use: When establishing a higher timeframe directional bias
Invalid when: For precise short-term entry or exit signals

CONCEPT: Seasonal Tendencies (again?)
Role: Detects long-term directional probabilities based on historical seasonal patterns
Focus: Current seasonal tendencies, Specific time periods (month/quarter)
Signal: Probabilistic long-term directional bias for a specific period
When to use: When seeking a long-term directional bias
Invalid when: When looking for precise short-term entry timing

CONCEPT: Seasonal Tendencies (third time?)
Role: Detects recurring price patterns based on calendar time
Focus: Asset, Time of year (months/quarters), Historical price performance
Signal: Indication of typical periods of strength or weakness
When to use: When establishing long-term market bias
Invalid when: For short-term trading signals

CONCEPT: Economic Calendar
Role: Identifies scheduled news events that impact market volatility
...
```

**Problem:** Repetitive, confusing, no clear consolidation

---

### Option B Output (Aggregated)

```
AGENT ROLE:
You are an ICT Time Analysis Agent specializing in macro time-based market regime analysis.

AGENT TASK:
Analyze macro time-based market regime by identifying seasonal patterns, economic calendar impacts, and long-term market cycles across the provided timeframes.

DOMAIN CONCEPTS:
Seasonal Tendencies, Economic Calendar, Seasonal Influences, Calendar Effects, Macro Time Cycles, Macro Time Windows, Macro Time Events, Macro Time Patterns, Macro Time Anomalies, Macro Time Seasonality, Macro Time Calendar Effects, Macro Time Economic Events, Macro Time Market Sentiment, Macro Time Volatility, Macro Time Liquidity

VISION INTERPRETATION RULES:

1. Seasonal Tendencies
   What to look for:
   - Historical price patterns during specific months/quarters
   - Long-term directional probabilities based on calendar
   - Recurring seasonal price behaviors
   
   Focus areas:
   - Current seasonal context
   - Historical price action over comparable periods
   - Market cycle stage
   
   Expected signal:
   - Long-term bullish or bearish bias for current seasonal period
   - Probability assessment based on historical patterns
   
   When applicable:
   - Establishing higher timeframe directional bias
   - Seeking macro timing insights
   - Identifying potential yearly high/low zones
   
   Not applicable:
   - Short-term trading signals
   - Precise entry/exit timing
   - News-dominated extreme events

2. Economic Calendar
   What to look for:
   - Scheduled economic data releases
   - News event timing and impact potential
   - Market volatility expectations around events
   
   Focus areas:
   - Upcoming scheduled releases
   - Event timing relative to trading plan
   - Expected volatility impact
   
   Expected signal:
   - Key events requiring trade timing adjustments
   - Volatility windows to avoid or exploit
   
   When applicable:
   - Planning trade timing around news
   - Before major economic releases
   
   Not applicable:
   - Quiet calendar periods
   - Analyzing past action unrelated to scheduled events

INTERPRETATION GUIDELINES:
- Assess whether current month/quarter aligns with historical seasonal tendencies
- Identify upcoming economic calendar events that may disrupt or confirm seasonal patterns
- Determine if market context supports seasonal probability (trending vs ranging)
- Look for confluence between seasonal tendency and actual market structure
- Consider whether economic events strengthen or weaken seasonal expectations
```

**Advantage:** Clean, consolidated, actionable vision framework

---

## 5. WHICH STRUCTURE MATCHES EXISTING DATA BEST?

**ANSWER: Option B (Aggregated per Agent)**

### Evidence

**Evidence 1: Agent Execution Model**
- File: core/3.query/agents/shared/base-agent.ts
- Pattern: One agent = one execution = one role
- Current: Agent receives single config object
- Match: Option B naturally fits one-config-per-agent model

**Evidence 2: Concept Multiplicity**
- Finding: Same concept has 3 entries (Seasonal Tendencies)
- Problem: Option A would repeat information 3 times
- Solution: Option B aggregates into single consolidated rule
- Match: Option B handles multiplicity naturally

**Evidence 3: Query Building Pattern**
- File: core/3.query/query-builder.ts
- Current: buildQueries(concepts, knowledgeMap)
- Pattern: Accepts concept array + full knowledge map
- Implication: System already aggregates at query time
- Match: Option B mirrors existing aggregation pattern

**Evidence 4: Prompt Construction**
- File: core/3.query/agents/shared/base-agent.ts
- Line: 473
- Current: buildPrompt receives agent config object
- Pattern: Single consolidated structure per agent
- Match: Option B produces single structure matching prompt builder expectations

**Evidence 5: Data Locality**
- Current: Pipeline concepts + knowledge_map loaded separately
- Problem: No natural join point in Option A
- Solution: Option B creates join at agent level
- Match: Option B provides missing aggregation layer

---

## 6. SHAPE RECOMMENDATION

**RECOMMENDATION: Option B - Aggregated per Agent**

### Rationale

**Matches Data:**
- ✅ Handles concept multiplicity (multiple entries per concept)
- ✅ Aggregates vision rules naturally
- ✅ Consolidates redundant information

**Matches Execution:**
- ✅ One agent = one structure
- ✅ Fits existing agent config pattern
- ✅ Compatible with prompt builder

**Improves Usability:**
- ✅ Clean, non-repetitive output
- ✅ Clear interpretation guidelines
- ✅ Agent-scoped context

**Enables Vision Extraction:**
- ✅ Provides complete vision framework upfront
- ✅ Clear activation/deactivation rules
- ✅ Focus areas for chart interpretation

---

## 7. IMPLEMENTATION IMPLICATIONS

### buildInitialGrounded() Would Return

```typescript
interface InitialGroundedKnowledge {
  agent_role: string;              // From agent config
  agent_task: string;              // From agent config
  concepts: string[];              // From pipeline JSON
  vision_rules: VisionRule[];      // Aggregated from knowledge_map
  interpretation_guidelines: string[]; // Synthesized from vision rules
}

interface VisionRule {
  concept: string;
  roles: string[];                 // Multiple entries aggregated
  combined_focus: string[];        // Deduplicated focus areas
  combined_signal: string;         // Synthesized signal
  when_to_use: string;            // Synthesized from multiple entries
  invalid_when: string;           // Synthesized from multiple entries
}
```

### Processing Steps

```
1. Load pipeline JSON
   → Extract concepts for agent step
   
2. Load knowledge_map.json
   → Filter entries matching agent concepts
   → Group entries by concept
   → Aggregate vision rules per concept
   
3. Load agent config
   → Extract role, task, constraints
   
4. Synthesize
   → Combine agent config + concepts + aggregated rules
   → Generate interpretation guidelines
   → Return InitialGroundedKnowledge structure
```

---

## CONCLUSION

**Shape:** Aggregated per Agent (Option B)

**Justification:**
- knowledge_map.json is concept-centric with multiple entries per concept
- Agents execute with single role requiring single consolidated context
- Aggregation at agent level matches execution model
- Removes redundancy and improves clarity
- Enables vision-driven chart interpretation

**Data Reuse:** 100%
- All data from pipeline JSON, knowledge_map.json, and agent configs reused
- No data structure changes needed
- Only aggregation/synthesis logic required

**Natural Fit:** Option B is the only structure that naturally handles:
1. Multiple knowledge_map entries per concept
2. Single agent execution context
3. Non-repetitive vision framework
4. Clear activation rules per agent scope

---

**END OF SHAPE AUDIT**