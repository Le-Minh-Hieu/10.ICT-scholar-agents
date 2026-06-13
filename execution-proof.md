# Execution Proof: Actual Runtime Flow

**Generated:** 2026-06-09  
**Scope:** Evidence-based execution trace from run-system.ts to callLLM()  
**Method:** Code inspection with file/line references

---

## EXECUTIVE SUMMARY

**CRITICAL FINDING:** The actual execution flow is:

```
Pipeline Concepts (Static JSON)
→ Query Generation
→ Retrieval
→ Grounding
→ Prompt Construction
→ Image Injection
→ LLM Reasoning
```

**Market images enter AFTER grounding is complete.**

**Pipeline concepts enter BEFORE any market data.**

**buildQueries() receives NO market-derived information.**

---

## PHASE 1: ENTRY POINT

### File: core/4.output/run-system.ts

**Function:** `runSystem(input, options?)`

**Line 27:** Entry point

**Line 71-126:** Create empty PMSO structure
```typescript
const pmso: PMSO = {
  market_context: {
    htf_bias: { value: 'neutral', confidence: 0, ... },
    current_session: { value: 'unknown', confidence: 0, ... },
    liquidity_state: { value: 'unknown', confidence: 0, ... },
    market_mode: { value: 'unknown', confidence: 0, ... },
  },
  // ... empty structure
};
```

**Line 279-303:** Create initial HydrationContext
```typescript
const initialHydrationContext: HydrationContext = {
  parent_thesis: undefined,
  market_delivery_state: undefined,
  raw_calendar_events: exposurePolicy,
  news_events: exposurePolicy,
  relational_context: { /* empty */ },
  scenario_context: { active_scenarios: [], ... },
  pmso_context: pmso, // Empty PMSO
  inherited_temporal_state: inheritedTemporalState,
};
```

**Line 316-423:** Load weekly_profile and daily_profile
```typescript
const [latestMacroHydration, latestDailyHydration] = await Promise.all([
  getLatestMacroHydration(),
  getLatestDailyHydration()
]);
if (latestMacroHydration) {
  initialHydrationContext.weekly_profile = latestMacroHydration;
  // Contains: macro_themes, retrieval_queries, narrative_state, etc.
}
if (latestDailyHydration) {
  initialHydrationContext.daily_profile = latestDailyHydration;
}
```

**EVIDENCE:** weekly_profile and daily_profile are loaded BEFORE orchestrators run, but NOT passed to buildQueries().

---

## PHASE 2: TIME ORCHESTRATOR

### File: core/4.output/run-system.ts

**Line 443-445:** Call Time Orchestrator
```typescript
console.log("RUNNING TIME ORCHESTRATOR");
const timeResult = await runTimeOrchestrator(input, initialHydrationContext);
```

### File: core/3.query/orchestrators/time-orchestrator.ts

**Line 48-81:** Time Orchestrator execution
```typescript
export async function runTimeOrchestrator(
  input: TimeOrchestratorInput,
  hydrationContext: HydrationContext
): Promise<TimeOrchestratorOutput> {
  // Line 77-80: Call macroTimeAgent
  macroTimeAgent(
    { eurusd: { tf1: eurusd.m, tf2: eurusd.w, tf3: eurusd.d } },
    hydrationContext
  ),
}
```

---

## PHASE 3: MACRO-TIME-AGENT

### File: core/3.query/agents/time/macro-time-agent.ts

**Line 12-95:** Agent definition

**Line 26:** Call runBaseAgent
```typescript
return runBaseAgent<TimeAgentInput, TimeAgentOutput>(
  input,
  {
    agentName: "Macro-Time-Agent",
    pipelinePath: "data/time_pipeline.json",  // ← STATIC PIPELINE
    step: "macro_time",
    // ...
    pushImages: (parts, input, callId) => {  // ← IMAGES DEFINED HERE
      pushImage(parts, input.eurusd.tf1!, "Time-TF1", callId);
      pushImage(parts, input.eurusd.tf2!, "Time-TF2", callId);
      pushImage(parts, input.eurusd.tf3!, "Time-TF3", callId);
    },
  },
  hydrationContext
);
```

