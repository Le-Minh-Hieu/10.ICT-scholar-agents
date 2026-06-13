# Component Reuse Analysis

## Executive Summary

The refactor achieves **90-95% code reuse** by introducing one new module (~80 lines) and modifying one existing function (~15 lines). All core components (pipeline, ontology, retrieval, grounding) remain unchanged.

## Reuse Classification

### ✅ 100% Reusable (Unchanged)

These components require **zero modifications**:

#### Data Files
- `data/htf_pipeline.json` - HTF agent domain definitions
- `data/itf_pipeline.json` - ITF agent domain definitions
- `data/ltf_pipeline.json` - LTF agent domain definitions
- `data/time_pipeline.json` - Time agent domain definitions
- `data/knowledge_map.json` - Ontology and query templates (4000+ concepts)

**Why unchanged:** Domain boundaries and ontology remain the source of truth

#### Core Query System
- `core/3.query/pipeline-processor.ts` - Concept extraction logic
- `core/3.query/query-builder.ts` - Query building and ontology expansion
- `core/3.query/grounding.ts` - Chunk selection and formatting

**Why unchanged:** These operate on concept lists - don't care if list is full or prioritized

#### Retrieval Pipeline
- `core/3.query/retrieval/retrieval-core.ts` - BM25 + Vector search
- `core/3.query/retrieval/rerank.ts` - Cross-encoder reranking
- `core/3.query/retrieval/chunk-processor.ts` - Chunk processing

**Why unchanged:** Retrieval quality is already excellent - just needs better queries

#### Agent Contracts
- `shared/contracts/agent.types.ts` - Agent interfaces
- `shared/contracts/canonical.ts` - Output schemas
- `shared/contracts/htf/*` - HTF agent schemas
- `shared/contracts/itf/*` - ITF agent schemas
- `shared/contracts/ltf/*` - LTF agent schemas
- `shared/contracts/time/*` - Time agent schemas

**Why unchanged:** Agent inputs/outputs don't change

#### Orchestrators
- `core/3.query/orchestrators/htf-orchestrator.ts`
- `core/3.query/orchestrators/itf-orchestrator.ts`
- `core/3.query/orchestrators/ltf-orchestrator.ts`
- `core/3.query/orchestrators/time-orchestrator.ts`
- `core/3.query/orchestrators/master-orchestrator.ts`

**Why unchanged:** Orchestration logic operates on agent outputs

#### Individual Agents
- `core/3.query/agents/htf/*` - All HTF agents
- `core/3.query/agents/itf/*` - All ITF agents
- `core/3.query/agents/ltf/*` - All LTF agents
- `core/3.query/agents/time/*` - All Time agents

**Why unchanged:** Agents call base-agent.ts, which handles the change internally

#### LLM Infrastructure
- `shared/services/llm-utils.ts` - LLM calling utilities
- `shared/services/vision-utils.ts` - Vision model utilities

**Why unchanged:** Just used by new prioritizer - no modifications needed

---

### 🆕 New Components (Created)

#### `core/3.query/concept-prioritizer.ts` (~80 lines)

**Purpose:** Market-driven concept prioritization

**Interface:**
```typescript
export async function prioritizeConceptsByMarket(
  allConcepts: string[],
  imageParts: Part[],
  agentName: string,
  callId: string
): Promise<string[]>

function buildPrioritizationPrompt(
  concepts: string[],
  agentName: string
): string

function validatePrioritizedConcepts(
  prioritized: string[],
  original: string[]
): string[]
```

**Dependencies:**
- `shared/services/llm-utils.ts` - callLLM()
- `shared/log/logger.ts` - logging

**Code estimate:**
```typescript
// ~15 lines: buildPrioritizationPrompt
// ~30 lines: prioritizeConceptsByMarket (main logic)
// ~15 lines: validatePrioritizedConcepts
// ~10 lines: error handling and fallbacks
// ~10 lines: imports and exports
// Total: ~80 lines
```

**Risk level:** Low
- Single responsibility
- No side effects
- Easy to test
- Easy to disable (fallback to all concepts)

---

### 🔧 Modified Components (Small Changes)

#### `core/3.query/agents/shared/base-agent.ts`

**Current lines:** 619 total
**Modified section:** Lines 348-354 (7 lines)
**New code:** ~15 lines
**Change type:** Addition (insert new logic)

