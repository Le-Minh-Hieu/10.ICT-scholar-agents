# Macro-Time-Agent Vision-First POC Implementation Design

## 1. Insertion Point: `base-agent.ts` line 409

**File:** `core/3.query/agents/shared/base-agent.ts`

**Current execution flow (lines ~350-619):**
```
extractConcepts(pipeline)
  ↓
buildQueries(concepts, knowledgeMap)   ← LINE 409
  ↓
embedQueries(queries)
  ↓
retrieveRAG(...)
  ↓
buildGrounded(chunks, queries)
  ↓
buildPrompt(role, task, grounded, ...)
  ↓
callLLM(prompt, ...)
  ↓
verifyGrounding(...)
  ↓
mapOutput(...)
```

**Target execution flow (new steps inserted AFTER concept extraction, BEFORE query building):**
```
extractConcepts(pipeline)
  ↓
buildInitialGrounded(knowledgeMap, pipeline)    ← INSERT at line 408
  ↓
extractVision(chartImages, initialGrounded)     ← new
  ↓
detectKnowledgeGaps(visionOutput, initialGrounded)  ← new
  ↓
generateQueriesFromGaps(knowledgeGaps)          ← new
  ↓
expandOntology(weightedQueries)                 ← new
  ↓
buildQueries(expandedConcepts, knowledgeMap)    ← existing line 409
  ↓
embedQueries(queries)
  ↓
retrieveRAG(...)
  ↓
buildGrounded(chunks, queries)
  ↓
buildPrompt(role, task, grounded, visionOutput, ...)  ← MODIFIED: includes vision context
  ↓
callLLM(prompt, ...)
  ↓
verifyGrounding(...)
  ↓
mapOutput(...)
```

**Exact line insertion:** Between line 407 (`scenarios: minimal_context?.scenario_context` closing brace) and line 408 (comment line). The `buildQueries()` at line 409 receives expanded concepts.

---

## 2. Function: `buildInitialGrounded()`

**File:** `core/3.query/agents/shared/vision-initial-grounded.ts` (new)

```typescript
interface InitialGroundedKnowledge {
  pipelineConcepts: string[];
  visionFields: KnowledgeMapEntry[];
  initialContext: string;
  queryIntent: string;
}

function buildInitialGrounded(
  knowledgeMap: KnowledgeMapEntry[],
  pipeline: any,
  layer: string
): InitialGroundedKnowledge {
  // 1. Extract pipeline concepts (reuses pipeline-processor)
  const pipelineConcepts = extractConcepts(pipeline);

  // 2. Filter knowledge_map entries matching pipeline concepts AND layer
  //    Uses vision-relevant fields: concept, type, focus, signal
  const visionFields = knowledgeMap.filter(entry =>
    pipelineConcepts.some(c =>
      typeof c === 'string'
        ? entry.concept.toLowerCase().includes(c.toLowerCase())
        : entry.cluster_id === (c as any).cluster_id
    ) && (layer ? entry.layer === layer : true)
  );

  // 3. Build initial grounded context string from filtered entries
  const initialContext = visionFields.map(e =>
    `[${e.concept}] type=${e.type} layer=${e.layer} signal=${e.agent.signal} focus=${e.agent.focus.join(',')}`
  ).join('\n');

  // 4. Derive query intent from combined concepts + layer
  const queryIntent = `macro_time_${layer?.toLowerCase() || 'general'}`;

  return { pipelineConcepts, visionFields, initialContext, queryIntent };
}
```

**Reuses:**
- `extractConcepts()` from `pipeline-processor.ts`
- `KnowledgeMapEntry` type from `type/knowledge.ts`
- `knowledge_map.json` data

---

## 3. Function: `extractVision()`

**File:** `core/3.query/agents/shared/vision-extraction.ts` (new)

