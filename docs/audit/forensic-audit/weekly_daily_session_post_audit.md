# Post-Migration Audit Plan (Weekly, Daily, Session Agents)

This plan outlines the verification steps and criteria to be executed after the Vision-First migration of the Weekly, Daily, and Session agents. 

---

## Audit Checklist & Verification Steps

### 1. Lane Contribution Audit
* **Objective**: Verify that Lane 0 (base concepts), Lane 1 (vision ontology concepts), and Lane 2 (vision facts) are active and successfully merging.
* **Verification Actions**:
  * Run each test harness (`test-weekly-vision.ts`, `test-daily-vision.ts`, `test-session-vision.ts`).
  * Verify that a new runtime folder is created under `data/rag-debug/<capture-id>/`.
  * Open `00_MERGED_QUERIES.json` for each agent and confirm the presence and query counts for:
    * `base_query_count` (Lane 0)
    * `vision_concept_query_count` (Lane 1)
    * `vision_observation_query_count` (Lane 2)
  * Verify that `04_ATTRIBUTION.json` is successfully generated and contains metrics for all three lanes.

### 2. Vocabulary Coverage Audit
* **Objective**: Measure the increase in exact and semantic corpus coverage using Lane 2 queries.
* **Verification Actions**:
  * Compare the semantic match rate of vision-extracted facts against the prior baseline (0% exact hits for Weekly Agent).
  * Confirm that factual queries like `weekly opening price`, `BMS`, and `NDOG` successfully map to annotated chunks in `data/ontology/annotations/` without vocabulary mismatch errors.

### 3. Retrieval Diversity Audit
* **Objective**: Ensure that retrieval is no longer completely dominated by a single concept group.
* **Verification Actions**:
  * Open `05_RERANK_POST.json` for each agent.
  * Extract the top 20 candidate chunks.
  * Map each chunk to its concept category (FVG, Order Block, Dealing Range, Sessions, Time Windows, Opening Range, Other).
  * Check that no single category exceeds **50%** of the candidate distribution.

### 4. Grounding Diversity Audit
* **Objective**: Assess the quality of the grounded knowledge injected into the prompt.
* **Verification Actions**:
  * Open `06_GROUNDED_META.json` for each agent.
  * Check that the Grounding Diversity Score is $\ge \mathbf{0.60}$ and the Grounding Concentration Score is $\le \mathbf{0.50}$.
  * Review `06_GROUNDED_WITH_VISION.txt` to confirm that the vision summary is successfully prepended as primary context:
    ```markdown
    ## LIVE MARKET OBSERVATIONS (VISION PRIMARY)
    ...
    ## HISTORICAL REFERENCE (RAG SECONDARY)
    ...
    ```

### 5. Input / Output Alignment Audit
* **Objective**: Re-evaluate the semantic alignment between inputs and outputs.
* **Verification Actions**:
  * Recalculate the **Alignment Score** using the new Vision facts as active inputs.
  * Verify that the Alignment Score has increased by at least **50%** across all three migrated agents.