**Current code:**
```typescript
// Line 348-354
const pipeline = loadPipeline(config.pipelinePath);
const concepts = extractConcepts(pipeline, config.step);

const queries = buildQueries(
  concepts,
  knowledgeMap,
  relational,
  scenarios
);
```

**Modified code:**
```typescript
// Line 348-365 (add ~15 lines)
const pipeline = loadPipeline(config.pipelinePath);
let concepts = extractConcepts(pipeline, config.step);

// NEW: Market-driven concept prioritization
if (config.pushImages && config.usePrioritization !== false) {
  const parts: Part[] = [];
  config.pushImages(parts, input, callId);
  
  try {
    concepts = await prioritizeConceptsByMarket(
      concepts,
      parts,
      config.agentName,
      callId
    );
  } catch (error) {
    logger.warn(`Concept prioritization failed, using all concepts`, { error });
    // Fallback: use all concepts
  }
}

const queries = buildQueries(
  concepts,
  knowledgeMap,
  relational,
  scenarios
);
```

**Why this location:**
- After concept extraction (domain boundary established)
- Before query building (influences all downstream)
- Minimal surface area (only affects concept list)
- Easy to disable (skip if no images or flag is false)

**Risk level:** Very low
- Wrapped in try-catch (safe fallback)
- Conditional (only runs if images available)
- No breaking changes (backward compatible)
- Easy to A/B test (config flag)

#### `core/3.query/agents/shared/base-agent.ts` - Config Interface

**Current:**
```typescript
export interface AgentConfig<TInput, TOutput> {
  agentName: string;
  pipelinePath: string;
  step: string;
  pushImages?: (parts: Part[], input: TInput, callId: string) => void;
  // ... other fields
}
```

**Modified:**
```typescript
export interface AgentConfig<TInput, TOutput> {
  agentName: string;
  pipelinePath: string;
  step: string;
  pushImages?: (parts: Part[], input: TInput, callId: string) => void;
  usePrioritization?: boolean;  // NEW: opt-in flag (default: true)
  // ... other fields
}
```

**Impact:** Backward compatible (optional field with sensible default)

---

## Code Reuse Metrics

| Category | LOC Before | LOC After | New Code | Modified Code | Reuse % |
|----------|------------|-----------|----------|---------------|---------|
| **Data Files** | ~5,000 | ~5,000 | 0 | 0 | 100% |
| **Pipeline** | ~200 | ~200 | 0 | 0 | 100% |
| **Query Builder** | ~400 | ~400 | 0 | 0 | 100% |
| **Retrieval** | ~800 | ~800 | 0 | 0 | 100% |
| **Grounding** | ~300 | ~300 | 0 | 0 | 100% |
| **Agents** | ~2,000 | ~2,000 | 0 | 0 | 100% |
| **Orchestrators** | ~1,500 | ~1,500 | 0 | 0 | 100% |
| **Base Agent** | 619 | 634 | 0 | 15 | 97.6% |
| **Prioritizer** | 0 | 80 | 80 | 0 | N/A (new) |
| **Contracts** | ~1,000 | ~1,000 | 0 | 0 | 100% |
| **LLM Utils** | ~500 | ~500 | 0 | 0 | 100% |
| **TOTAL** | ~12,319 | ~12,414 | 80 | 15 | **99.2%** |

**Summary:**
- Total existing code: ~12,319 lines
- New code: 80 lines (0.6%)
- Modified code: 15 lines (0.1%)
- Unchanged code: 12,224 lines (99.2%)

---

## Component Dependency Map

### Current Dependencies (Unchanged)

```
base-agent.ts
    ├── pipeline-processor.ts (extractConcepts)
    ├── query-builder.ts (buildQueries)
    ├── retrieval-core.ts (retrieveRAG)
    ├── grounding.ts (buildGrounded)
    ├── llm-utils.ts (callLLM)
    └── vision-utils.ts (pushImages)
```

### New Dependencies (Added)

```
base-agent.ts
    ├── concept-prioritizer.ts (NEW)
    │   ├── llm-utils.ts (callLLM)
    │   └── logger.ts (logging)
    ├── pipeline-processor.ts (extractConcepts)
    ├── query-builder.ts (buildQueries)
    ├── retrieval-core.ts (retrieveRAG)
    ├── grounding.ts (buildGrounded)
    ├── llm-utils.ts (callLLM)
    └── vision-utils.ts (pushImages)
```