**KEY OBSERVATION:** pushImages is defined but NOT called yet.

---

## PHASE 4: BASE-AGENT EXECUTION

### File: core/3.query/agents/shared/base-agent.ts

**Line 329-333:** Entry point
```typescript
export async function runBaseAgent<TInput, TOutput>(
  input: TInput,
  config: AgentConfig<TInput, TOutput>,
  minimal_context: any
): Promise<TOutput & { _debug?: BaseDebugInfo }> {
```

### STEP 1: LOAD PIPELINE (Line 348)

**Line 348:** Load pipeline JSON
```typescript
const pipeline = loadPipeline(config.pipelinePath);
// For Macro-Time-Agent: loads "data/time_pipeline.json"
```

**Evidence:** File core/3.query/pipeline-processor.ts, line 19-21:
```typescript
export function loadPipeline(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
```

### STEP 2: EXTRACT CONCEPTS (Line 349)

**Line 349:** Extract concepts from pipeline
```typescript
const concepts = extractConcepts(pipeline, config.step);
// For Macro-Time-Agent: step = "macro_time"
```

**Evidence:** File core/3.query/pipeline-processor.ts, line 27-52:
```typescript
export function extractConcepts(pipeline: any, step?: string): string[] {
  let concepts: string[] = [];
  
  if (pipeline.steps && Array.isArray(pipeline.steps)) {
    if (step) {
      const targetStep = pipeline.steps.find((s: any) => s.name === step);
      if (targetStep && Array.isArray(targetStep.concepts)) 
        return targetStep.concepts;  // ← RETURNS STATIC CONCEPTS
    }
  }
  return [...new Set(concepts)];
}
```

**WHAT IS EXTRACTED:** Static string array from time_pipeline.json:
```json
{
  "steps": [
    {
      "name": "macro_time",
      "concepts": [
        "Seasonal Tendencies",
        "Economic Calendar",
        "Macro Time Cycles",
        // ... 60 static concepts
      ]
    }
  ]
}
```

**NO MARKET DATA INVOLVED.**

### STEP 3: BUILD QUERIES (Line 354)

**Line 351-354:** Build queries from concepts
```typescript
const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));

const queries = buildQueries(concepts, knowledgeMap);
```

**Evidence:** File core/3.query/query-builder.ts, line 38-43:
```typescript
export function buildQueries(
  concepts: string[],              // ← FROM PIPELINE
  knowledgeMap: KnowledgeMapEntry[],
  relational?: RelationalContext,  // ← OPTIONAL, NOT PROVIDED YET
  scenarios?: ScenarioMemory       // ← OPTIONAL, NOT PROVIDED YET
): WeightedQuery[] {
```

**INPUTS TO buildQueries():**
1. `concepts` - Static string array from pipeline JSON
2. `knowledgeMap` - Static ontology from knowledge_map.json
3. `relational` - undefined (not passed)
4. `scenarios` - undefined (not passed)

**NO IMAGES. NO MARKET STATE. NO VISION.**

### STEP 4: RETRIEVAL (Line 409)

**Line 387-418:** Embed queries and retrieve
```typescript
const conceptEmbeddings = await embedQueries(queries.map(q => q.query));

const retrieved = await retrieveRAG({
  queries,
  conceptEmbeddings,
  agentName: config.agentName,
  memory,
  symbol: Object.keys(input).find(...),
  relational: minimal_context?.relational_context,
  scenarios: minimal_context?.scenario_context,
  pmso: minimal_context?.pmso_context
});
```

**EVIDENCE:** Retrieval happens with:
- Queries generated from static pipeline concepts
- No market images
- No vision-derived concepts

### STEP 5: GROUNDING (Line 465)

**Line 465-466:** Build grounded knowledge
```typescript
const groundedResult = buildGrounded(chunks, expandedQueries);
const grounded = groundedResult.text;
```

**EVIDENCE:** Grounding happens BEFORE images are added.

### STEP 6: PROMPT CONSTRUCTION (Line 487)