```typescript
interface VisionOutput {
  marketInterpretation: string;       // LLM-derived text from image analysis
  detectedConcepts: string[];          // concepts identified from charts
  confidence: number;                  // 0-1 scale
  visionSummary: string;               // compact summary for downstream use
  chartPatterns: string[];             // identified patterns
  regimeObservation: string;           // expansion/consolidation/retracement
}

async function extractVision(
  chartImages: (string | { type: 'image'; mimeType: string; data: string })[],
  initialGrounded: InitialGroundedKnowledge,
  callId: string,
  agentName: string
): Promise<VisionOutput> {
  // 1. Build vision prompt incorporating initial grounded knowledge
  const visionPrompt = buildVisionPrompt(initialGrounded);

  // 2. Push images to parts array
  const parts: any[] = [{ text: visionPrompt }];
  for (const img of chartImages) {
    pushImage(parts, img);
  }

  // 3. Call LLM with images + grounded context
  const llmResult = await callLLM(visionPrompt, agentName, callId, parts, {
    schema: visionSchema  // enforced JSON output
  });

  // 4. Parse structured response
  const raw = typeof llmResult.data === 'string'
    ? JSON.parse(llmResult.data)
    : llmResult.data;

  return {
    marketInterpretation: raw.interpretation,
    detectedConcepts: raw.concepts || [],
    confidence: raw.confidence || 0.5,
    visionSummary: raw.summary || '',
    chartPatterns: raw.patterns || [],
    regimeObservation: raw.regime || '',
  };
}

function buildVisionPrompt(initialGrounded: InitialGroundedKnowledge): string {
  return `You are a Macro Time Vision Analyst.

GROUNDED KNOWLEDGE:
${initialGrounded.initialContext}

TASK:
Analyze the provided chart images. Extract:
1. Market regime (expansion / consolidation / retracement / reversal)
2. Detected ICT concepts from the chart patterns
3. Confidence level (0-1)
4. Summary of visual evidence

OUTPUT JSON:
{
  "interpretation": "string",
  "concepts": ["string"],
  "confidence": 0.0-1.0,
  "summary": "string",
  "patterns": ["string"],
  "regime": "string"
}`;
}
```

**Reuses:**
- `pushImage()` from `base-agent.ts`
- `callLLM()` from `llm-utils.ts`
- `safeToBase64()` from `base-agent.ts`

---

## 4. Function: `detectKnowledgeGaps()`

**File:** `core/3.query/agents/shared/knowledge-gap-detector.ts` (new)

```typescript
interface KnowledgeGap {
  area: string;                    // e.g., "seasonal_tendency", "ita_range"
  missingContext: string;          // what's missing
  priority: 'high' | 'medium' | 'low';
  relatedConcept: string;         // which pipeline concept it maps to
  gapType: 'temporal' | 'structural' | 'behavioral' | 'conceptual';
}

interface GapDetectionResult {
  gaps: KnowledgeGap[];
  gapSummary: string;
}

function detectKnowledgeGaps(
  visionOutput: VisionOutput,
  initialGrounded: InitialGroundedKnowledge
): GapDetectionResult {
  const gaps: KnowledgeGap[] = [];

  // Strategy 1: Compare detected concepts vs pipeline concepts
  const pipelineConceptNames = initialGrounded.pipelineConcepts.map(c =>
    typeof c === 'string' ? c : (c as any).concept || ''
  );

  for (const pc of pipelineConceptNames) {
    const found = visionOutput.detectedConcepts.some(dc =>
      dc.toLowerCase().includes(pc.toLowerCase()) ||
      pc.toLowerCase().includes(dc.toLowerCase())
    );
    if (!found) {
      gaps.push({
        area: pc,
        missingContext: `Vision did not detect "${pc}" in charts`,
        priority: 'high',
        relatedConcept: pc,
        gapType: classifyGapType(pc),
      });
    }
  }

  // Strategy 2: Check confidence threshold
  if (visionOutput.confidence < 0.6) {
    gaps.push({
      area: 'vision_confidence',
      missingContext: `Low vision confidence (${visionOutput.confidence}), needs textual grounding`,
      priority: 'high',
      relatedConcept: 'general',
      gapType: 'conceptual',
    });
  }

  // Strategy 3: Check regime coherence
  const knownRegimes = ['expansion', 'consolidation', 'retracement', 'reversal', 'distribution', 'accumulation'];
  if (!knownRegimes.includes(visionOutput.regimeObservation.toLowerCase())) {
    gaps.push({
      area: 'regime_identification',
      missingContext: `Unclear regime: "${visionOutput.regimeObservation}"`,
      priority: 'medium',
      relatedConcept: 'market_regime',
      gapType: 'structural',
    });
  }

  return {
    gaps,
    gapSummary: gaps.map(g => `[${g.priority}] ${g.area}: ${g.missingContext}`).join('\n'),
  };
}

function classifyGapType(concept: string): KnowledgeGap['gapType'] {
  const temporal = ['timing', 'time', 'window', 'session', 'day', 'week', 'month', 'calendar', 'seasonal'];
  const structural = ['structure', 'level', 'range', 'array', 'zone', 'target'];
  const behavioral = ['bias', 'behavior', 'sentiment', 'psychology', 'discipline', 'rule'];

  const lower = concept.toLowerCase();
  if (temporal.some(t => lower.includes(t))) return 'temporal';
  if (structural.some(s => lower.includes(s))) return 'structural';
  if (behavioral.some(b => lower.includes(b))) return 'behavioral';
  return 'conceptual';
}
```

