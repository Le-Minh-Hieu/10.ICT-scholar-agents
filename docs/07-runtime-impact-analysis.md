# 07 — Runtime Impact Analysis

Objective
---------
Measure the actual influence of input fields and prompts on final production decisions by tracing their path through capture → analysis → master → decision.

Scope & Data Sources
--------------------
- Primary folders: `capture/`, `analysis/`, `master/` (runtime traces, intermediate outputs, master outputs).
- Consumers: downstream decision systems and human review logs.

Trace Model
-----------
Field
↓
Intermediate Outputs (analysis/*)
↓
Master Output (master/*)
↓
Decision (final consumer)

Metrics (per-field)
-------------------
All metrics are computed over an observation window (e.g., last N runs or last T days).

1. Reach Rate
   - Definition: fraction of runs where the field is non-null and makes it into at least one intermediate output.
   - Formula: ReachRate = runs_with_field_in_intermediate / total_runs

2. Decision Influence
   - Definition: how often changes in the field cause a change in the final decision.
   - Compute by delta tracing: compare paired runs differing only in the field value (or use causal attribution / ablation):
   - Formula (approx): DecisionInfluence = runs_where_field_change_alters_decision / runs_with_field_present

3. Confidence Influence
   - Definition: average change in decision confidence attributable to the field.
   - Formula: ConfidenceInfluence = mean(confidence_with_field - confidence_without_field) over comparable runs

4. Execute Influence
   - Definition: extent to which the field triggers execution paths (e.g., enabling actions, API calls, workflows).
   - Metric: ExecuteInfluence = count_runs_where_field_enabled_action / runs_with_field_present

5. Direction Influence
   - Definition: sign and magnitude bias introduced by the field (push toward positive/negative outcomes).
   - Metric: DirectionInfluence = (positive_outcomes_with_field - negative_outcomes_with_field) / runs_with_field_present

6. Persistence Frequency
   - Definition: how often the field value persists from capture → master (not overwritten or dropped).
   - Formula: Persistence = runs_where_field_present_in_master / runs_with_field_in_capture

7. Consumer Count
   - Definition: number of downstream systems or rules that read/use the field from master outputs.
   - How to compute: static analysis of master consumers + runtime read logs.

Runtime Influence Table (A)
---------------------------
Produce a CSV/TSV or table with these columns for each field:

- FieldName
- ReachRate
- DecisionInfluence
- ConfidenceInfluence
- ExecuteInfluence
- DirectionInfluence
- PersistenceFrequency
- ConsumerCount
- OverallScore (weighted aggregate — see scoring)
- Notes / evidence links (trace IDs)

Scoring & Weights
-----------------
- Provide a configurable weight vector (example):
  - DecisionInfluence: 35%
  - ConfidenceInfluence: 20%
  - ExecuteInfluence: 15%
  - PersistenceFrequency: 10%
  - ConsumerCount: 10%
  - ReachRate: 10%
- OverallScore = weighted_sum(normalized_metric_values)

B. High Influence Fields
-------------------------
- Criteria: OverallScore above high threshold (e.g., top 10% or score > 0.7)
- For each field list: evidence (trace IDs), primary consumers, representative example runs, suggested monitoring alerts.

C. Low Influence Fields
------------------------
- Criteria: ReachRate > 0 but OverallScore low (e.g., bottom 25% of non-dead fields).
- Action: monitor for changing behavior; consider de-prioritization for optimization.

D. Dead Fields
----------------
- Definition: fields with negligible reach and no observed influence on decisions or confidence.
- Heuristics:
  - ReachRate < r_dead (e.g., 0.5%) AND
  - PersistenceFrequency < p_dead (e.g., 1%) AND
  - DecisionInfluence ≈ 0 AND
  - ConsumerCount == 0

E. Prompts Producing Dead Fields
--------------------------------
- Identify prompts or input templates that produce values for dead fields by scanning capture logs and prompt templates.
- Output: list of prompt IDs / templates → dead fields produced, with occurrence counts and sample prompts.

F. Candidate Removals
---------------------
- For fields classified as dead and verified across time windows, suggest removal candidates.
- Include risk notes: whether a field is preserved for auditing, backward compatibility, or legal reasons.

G. Candidate Deterministic Replacements
---------------------------------------
- For rarely-changing fields that have high variance but low semantic value, propose deterministic replacements (e.g., defaulting, hashing, canonicalization).
- Provide examples: replace free-text with enum mapping, normalize timestamps to ISO, collapse near-duplicate tokens.

Methodology / Query Recipes
---------------------------
- Example SQL-like pseudocode to compute Reach Rate:

  SELECT field,
         COUNT(*) FILTER(WHERE field IS NOT NULL AND in_intermediate = TRUE) / COUNT(*) AS reach_rate
  FROM runs
  GROUP BY field;

- Decision influence via paired-ablation (approx):

  - For each run R where field present, synthesize R' with field set to null/default;
  - Re-run (or replay) analysis to get decision D' and confidence C';
  - If D' != D then count as decision-influenced; accumulate confidence delta.

Practical Notes
---------------
- Use sampling / stratification for expensive replays.
- Where replays are impossible, use causal attribution models (Shapley, attribution or model-specific feature importances) computed on intermediate representations.
- Log trace IDs for all influencing examples to enable human review.

Next Steps / Runbook
--------------------
- Export the Runtime Influence Table from `analysis/` into `reports/runtime-influence.csv`.
- Run the ablation batch for top-N candidate fields to validate DecisionInfluence.
- Convene stakeholders for fields with high Operational Risk but low Transparency before removal.

Appendix — Example Output Snippets
---------------------------------
- Runtime Influence Table (columns): FieldName, ReachRate, DecisionInfluence, ConfidenceInfluence, ExecuteInfluence, DirectionInfluence, PersistenceFrequency, ConsumerCount, OverallScore, Notes

- Example decision for a dead field:
  - Field: `optional_comment`
  - ReachRate: 0.2%
  - PersistenceFrequency: 0%
  - ConsumerCount: 0
  - DecisionInfluence: 0
  - Suggested action: remove from capture prompts after 30-day hold.

---
Generated to help determine what actually matters in production. Use this file as the canonical template for measuring runtime field influence.