**Line 487-494:** Build prompt
```typescript
const prompt = buildPrompt({
  role: config.role,
  task: config.task,
  groundedKnowledge: grounded,  // ← ALREADY FIXED
  inputContext: config.buildInputContext(input),
  constraints: config.constraints,
  outputFormat: config.outputFormat,
}, { parent_thesis: minimal_context.parent_thesis });
```

**EVIDENCE:** Prompt includes grounded knowledge text. Knowledge is now locked in.

### STEP 7: IMAGE INJECTION (Line 500-505)

**Line 500-505:** Add images to parts array
```typescript
const parts: any[] = [{ text: prompt }];

if (config.pushImages) {
  config.pushImages(parts, input, callId);  // ← IMAGES ADDED HERE
}
```

**EVIDENCE:** Images are added AFTER:
- Pipeline concepts extracted
- Queries built
- Retrieval executed
- Grounding completed
- Prompt constructed

**IMAGES ARE ADDED LAST, NOT FIRST.**

### STEP 8: LLM CALL (Line 508)

**Line 508:** Call LLM with prompt and images
```typescript
const rawLlmResult = await callLLM(
  prompt, 
  config.agentName, 
  callId, 
  parts,  // ← Contains prompt text + images
  { schema: config.schema, returnTelemetry: true }
);
```

**EVIDENCE:** LLM receives:
- Prompt with grounded knowledge (already finalized)
- Images (added at the last moment)

---

## PHASE 5: HTF ORCHESTRATOR (SAME PATTERN)

### File: core/4.output/run-system.ts

**Line 490-493:** Call HTF Orchestrator
```typescript
console.log("RUNNING HTF ORCHESTRATOR");
const htfResponse = await runHTFOrchestrator(input, initialHydrationContext);
```

### File: core/3.query/orchestrators/htf-orchestrator.ts

**Line 234-293:** HTF Orchestrator execution
```typescript
export async function runHTFOrchestrator(
  input: HTFOrchestratorInput,
  hydrationContext: HydrationContext
): Promise<HTFOrchestratorOutput & { hydrationContext: HydrationContext }> {
  
  // Line 288-293: Execute agents
  const agentPromises = [
    runSafeAgent("htfStructureAgent", () => 
      (htfStructureAgent as any)(input, { parent_thesis: hydrationContext.parent_thesis })),
    runSafeAgent("htfMacroAgent", () => 
      (htfMacroAgent as any)(input, { parent_thesis: hydrationContext.parent_thesis })),
    // ...
  ];
}
```

### File: core/3.query/agents/htf/htf-macro-agent.ts

**Line 27:** Call runBaseAgent
```typescript
return runBaseAgent<HTFMacroInput, HTFMacroOutput>(input, {
  agentName: "HTF-Macro-Agent",
  pipelinePath: "data/htf_pipeline.json",  // ← STATIC PIPELINE
  step: "macro",
  // ...
  pushImages: (parts, input, callId) => {  // ← IMAGES DEFINED
    pushImage(parts, input.eurusd?.m, "HTF-EURUSD-M", callId);
    pushImage(parts, input.eurusd?.w, "HTF-EURUSD-W", callId);
    pushImage(parts, input.eurusd?.d, "HTF-EURUSD-D", callId);
    // ... DXY, yields images
  },
}, minimal_context);
```

**SAME PATTERN:** Pipeline → Concepts → Queries → Retrieval → Grounding → Prompt → Images → LLM

---

## EXECUTION GRAPH (ACTUAL)