---

## 5. Function: `generateQueriesFromGaps()`

**File:** `core/3.query/agents/shared/query-from-gaps.ts` (new)

```typescript
import { WeightedQuery } from '../../query-builder';

interface ExpandedKnowledgeMap {
  entries: KnowledgeMapEntry[];
  newConcepts: string[];
}

function generateQueriesFromGaps(
  gaps: KnowledgeGap[],
  knowledgeMap: KnowledgeMapEntry[],
  pipelinePath: string
): { weightedQueries: WeightedQuery[]; expandedConcepts: string[] } {
  const weightedQueries: WeightedQuery[] = [];
  const addedConcepts = new Set<string>();

  for (const gap of gaps) {
    let weight: number;
    switch (gap.priority) {
      case 'high': weight = 1.0; break;
      case 'medium': weight = 0.6; break;
      case 'low': weight = 0.3; break;
    }

    // Generate query from gap area
    const query = `Find ICT knowledge about ${gap.area} in context of ${gap.relatedConcept}`;

    weightedQueries.push({
      query,
      weight,
      type: gap.gapType === 'temporal' ? 'anchor' :
            gap.gapType === 'structural' ? 'canonical' :
            gap.gapType === 'behavioral' ? 'context' : 'alias',
    });

    // Expand concept set
    addedConcepts.add(gap.area);
  }

  // Merge with existing pipeline concepts
  const pipeline = loadPipeline(pipelinePath);
  const existingConcepts = extractConcepts(pipeline);
  const expandedConcepts = [...new Set([...existingConcepts, ...addedConcepts])];

  return { weightedQueries, expandedConcepts };
}
```

**Reuses:**
- `WeightedQuery` interface from `query-builder.ts`
- `loadPipeline()`, `extractConcepts()` from `pipeline-processor.ts`

---

## 6. Exact Code Flow (base-agent.ts diff)

### Addition at line 51 (imports):

```typescript
// NEW: Vision-first pipeline imports
import { buildInitialGrounded } from '../../vision-initial-grounded';
import { extractVision } from '../../vision-extraction';
import { detectKnowledgeGaps } from '../../knowledge-gap-detector';
import { generateQueriesFromGaps } from '../../query-from-gaps';
```

### Insertion at line 408 (inside `execute()` method, after concept extraction, before `buildQueries()`):

