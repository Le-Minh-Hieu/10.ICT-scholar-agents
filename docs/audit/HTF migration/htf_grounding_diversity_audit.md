# HTF GROUNDING DIVERSITY AUDIT — POST-MIGRATION

**Auditor Role:** Senior Systems Auditor  
**Date:** 2026-06-12  
**Scope:** Grounding composition, diversity, and purity audit for the 4 HTF agents.  
**Mandate:** EVIDENCE ONLY.

---

## 1. CHUNK CLASSIFICATION AND METRICS

We classified every grounded chunk listed in each agent's `06_GROUNDED_META.json` file into its core conceptual domain (STRUCTURE, LIQUIDITY, PD_ARRAY, MACRO, OTHER):

### 1. HTF Macro Agent
*   **Chunks Grounded:** `chunk_3840`, `chunk_1815`, `chunk_4172`, `chunk_1869`, `chunk_215`, `chunk_1854`, `chunk_2275`, `chunk_4015`.
*   **Classifications:** 8 MACRO, 0 STRUCTURE, 0 LIQUIDITY, 0 PD_ARRAY, 0 OTHER.
*   **Metrics:**
    *   *Concept Diversity Score:* **Low** (1 unique domain).
    *   *Ownership Purity Score:* **100%** (8/8 chunks matching Macro domain).
    *   *Concentration Score:* **100%** (focused entirely on macro intermarket correlations).

### 2. HTF Structure Agent
*   **Chunks Grounded:** `chunk_2815` (OB effectiveness), `chunk_811` (MSS/Mitigation), `chunk_810` (MSS/Breaker), `chunk_2708` (Consolidation exits), `chunk_484` (FVG/MSS), `chunk_2797` (Daily chart sequence).
*   **Classifications:** 4 STRUCTURE (`chunk_811`, `chunk_810`, `chunk_2708`, `chunk_2797`), 2 PD_ARRAY (`chunk_2815`, `chunk_484`), 0 LIQUIDITY, 0 MACRO.
*   **Metrics:**
    *   *Concept Diversity Score:* **Medium** (2 unique domains).
    *   *Ownership Purity Score:* **66.7%** (4/6 chunks matching Structure domain).
    *   *Concentration Score:* **66.7%** (structure-focused with supporting PD array levels).

### 3. HTF Liquidity Agent
*   **Chunks Grounded:** `chunk_4206` (Liquidity pools), `chunk_1743` (Equal lows SSL), `chunk_4194` (Liquidity & Inefficiency), `chunk_2106` (Breaker/SSL), `chunk_3153` (Liquidity voids), `chunk_4018` (BSL sweeps).
*   **Classifications:** 6 LIQUIDITY, 0 STRUCTURE, 0 PD_ARRAY, 0 MACRO.
*   **Metrics:**
    *   *Concept Diversity Score:* **Low** (1 unique domain).
    *   *Ownership Purity Score:* **100%** (6/6 chunks matching Liquidity domain).
    *   *Concentration Score:* **100%** (liquidity-focused).

### 4. HTF PD Array Agent
*   **Chunks Grounded:** `chunk_2850` (PD Array Matrix), `chunk_1539` (OB Retest), `chunk_3661` (Gap overlaps), `chunk_2777` (PD Matrix basics), `chunk_2766` (Premium/Discount), `chunk_484` (FVG).
*   **Classifications:** 6 PD_ARRAY, 0 STRUCTURE, 0 LIQUIDITY, 0 MACRO.
*   **Metrics:**
    *   *Concept Diversity Score:* **Low** (1 unique domain).
    *   *Ownership Purity Score:* **100%** (6/6 chunks matching PD Array domain).
    *   *Concentration Score:* **100%** (PD-array-focused).

---

## 2. GROUNDING ANALYSIS QUESTIONS

1.  **Are all agents grounding the same chunks?**  
    *No.* The agents ground completely disjoint sets of chunks. The only exception is `chunk_484` (which explains FVG in relation to MSS and is shared between the Structure Agent and the PD Array Agent). This confirms that query expansion driven by specialized vision summaries successfully directed RAG to domain-specific knowledge.
2.  **Are FVG chunks dominating again?**  
    *No.* FVG chunks are only retrieved where they are relevant (e.g. `chunk_484` and `chunk_3661` in the PD Array Agent). In the baseline system, FVG chunks dominated almost all agent runs due to generic search terms.
3.  **Are vision facts actually changing retrieval?**  
    *Yes.* In the Structure Agent, for example, the vision observation of a Weekly Bearish Breaker Block at 1.1850 directly triggered the retrieval of `chunk_810` (specifically defining breaker and mitigation mechanics), which would not have been retrieved by static baseline keywords.