```
┌─────────────────────────────────────────────────────────┐
│ run-system.ts (line 27)                                 │
│ - Creates empty PMSO (line 71-126)                      │
│ - Loads weekly_profile/daily_profile (line 316-423)     │
│ - Creates initialHydrationContext (line 279-303)        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ runTimeOrchestrator (line 445)                          │
│ - Calls macroTimeAgent (line 77-80)                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ macroTimeAgent (macro-time-agent.ts line 26)            │
│ - Calls runBaseAgent with:                              │
│   * pipelinePath: "data/time_pipeline.json"             │
│   * step: "macro_time"                                  │
│   * pushImages: function (NOT CALLED YET)               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ runBaseAgent (base-agent.ts line 329)                   │
│                                                          │
│ STEP 1 (line 348): loadPipeline()                       │
│   Input: "data/time_pipeline.json"                      │
│   Output: JSON object with 60 static concepts           │
│                                                          │
│ STEP 2 (line 349): extractConcepts()                    │
│   Input: pipeline, "macro_time"                         │
│   Output: string[] (60 concepts)                        │
│   Source: Static JSON file                              │
│   Market data: NONE                                     │
│                                                          │
│ STEP 3 (line 354): buildQueries()                       │
│   Input: concepts, knowledgeMap                         │
│   Output: WeightedQuery[] (~150-200 queries)            │
│   Market images: NOT PROVIDED                           │
│   Vision data: NOT PROVIDED                             │
│   weekly_profile: NOT USED                              │
│                                                          │
│ STEP 4 (line 409): retrieveRAG()                        │
│   Input: queries, conceptEmbeddings                     │
│   Output: chunks (retrieved knowledge)                  │
│   Based on: Static pipeline concepts                    │
│                                                          │
│ STEP 5 (line 465): buildGrounded()                      │
│   Input: chunks, expandedQueries                        │
│   Output: grounded text (finalized)                     │
│   Knowledge: NOW LOCKED IN                              │
│                                                          │
│ STEP 6 (line 487): buildPrompt()                        │
│   Input: grounded knowledge (fixed)                     │
│   Output: prompt text                                   │
│   Contains: Grounded knowledge already selected         │
│                                                          │
│ STEP 7 (line 503-505): pushImages()                     │
│   Input: parts array, input, callId                     │
│   Output: parts with images appended                    │
│   Images: ADDED HERE (TOO LATE)                         │
│                                                          │
│ STEP 8 (line 508): callLLM()                            │
│   Input: prompt, parts (text + images)                  │
│   Output: LLM response                                  │
│   LLM sees: Fixed knowledge + images                    │
└─────────────────────────────────────────────────────────┘
```

---

## CRITICAL QUESTIONS ANSWERED

### Q1: Where do market images first enter the pipeline?

**ANSWER:** Line 503-505 of base-agent.ts

```typescript
if (config.pushImages) {
  config.pushImages(parts, input, callId);
}
```

**TIMING:** AFTER grounding is complete, AFTER prompt is built.

---

### Q2: Where do pipeline concepts first enter the pipeline?

**ANSWER:** Line 348-349 of base-agent.ts

```typescript
const pipeline = loadPipeline(config.pipelinePath);
const concepts = extractConcepts(pipeline, config.step);
```

**TIMING:** BEFORE query generation, BEFORE retrieval.

---

### Q3: Where is buildQueries() called?

**ANSWER:** Line 354 of base-agent.ts

```typescript
const queries = buildQueries(concepts, knowledgeMap);
```

**LOCATION:** After concept extraction, before retrieval.

---

### Q4: What inputs are passed into buildQueries()?

**ANSWER:** File base-agent.ts line 351-354

**Actual parameters:**
1. `concepts` - String array from extractConcepts(pipeline, step)
2. `knowledgeMap` - JSON object from data/knowledge_map.json
3. `relational` - NOT PASSED (undefined)
4. `scenarios` - NOT PASSED (undefined)

**Source of concepts:**
- Pipeline JSON file (e.g., data/time_pipeline.json)
- Static, pre-defined
- No market input
- No vision input
- No image input

---

### Q5: Does buildQueries() receive market-derived information?

**ANSWER:** NO

**Evidence:**

File: query-builder.ts line 38-43
```typescript
export function buildQueries(
  concepts: string[],              // ← Static from pipeline
  knowledgeMap: KnowledgeMapEntry[],
  relational?: RelationalContext,  // ← Not provided
  scenarios?: ScenarioMemory       // ← Not provided
): WeightedQuery[]
```