**Impact:** One new dependency (concept-prioritizer.ts), no circular dependencies

---

## Risk Assessment by Component

### Zero Risk (Unchanged)

| Component | Risk | Rationale |
|-----------|------|-----------|
| Pipeline files | None | No modifications |
| Knowledge map | None | No modifications |
| Query builder | None | Receives concept list (full or prioritized) |
| Retrieval | None | Operates on queries |
| Grounding | None | Operates on chunks |
| Orchestrators | None | Operate on agent outputs |

### Very Low Risk (New, Isolated)

| Component | Risk | Mitigation |
|-----------|------|------------|
| concept-prioritizer.ts | Very Low | - Single responsibility<br>- No side effects<br>- Easy to test<br>- Fallback to all concepts |

### Low Risk (Modified, Backward Compatible)

| Component | Risk | Mitigation |
|-----------|------|------------|
| base-agent.ts | Low | - Wrapped in try-catch<br>- Conditional execution<br>- Config flag for opt-in/out<br>- Fallback on error |

---

## Testing Strategy

### Unit Tests (New)

**File:** `core/3.query/concept-prioritizer.test.ts`

```typescript
describe('prioritizeConceptsByMarket', () => {
  test('returns subset of input concepts', async () => {
    const concepts = ['A', 'B', 'C', 'D', 'E']
    const result = await prioritizeConceptsByMarket(concepts, imageParts, 'test', 'id')
    
    expect(result.length).toBeLessThanOrEqual(concepts.length)
    expect(result.every(c => concepts.includes(c))).toBe(true)
  })
  
  test('handles LLM failure gracefully', async () => {
    // Mock LLM to throw error
    const result = await prioritizeConceptsByMarket(concepts, imageParts, 'test', 'id')
    
    // Should fallback to first 15 concepts
    expect(result).toEqual(concepts.slice(0, 15))
  })
  
  test('validates output against input concepts', async () => {
    // Mock LLM to return invalid concepts
    const result = await prioritizeConceptsByMarket(concepts, imageParts, 'test', 'id')
    
    // Should filter out invalid concepts
    expect(result.every(c => concepts.includes(c))).toBe(true)
  })
})
```

### Integration Tests (Modified)

**File:** `core/3.query/agents/shared/base-agent.test.ts`

```typescript
describe('runBaseAgent with prioritization', () => {
  test('uses all concepts when pushImages is undefined', async () => {
    const config = { ...baseConfig, pushImages: undefined }
    await runBaseAgent(config)
    
    // Should use all 37 concepts
    expect(extractConcepts).toHaveBeenCalled()
    expect(prioritizeConceptsByMarket).not.toHaveBeenCalled()
  })
  
  test('prioritizes concepts when pushImages exists', async () => {
    const config = { ...baseConfig, pushImages: mockPushImages }
    await runBaseAgent(config)
    
    // Should prioritize concepts
    expect(prioritizeConceptsByMarket).toHaveBeenCalled()
  })
  
  test('falls back to all concepts on prioritization error', async () => {
    // Mock prioritizer to throw error
    const config = { ...baseConfig, pushImages: mockPushImages }
    await runBaseAgent(config)
    
    // Should still work with all concepts
    expect(buildQueries).toHaveBeenCalledWith(
      expect.arrayContaining([...allConcepts]),
      expect.anything()
    )
  })
})
```

### End-to-End Tests (New)

**File:** `test/test-concept-prioritization.ts`

```typescript
describe('E2E: Concept Prioritization', () => {
  test('HTF Macro agent with expansion market', async () => {
    const input = { /* expansion market data */ }
    const result = await htfMacroAgent(input)
    
    // Check grounded knowledge contains expansion concepts
    expect(result._debug.groundedKnowledge).toContain('expansion')
    expect(result._debug.groundedKnowledge).toContain('algorithmic')
    expect(result._debug.prioritizedConcepts).toBeDefined()
  })
  
  test('HTF Structure agent with consolidation market', async () => {
    const input = { /* consolidation market data */ }
    const result = await htfStructureAgent(input)
    
    // Check grounded knowledge contains consolidation concepts
    expect(result._debug.groundedKnowledge).toContain('consolidation')
    expect(result._debug.prioritizedConcepts).toBeDefined()
  })
})
```