```typescript
    // ================================================================
    // VISION-FIRST PIPELINE (Macro-Time-Agent only)
    // ================================================================
    if (config.agentName === 'Macro-Time-Agent' && config.chartImages) {
      // Step 1: Build initial grounded from pipeline + knowledge_map
      const initialGrounded = buildInitialGrounded(
        knowledgeMap,
        pipeline,
        config.layer
      );

      // Step 2: Extract vision from chart images
      const visionOutput = await extractVision(
        config.chartImages,
        initialGrounded,
        callId,
        config.agentName
      );

      dumpRagDebug(config.agentName, "02_VISION.json", visionOutput);

      // Step 3: Detect knowledge gaps
      const gapResult = detectKnowledgeGaps(visionOutput, initialGrounded);

      dumpRagDebug(config.agentName, "03_GAPS.json", gapResult.gaps);

      // Step 4: Generate queries from gaps
      const { weightedQueries: gapQueries, expandedConcepts } = generateQueriesFromGaps(
        gapResult.gaps,
        knowledgeMap,
        config.pipelinePath
      );

      dumpRagDebug(config.agentName, "04_GAP_QUERIES.json", gapQueries);

      // Step 5: Store vision output for prompt enrichment later
      (global as any).__visionContext = {
        output: visionOutput,
        gaps: gapResult.gaps,
        gapQueries,
        initialGrounded,
      };

      // Override concepts with expanded set for downstream queries
      concepts = expandedConcepts;
    }
    // ================================================================
```

### Modification in `buildPrompt()` call (line 487-494):

```typescript
    // Pass vision context if available
    const visionContext = (global as any).__visionContext;

    const prompt = buildPrompt({
      role: config.role,
      task: config.task,
      groundedKnowledge: grounded,
      inputContext: config.buildInputContext(input),
      constraints: config.constraints,
      outputFormat: config.outputFormat,
      visionContext: visionContext?.output,    // ADD THIS LINE
    }, { parent_thesis: minimal_context.parent_thesis });

    // Cleanup global
    delete (global as any).__visionContext;
```

---

## 7. Files Modified

| File | Action | LOC Change |
|------|--------|-----------|
| `core/3.query/agents/shared/base-agent.ts` | Modify | +25 |
| `core/3.query/agents/shared/vision-initial-grounded.ts` | Create | +45 |
| `core/3.query/agents/shared/vision-extraction.ts` | Create | +80 |
| `core/3.query/agents/shared/knowledge-gap-detector.ts` | Create | +85 |
| `core/3.query/agents/shared/query-from-gaps.ts` | Create | +55 |
| `core/3.query/prompt-builder.ts` | Modify | +5 (add `visionContext` param) |
| **Total** | | **~295 LOC** |

---

## 8. LOC Estimates (Detail)

| Component | New/Modified | Lines |
|-----------|-------------|-------|
| `vision-initial-grounded.ts` | New file | 45 |
| `vision-extraction.ts` | New file | 80 |
| `knowledge-gap-detector.ts` | New file | 85 |
| `query-from-gaps.ts` | New file | 55 |
| `base-agent.ts` insertions | Modified | 25 |
| `prompt-builder.ts` param | Modified | 5 |
| **Total** | | **295** |

---

## 9. Implementation Sequence

### Phase 1: Foundation (files 1-2)

**Step 1.** Create `vision-initial-grounded.ts`
- Export `buildInitialGrounded()`
- Reuses `extractConcepts()` import
- Filters `knowledgeMap` by pipeline concepts + layer
- Produces `InitialGroundedKnowledge` interface

**Step 2.** Create `vision-extraction.ts`
- Export `extractVision()`
- Uses `callLLM()` and `pushImage()` from existing utils
- Enforces JSON output schema for vision response
- Dumps to `02_VISION.json` via `dumpRagDebug()`

### Phase 2: Gap Analysis (files 3-4)

**Step 3.** Create `knowledge-gap-detector.ts`
- Export `detectKnowledgeGaps()`
- Implements 3 detection strategies:
  1. Concept coverage check
  2. Confidence threshold check
  3. Regime coherence check
- Classifies gaps by type (temporal/structural/behavioral/conceptual)
- Dumps to `03_GAPS.json`