File: base-agent.ts line 354
```typescript
const queries = buildQueries(concepts, knowledgeMap);
// Only 2 parameters provided
// relational and scenarios are undefined
```

**weekly_profile exists but is NOT passed to buildQueries().**

**Market images exist but have NOT been added to parts yet.**

**No market-derived information reaches buildQueries().**

---

### Q6: Or only pipeline-derived concepts?

**ANSWER:** ONLY pipeline-derived concepts

**Evidence chain:**

1. base-agent.ts line 348:
```typescript
const pipeline = loadPipeline(config.pipelinePath);
// Loads: "data/time_pipeline.json"
```

2. pipeline-processor.ts line 19-21:
```typescript
export function loadPipeline(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
// Reads static JSON file
```

3. base-agent.ts line 349:
```typescript
const concepts = extractConcepts(pipeline, config.step);
// Extracts: pipeline.steps.find(s => s.name === step).concepts
```

4. pipeline-processor.ts line 32-33:
```typescript
const targetStep = pipeline.steps.find((s: any) => s.name === step);
if (targetStep && Array.isArray(targetStep.concepts)) 
  return targetStep.concepts;
// Returns static string array
```

5. base-agent.ts line 354:
```typescript
const queries = buildQueries(concepts, knowledgeMap);
// Concepts are 100% pipeline-derived
```

**NO transformation. NO market input. NO vision formation.**

---

## EVIDENCE: WEEKLY_PROFILE EXISTS BUT NOT USED

### File: run-system.ts line 329

```typescript
initialHydrationContext.weekly_profile = latestMacroHydration;
```

**weekly_profile contains:**
- macro_themes: string[]
- retrieval_queries: string[]
- narrative_state: string
- macro_bias: string
- regime: string

**This data is loaded BEFORE orchestrators run.**

**BUT:**

### File: base-agent.ts line 354

```typescript
const queries = buildQueries(concepts, knowledgeMap);
// weekly_profile is in minimal_context but NOT PASSED
```

**weekly_profile is in the hydration context but buildQueries() doesn't receive it.**

**weekly_profile.macro_themes could be used for concepts, but isn't.**

**weekly_profile.retrieval_queries could be used for queries, but isn't.**

---

## CONFLICTING ARCHITECTURES RESOLVED

### Previous Documents Claimed:

**A) Concept Prioritization Refactor (current-flow.md, target-flow.md):**
```
Market Images
→ Concept Prioritization
→ Query Generation
→ Retrieval
```

**B) Knowledge Gap Retrieval (task description):**
```
Market Image
+
Current Grounded Knowledge
↓
Identify Missing Knowledge
→ Queries
```

### ACTUAL SYSTEM (execution-proof.md):

```
Pipeline JSON (Static)
→ extractConcepts() (Static)
→ buildQueries() (Static)
→ retrieveRAG()
→ buildGrounded()
→ buildPrompt()
→ pushImages() (Too late)
→ callLLM()
```

**RESOLUTION:** Neither A nor B is implemented. The current system is ontology-first, static concept extraction.

---

## CONCLUSION

### The Actual Execution Path

1. **Static pipeline concepts** are loaded from JSON
2. **buildQueries()** receives only pipeline concepts
3. **Retrieval** executes based on static queries
4. **Grounding** selects knowledge chunks
5. **Prompt** is built with fixed grounded knowledge
6. **Images** are added to the prompt parts
7. **LLM** reasons with pre-selected knowledge + images

### Critical Findings

**Finding 1:** Market images enter AFTER grounding (line 503)

**Finding 2:** Pipeline concepts enter BEFORE queries (line 348-349)

**Finding 3:** buildQueries() receives ZERO market information (line 354)

**Finding 4:** weekly_profile exists but is NOT used for query generation

**Finding 5:** All previous refactor documents described systems that don't exist

### The Core Problem

**Grounded knowledge is selected based on static pipeline concepts, not market state.**

**Images arrive too late to influence retrieval.**

**The system cannot perform market-driven retrieval because market data never reaches buildQueries().**

---

**END OF EXECUTION PROOF**