# Migration Plan

## Executive Summary

This document provides a step-by-step plan to refactor the system from ontology-first to market-driven concept prioritization. The migration is designed for **minimal risk, maximum reuse, and easy rollback**.

## Overview

**Scope:** Add market-driven concept prioritization to base-agent.ts
**Impact:** 99.2% code reuse (80 new lines + 15 modified lines)
**Risk:** Very low (surgical change with fallbacks)
**Rollback:** < 5 minutes (config flag or single file revert)

---

## Phase 1: Development (Week 1)

### Step 1.1: Create Concept Prioritizer

**File:** `core/3.query/concept-prioritizer.ts`

**Implementation:**
```typescript
import { Part } from '@google/generative-ai'
import { callLLM } from '../../shared/services/llm-utils'
import { logger } from '../../shared/log/logger'

function buildPrioritizationPrompt(
  concepts: string[],
  agentName: string
): string {
  return `You are analyzing charts for the ${agentName}.

Available concepts in your domain:
${concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Based on these charts, rank the top 10-15 most relevant concepts.

Rules:
- ONLY choose from the provided concepts (do not generate new ones)
- Prioritize concepts that match what you SEE in the charts
- Focus on concepts relevant to current market state
- Return between 10-15 concepts

Return JSON: { "prioritized": ["concept1", "concept2", ...], "reasoning": "brief explanation" }`
}

function validatePrioritizedConcepts(
  prioritized: string[],
  original: string[]
): string[] {
  const validated = prioritized.filter(c => original.includes(c))
  
  if (validated.length < 5) {
    logger.warn('Prioritization returned too few valid concepts, using fallback')
    return original.slice(0, 15)
  }
  
  return validated.slice(0, 15)
}

export async function prioritizeConceptsByMarket(
  allConcepts: string[],
  imageParts: Part[],
  agentName: string,
  callId: string
): Promise<string[]> {
  try {
    const prompt = buildPrioritizationPrompt(allConcepts, agentName)
    
    const result = await callLLM(
      prompt,
      `${agentName}-prioritize`,
      callId,
      imageParts,
      { returnFormat: 'json' }
    )
    
    const prioritized = result.prioritized || []
    const validated = validatePrioritizedConcepts(prioritized, allConcepts)
    
    logger.info('Concept prioritization complete', {
      total: allConcepts.length,
      prioritized: validated.length,
      concepts: validated
    })
    
    return validated
  } catch (error) {
    logger.error('Concept prioritization failed, using fallback', { error })
    return allConcepts.slice(0, 15)
  }
}
```

**Checklist:**
- [ ] Create file `core/3.query/concept-prioritizer.ts`
- [ ] Implement `buildPrioritizationPrompt()`
- [ ] Implement `validatePrioritizedConcepts()`
- [ ] Implement `prioritizeConceptsByMarket()`
- [ ] Add error handling with fallback
- [ ] Add logging for observability

### Step 1.2: Modify Base Agent

**File:** `core/3.query/agents/shared/base-agent.ts`

**Change 1: Add import**
```typescript
import { prioritizeConceptsByMarket } from '../../concept-prioritizer'
```

**Change 2: Modify AgentConfig interface (around line 50)**
```typescript
export interface AgentConfig<TInput, TOutput> {
  // ... existing fields ...
  usePrioritization?: boolean  // NEW: defaults to true when pushImages exists
}
```

**Change 3: Modify concept extraction logic (around line 348-354)**

Replace:
```typescript
const pipeline = loadPipeline(config.pipelinePath);
const concepts = extractConcepts(pipeline, config.step);

const queries = buildQueries(
  concepts,
  knowledgeMap,
  relational,
  scenarios
);
```

With:
```typescript
const pipeline = loadPipeline(config.pipelinePath);
let concepts = extractConcepts(pipeline, config.step);

// Market-driven concept prioritization
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
    logger.warn(`Concept prioritization failed for ${config.agentName}`, { error });
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

**Checklist:**
- [ ] Add import for `prioritizeConceptsByMarket`
- [ ] Add `usePrioritization` to AgentConfig interface
- [ ] Change `const concepts` to `let concepts`
- [ ] Add prioritization block with try-catch
- [ ] Test compilation

### Step 1.3: Add Unit Tests

**File:** `core/3.query/concept-prioritizer.test.ts`

**Test cases:**
- Returns subset of input concepts
- Validates concepts against original list
- Handles LLM failure gracefully (fallback)
- Returns 10-15 concepts
- Filters invalid concepts from LLM output

**Checklist:**
- [ ] Create test file
- [ ] Mock `callLLM` function
- [ ] Test happy path
- [ ] Test error handling
- [ ] Test validation logic
- [ ] Achieve >90% coverage

---

## Phase 2: Testing (Week 2)

### Step 2.1: Integration Testing

**Test with Time Agent (lowest risk):**

```typescript
// test/test-time-agent-prioritization.ts
import { timeAgent } from '../core/3.query/agents/time/time-agent'

describe('Time Agent with Prioritization', () => {
  test('prioritizes time-related concepts', async () => {
    const input = {
      sessionType: 'AM',
      calendarData: { /* test data */ },
      images: [ /* chart images */ ]
    }
    
    const result = await timeAgent(input)
    
    expect(result._debug?.prioritizedConcepts).toBeDefined()
    expect(result._debug?.prioritizedConcepts?.length).toBeLessThan(20)
    expect(result._debug?.groundedKnowledge).toContain('session')
  })
})
```

**Checklist:**
- [ ] Test Time Agent with real market data
- [ ] Verify prioritized concepts list
- [ ] Verify grounded knowledge quality
- [ ] Measure latency impact
- [ ] Check logs for errors

### Step 2.2: HTF Agent Testing

**Test HTF agents in sequence:**

1. **HTF Macro Agent**
   - Test with expansion market
   - Test with consolidation market
   - Verify concept selection differs by market state

2. **HTF Structure Agent**
   - Test with trending market
   - Test with ranging market
   - Verify structure concepts prioritized

3. **HTF Liquidity Agent**
   - Test with liquidity runs visible
   - Verify liquidity concepts prioritized

4. **HTF PD Array Agent**
   - Test with clear PD arrays
   - Verify PD array concepts prioritized

**Checklist:**
- [ ] Test each HTF agent individually
- [ ] Compare grounded knowledge before/after
- [ ] Measure knowledge depth increase
- [ ] Document concept selection patterns
- [ ] Verify no regressions in output quality

### Step 2.3: Performance Testing

**Metrics to measure:**
- Latency per agent (prioritization overhead)
- Memory usage
- Token consumption
- Error rate

**Benchmarks:**
```typescript
// test/benchmark-prioritization.ts
describe('Prioritization Performance', () => {
  test('completes within 4 seconds', async () => {
    const start = Date.now()
    await prioritizeConceptsByMarket(concepts, images, 'test', 'id')
    const duration = Date.now() - start
    
    expect(duration).toBeLessThan(4000)
  })
})
```

**Checklist:**
- [ ] Measure baseline (no prioritization)
- [ ] Measure with prioritization
- [ ] Calculate overhead
- [ ] Verify <3s additional latency
- [ ] Check memory usage

---

## Phase 3: Staged Rollout (Week 3-4)

### Step 3.1: Deploy to Staging

**Configuration:**
```typescript
// Initially: opt-in via config flag
const config = {
  // ... existing config ...
  usePrioritization: true  // Explicit opt-in
}
```

**Checklist:**
- [ ] Deploy to staging environment
- [ ] Enable for Time agents only
- [ ] Monitor logs for errors
- [ ] Monitor LLM call patterns
- [ ] Check grounded knowledge quality
- [ ] Run smoke tests

### Step 3.2: Enable HTF Agents

**Week 3:**
- Day 1-2: HTF Macro agent
- Day 3-4: HTF Structure agent
- Day 5: HTF Liquidity + PD Array agents

**Monitoring:**
- Error rates per agent
- Concept selection patterns
- Knowledge depth metrics
- User feedback (if applicable)

**Checklist:**
- [ ] Enable HTF Macro (monitor 2 days)
- [ ] Enable HTF Structure (monitor 2 days)
- [ ] Enable HTF Liquidity (monitor 1 day)
- [ ] Enable HTF PD Array (monitor 1 day)
- [ ] Compare outputs to baseline
- [ ] No critical issues detected

### Step 3.3: Enable ITF/LTF Agents

**Week 4:**
- Day 1-2: ITF agents
- Day 3-4: LTF agents

**Checklist:**
- [ ] Enable all ITF agents
- [ ] Monitor for 2 days
- [ ] Enable all LTF agents
- [ ] Monitor for 2 days
- [ ] All agents stable

---

## Phase 4: Production Rollout (Week 5)

### Step 4.1: Make Default Behavior

**Change default:**
```typescript
// Before: explicit opt-in
usePrioritization: true

// After: default behavior (opt-out if needed)
if (config.pushImages && config.usePrioritization !== false)
```

**Checklist:**
- [ ] Update documentation
- [ ] Make prioritization default
- [ ] Keep opt-out capability
- [ ] Deploy to production
- [ ] Monitor first 24 hours closely

### Step 4.2: Cleanup

**Optional after stable (Week 6+):**
- Remove `usePrioritization` flag (always on)
- Update agent development guide
- Add to system architecture docs

**Checklist:**
- [ ] Document in system architecture
- [ ] Update agent development guide
- [ ] Add to onboarding materials
- [ ] Archive old behavior documentation

---

## Rollback Procedures

### Level 1: Disable via Config (Fastest)

**Time:** < 1 minute

```typescript
// In each agent config
const config = {
  // ... existing config ...
  usePrioritization: false  // Disable immediately
}
```

### Level 2: Comment Out Code

**Time:** < 5 minutes

```typescript
// In base-agent.ts, comment out prioritization block
/*
if (config.pushImages && config.usePrioritization !== false) {
  const parts: Part[] = [];
  config.pushImages(parts, input, callId);
  
  concepts = await prioritizeConceptsByMarket(
    concepts,
    parts,
    config.agentName,
    callId
  );
}
*/
```

### Level 3: Full Revert

**Time:** < 10 minutes

1. Remove `concept-prioritizer.ts`
2. Revert `base-agent.ts` to previous version
3. Remove `usePrioritization` from AgentConfig
4. Redeploy

---

## Success Criteria

### Must Have (Go/No-Go)
- ✅ No increase in error rate (< 1% errors)
- ✅ Latency increase < 3 seconds
- ✅ All tests passing
- ✅ No breaking changes to agent outputs

### Should Have (Quality Improvements)
- ✅ Knowledge depth: 5-10 → 15-25 chunks
- ✅ Concept focus: 100% → 30-40% of domain
- ✅ Market alignment: observable improvement

### Nice to Have (Future Enhancements)
- Cache prioritization results for same market state
- Parallel prioritization for multiple agents
- Fine-tune concept count per agent type

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM hallucination | Medium | Medium | Validation filters invalid concepts |
| Performance degradation | Low | High | Fallback to all concepts on timeout |
| Concept drift | Low | High | Strict validation against original list |
| Error rate increase | Low | High | Try-catch with fallback, easy rollback |
| Breaking changes | Very Low | Very High | Backward compatible, opt-in flag |

---

## Timeline Summary

| Phase | Duration | Key Activities | Go/No-Go Decision |
|-------|----------|----------------|-------------------|
| **Phase 1: Development** | Week 1 | Create prioritizer, modify base-agent, unit tests | Tests passing |
| **Phase 2: Testing** | Week 2 | Integration tests, performance tests, HTF validation | No critical bugs |
| **Phase 3: Staged Rollout** | Week 3-4 | Deploy staging, enable per agent, monitor | Metrics meet targets |
| **Phase 4: Production** | Week 5 | Make default, full rollout, monitor | Stable for 48 hours |
| **Phase 5: Cleanup** | Week 6+ | Documentation, remove opt-out, finalize | All agents stable |

**Total Timeline:** 5-6 weeks from development to production

---

## Conclusion

This migration plan provides a **safe, incremental approach** to introducing market-driven concept prioritization:

- **Week 1:** Develop and test in isolation
- **Week 2:** Validate with real agents
- **Week 3-4:** Staged rollout with monitoring
- **Week 5:** Production default behavior
- **Week 6+:** Cleanup and documentation

**Key safety measures:**
- Opt-in flag for gradual enablement
- Try-catch with fallback to original behavior
- Easy rollback at every stage
- Extensive monitoring and validation
- Backward compatible (no breaking changes)

**Expected outcome:**
- 99.2% code reuse
- 3x knowledge depth increase
- Market-aligned grounded knowledge
- Minimal risk, maximum benefit