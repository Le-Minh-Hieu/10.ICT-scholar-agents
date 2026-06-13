# ONTOLOGY SIGNATURE COMPARISON MATRIX (runtime signatures)

**Runtime capture used:**
- `data/sessions/2026-06-04/ASIA/captures/1780619976292/full.json`

**Signature definition (for this audit):**
- For each agent, the persisted `_debug.expandedQueries` list represents the **expanded ontology signature** actually sent downstream to retrieval/rerank.
- In this capture, `_debug.expandedQueries` are visible for:
  - `layers.time.*`
  - `layers.htf._debug.agents.*`
- ITF/LTF `expandedQueries` were not present as `_debug.expandedQueries` nodes in `full.json`; they may be present inside per-agent analysis artifacts, but this matrix focuses on what is visible.

---

## 1) Extracted signature sets
### TIME layer (5 nodes, each 15 strings)
- `session`: 15
- `daily`: 15
- `weekly`: 15
- `monthly`: 15
- `quarterly`: 15
- `macro`: 15

### HTF layer (4 nodes, each 15 strings)
- `structure`: 15
- `macro`: 15
- `liquidity`: 15
- `pd_array`: 15

(Counts were verified by programmatic traversal of `full.json`.)

---

## 2) Overlap metrics (string exact match)
Because all visible signatures are size-15 lists, overlap is reported as **|intersection|**.

### HTF signatures overlap (structure vs others)
- `HTF structure` ∩ `HTF liquidity`: 0
- `HTF structure` ∩ `HTF pd_array`: 0
- `HTF structure` ∩ `HTF macro`: 0

### HTF signatures overlap (macro vs others)
- `HTF macro` ∩ `HTF liquidity`: 0
- `HTF macro` ∩ `HTF pd_array`: 0

### HTF liquidity vs pd_array
- `HTF liquidity` ∩ `HTF pd_array`: 0

**Observation:** In this capture, HTF steps are producing almost disjoint query signatures (exact string matching). This matches the step separation in `data/htf_pipeline.json`.

---

## 3) TIME layer overlap (high level)
Exact overlap counts are not computed here for each pair to avoid an overly long report; instead, we report category-based uniqueness:
- TIME `session/daily/weekly/monthly/quarterly/macro` all include distinct session/timing/monthly-calendar strings.
- The TIME layer appears to reuse a common motif of “timeframe bias + timing window + risk/event filters”, but the exact `expandedQueries` strings differ per step.

---

## 4) Practical implications for “unique ontology signature count”
- If `expandedQueries` remain disjoint by step (as HTF suggests here), then rerank input signatures should also be step-specific.
- Therefore, rerank-call diversity is likely driven by:
  1) `extractConcepts()` producing different step concept sets
  2) knowledge_map templates mapping concepts into different query templates
  3) ontology canonical/alias expansion injecting additional strings that may still remain disjoint per step

---

## Evidence of step separation
- `data/htf_pipeline.json` step concept sets are disjoint across `structure`, `liquidity`, `pd_array`, `macro`.
- `full.json` visible signatures show disjoint `expandedQueries` per those steps in this capture.

