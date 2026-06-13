# Vision-First Time Agent Migration & Audit Summary

This document summarizes the migration of the **Quarterly Agent** and **Monthly Agent** to the **Vision-First** 3-lane retrieval architecture, the resolution of the `FAIR_VALUE_GAP` (FVG) retrieval dominance bug, and the recent prompt tuning updates to focus on timing/cycle context.

---

## 1. Core Architecture: Vision-First Migration

Both Quarterly and Monthly agents have been successfully migrated to the **3-Lane Retrieval Flow** modeled after the HTF-Macro-Agent:
*   **Lane 0 (Core Pipeline Concepts)**: Existing time-frame-based pipeline definitions.
*   **Lane 1 (Ontology Concepts)**: Structural concepts matched against the ontology knowledge registry based on vision findings.
*   **Lane 2 (Structured Vision Observations)**: Direct observations extracted from Monthly, Weekly, and Daily chart images, converted dynamically into semantic/lexical queries.

---

## 2. Root Cause & Solution: Ontology Scorer De-duplication

### The Issue: FVG Dominance Collapse
Prior to the fix, candidate chunks matching `FAIR_VALUE_GAP` (e.g., `chunk_215`, `chunk_1854`, `chunk_1091`, `chunk_214`) dominated all retrieval outputs. 
*   **Root Cause**: In [scorer.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/ontology/scorer.ts), the ontology bonus loop checked every generated query against the chunk's annotated concepts.
*   If multiple queries matched the same concept (e.g., "Monthly FVG", "FVG", "bullish FVG"), the chunk accumulated the ontology bonus (+0.15 * confidence) **multiple times** up to the 0.30 cap.
*   This artificially boosted FVG chunks to the cap regardless of actual relevance, resulting in retrieval collapse.

### The Fix: Recommendation A
A uniqueness set (`seenCanonicals`) was introduced to track matched canonical concepts:
```typescript
const seenCanonicals = new Set<string>();
for (const query of queries) {
  const queryCanonical = ontologyLoader.getCanonical(query);
  if (!queryCanonical) continue;

  if (seenCanonicals.has(queryCanonical)) continue;

  for (const concept of annotation.concepts) {
    if (concept.canonical === queryCanonical) {
      bonus += 0.15 * concept.confidence;
      matchedConcepts.push(concept.canonical);
      seenCanonicals.add(queryCanonical);
    }
  }
}
```
**Impact**: The bonus is now applied **exactly once** per canonical concept. RAG fusion scores are balanced, allowing other high-relevance structures (Order Blocks, Dealing Ranges) to survive reranking.

---

## 3. Prompt Tuning: Time & Cycle Focus Rebalancing

The user refactored the `visionPrompt` configurations for both agents to shift from raw price structures to cycle-focused temporal structures:

### Quarterly Agent Updates
Refactored [quarterly-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/quarterly-agent.ts) prompt:
*   **Timing Shifts**: Focus on transition dips/rallies at the open of the current quarter.
*   **Seasonality Phases**: Check M1, M2, M3 historical alignments.
*   **Quarterly Opening Range**: Define high/low range of the first trading week.
*   **Dealing Ranges & Premium/Discount**: Refined boundary conditions.
*   **HTF FVG**: Linked directly to Monthly FVG reactions.

### Monthly Agent Updates
Refactored [monthly-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/monthly-agent.ts) prompt:
*   **Turn-of-Month (TOM) / End-of-Month (EOM)**: Focus on the specific windows (last 3 to first 3 days, last week).
*   **Options Expiry**: Identify the 3rd Friday of the month options expiration week timing.
*   **Monthly Seasonality**: Observe historically bullish/bearish monthly expansions.
*   **Monthly Opening Range**: High/low range of the first trading day.
*   **Dealing Ranges & Weekly Order Blocks**: Retained as key price boundary references.

---

## 4. Verification & Audit Results

### Lane Contribution Metrics

| Metric | Quarterly Agent | Monthly Agent |
| :--- | :--- | :--- |
| **Lane 0 (Pipeline) Query Count** | 19 | 18 |
| **Lane 1 (Ontology) Query Count** | 2 | 2 |
| **Lane 2 (Vision) Query Count** | 11 | 9 |
| **Lane 2 Hit Rate** | **31.27%** | **32.44%** |

### Grounding Diversity Check
Post-fix analysis of `06_GROUNDED_META.json` shows successful concept diversification:

*   **Quarterly Agent**:
    *   `chunk_215`, `chunk_1854`, `chunk_214` (FVG)
    *   `chunk_1827` (TGIF FVG)
    *   `chunk_1539` (Order Block)
    *   `chunk_2055` (Dealing Range / Hierarchy)
    *   *Result*: Balanced mix of FVG, Order Blocks, and Dealing Ranges.
*   **Monthly Agent**:
    *   `chunk_1091`, `chunk_1048`, `chunk_1854`, `chunk_484` (FVG / Structure Shift)
    *   `chunk_3544` (Weekly Order Block / Rebalance)
    *   `chunk_2766` (Monthly Dealing Range / Order Block)
    *   *Result*: Diversified monthly structure context (no single concept dominance).

---
*Summary generated on: 2026-06-12*