**Step 4.** Create `query-from-gaps.ts`
- Export `generateQueriesFromGaps()`
- Maps gap priority → query weight
- Generates weighted queries for RAG retrieval
- Returns merged expanded concept set
- Dumps to `04_GAP_QUERIES.json`

### Phase 3: Integration (files 5-6)

**Step 5.** Modify `base-agent.ts`
- Add imports for 4 new modules
- Insert vision-first pipeline block after concept extraction (line 408)
- Gate on `config.agentName === 'Macro-Time-Agent'`
- Store vision context in global (cleared after prompt building)
- Dumps debug artifacts at each stage

**Step 6.** Modify `prompt-builder.ts`
- Add optional `visionContext` parameter
- When present, inject vision analysis into prompt template
- Key injection: `## VISION ANALYSIS\n${visionContext.marketInterpretation}\n\n## DETECTED CONCEPTS\n${visionContext.detectedConcepts.join(', ')}\n## VISION CONFIDENCE\n${visionContext.confidence}`

### Phase 4: Validation

**Step 7.** Verify with existing test suite:
- `test/test-full-pipeline.ts` (no regression)
- `test/test-itf-structure-agent.ts` (other agents unaffected)
- Manual run of Macro-Time-Agent via existing capture

**Step 8.** Validate debug dumps:
- `02_VISION.json` exists and contains structured vision output
- `03_GAPS.json` has gap array
- `04_GAP_QUERIES.json` has weighted queries
- Prompt contains `## VISION ANALYSIS` section

---

## Configuration Extension

Add to `AgentConfig` interface (in `base-agent.ts` or contract):

```typescript
export interface AgentConfig<TOutput = any> {
  // ... existing fields ...

  // Vision-first pipeline config
  chartImages?: (string | { type: 'image'; mimeType: string; data: string })[];
  enableVisionFirst?: boolean;  // defaults to false, true for Macro-Time-Agent
}
```

Existing `pushImages` field in config already handles image attachment to LLM calls. The new `chartImages` field provides images specifically for the vision-first preprocessing step before RAG.

---

## Reuse Map

```
existing                          → reused for
─────────────────────────────────────────────────────
extractConcepts()                 → buildInitialGrounded()
loadPipeline()                    → generateQueriesFromGaps()
pushImage()                       → extractVision()
callLLM()                         → extractVision()
safeToBase64()                    → extractVision()
KnowledgeMapEntry                 → initialGrounded.ts
WeightedQuery                     → query-from-gaps.ts
dumpRagDebug()                    → all new modules
buildGrounded()                   → unchanged (downstream)
buildQueries()                    → receives expandedConcepts
```

## Execution Flow Diagram

```
                           ┌─────────────────────┐
                           │  knowledge_map.json  │
                           └──────┬──────────────┘
                                  │
┌──────────────┐     ┌────────────▼──────────┐
│ time_pipeline│────▶│ buildInitialGrounded() │
│ .json        │     │ filter + structure     │
└──────┬───────┘     └────────────┬───────────┘
       │                          │
       │           ┌──────────────▼──────────┐
       │           │   extractVision()        │
       │           │   LLM + charts + context │
       │           └──────────────┬───────────┘
       │                          │
       │           ┌──────────────▼──────────┐
       │           │ detectKnowledgeGaps()    │
       │           │ 3 strategies             │
       │           └──────────────┬───────────┘
       │                          │
       │           ┌──────────────▼──────────┐
       │           │ generateQueriesFromGaps│
       │           │ weighted queries        │
       │           └──────────────┬───────────┘
       │                          │
       │           ┌──────────────▼──────────┐
       │           │   expandOntology()      │
       │           │ merge concept sets      │
       │           └──────────────┬───────────┘
       │                          │
       │           ┌──────────────▼──────────┐
       │           │   buildQueries()        │
       │           │   (existing)            │
       ▼           └──────────────┬───────────┘
  pipelineConcepts                │
                                  ▼
                          existing RAG pipeline
                          (retrieveRAG → buildGrounded → buildPrompt)
                                                   ▲
                                                   │
                                          visionContext injected