---

## Rollback Plan

### If Issues Arise

**Option 1: Disable via config flag**
```typescript
// In agent config
const config = {
  ...baseConfig,
  usePrioritization: false  // Disable prioritization
}
```

**Option 2: Remove prioritizer call**
```typescript
// In base-agent.ts, comment out prioritization block
/*
if (config.pushImages && config.usePrioritization !== false) {
  concepts = await prioritizeConceptsByMarket(...)
}
*/
```

**Option 3: Full rollback**
- Remove `concept-prioritizer.ts`
- Revert `base-agent.ts` to line 348-354 (7 lines)
- System returns to 100% original behavior

**Rollback time:** < 5 minutes (single file change or config flag)

---

## Performance Impact

### Additional Latency

**Concept prioritization:**
- 1 LLM call (vision + JSON output)
- Estimated: 2-4 seconds
- Parallelizable with other setup

**Offset by:**
- Fewer queries generated (50-80 → 30-50)
- Faster retrieval (fewer queries to process)
- Better reranking (more focused results)

**Net impact:** ~1-2 seconds additional latency (acceptable for quality improvement)

### Memory Impact

**New allocations:**
- Prioritization prompt: ~2KB
- Prioritized concept list: ~1KB
- Validation overhead: ~0.5KB

**Total:** ~3.5KB per agent call (negligible)

### Token Cost Impact

**Additional tokens:**
- Prioritization prompt: ~500 tokens
- Prioritization response: ~200 tokens
- Total per agent: ~700 tokens

**Cost (assuming $0.01/1K tokens):**
- ~$0.007 per agent call
- Offset by better final output (fewer retries)

---

## Migration Checklist

### Phase 1: Development
- [ ] Create `concept-prioritizer.ts`
- [ ] Add unit tests for prioritizer
- [ ] Modify `base-agent.ts` (15 lines)
- [ ] Add integration tests
- [ ] Add E2E tests

### Phase 2: Testing
- [ ] Test with HTF Macro agent (Time domain - lowest risk)
- [ ] Measure: knowledge depth, latency, concept selection
- [ ] Test with HTF Structure agent
- [ ] Test with ITF Setup agent
- [ ] Test with LTF Trigger agent

### Phase 3: Rollout
- [ ] Deploy to staging
- [ ] Enable for Time agents (opt-in)
- [ ] Monitor: logs, errors, quality
- [ ] Enable for HTF agents (opt-in)
- [ ] Enable for ITF agents (opt-in)
- [ ] Enable for LTF agents (opt-in)

### Phase 4: Stabilization
- [ ] Make prioritization default (usePrioritization: true)
- [ ] Document in system architecture
- [ ] Update agent development guide
- [ ] Remove opt-in flag (becomes standard behavior)

---

## Success Criteria

### Quantitative Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Chunks per agent | 5-10 | 15-25 | Count in grounded knowledge |
| Concept coverage | 100% | 30-40% | Prioritized vs total concepts |
| Query count | 50-80 | 30-50 | Generated queries |
| Latency increase | 0ms | <3000ms | Prioritization overhead |
| Error rate | Baseline | <1% | Prioritization failures |

### Qualitative Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Knowledge alignment | Static | Dynamic | Manual review of grounded knowledge |
| Domain focus | Shallow | Deep | Chunks per concept topic |
| Reasoning quality | Weak | Strong | Agent output analysis |

---

## Conclusion

The refactor achieves exceptional code reuse:

- **99.2% of existing code remains unchanged**
- **0.6% new code** (80 lines - concept prioritizer)
- **0.1% modified code** (15 lines - base-agent.ts)

**All core systems preserved:**
- ✅ Pipeline concepts (domain boundaries)
- ✅ Knowledge map (ontology)
- ✅ Query builder (expansion mechanism)
- ✅ Retrieval (BM25 + Vector + Rerank)
- ✅ Grounding (chunk selection)
- ✅ Agent contracts and schemas
- ✅ Orchestrators

**Single point of change:**
- Insert market-driven prioritization between concept extraction and query building
- Minimal surface area
- Easy to disable
- Fast rollback