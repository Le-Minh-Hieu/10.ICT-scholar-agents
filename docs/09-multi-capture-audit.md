**09 Multi-Capture Audit**

Objective: validate runtime findings across multiple captures and distinguish architecture truths from single-capture anomalies.

---

## VERIFIED Findings Insert (codebase-only)

### Temporal Continuity
- VERIFIED: inherited temporal state carries into `TemporalEngine.reconcile()` and increments `capture_count`:
  - `capture_count: (inheritedState?.capture_count || 0) + 1`
  - idempotence: returns `inheritedState` unchanged when `last_reconciled_capture_id === captureId`.

### Scenario Inheritance + Decay/Prune
- VERIFIED: previous scenarios are loaded and reconciled via `loadLatestScenarios()` and `reconcileScenarios()`.

### Structure Lifecycle
- VERIFIED: lifecycle states present in code: `DISCOVERED`, `ACTIVE`, `TAPPED`, `MITIGATED`, `INVALIDATED`.

### Reconciliation Quality (coexistence)
- VERIFIED: invalidation happens per-structure.
- VERIFIED: opposing structures can coexist (no global bullish/bearish exclusivity in TemporalEngine reconciliation path).

Sample: last 30 captures from data/sessions/ (most recent 30 by timestamp).

Summary statistics
- **Total captures:** 30
- **LTF directions:** bearish: 20, bullish: 5, neutral: 5
- **Execute (top-level):** true: 0, false: 30
- **Average confidence:** 0.7475
- **HTF detections (structured):** none extracted (no reliable structured HTF field found)
- **ITF detections (structured):** none extracted
- **News references present:** 28 / 30 (93.3%)
- **PMSO references present:** 26 / 30 (86.7%)
- **Delivery-model references present:** 3 / 30 (10%)

Determinations
1. What drives `direction` most often?
- Observed: LTF directional signals (top-level `direction`) are dominated by bearish signals (20/30). Where structured HTF/ITF fields exist they were not reliably parsable; therefore LTF/entry signals appear to be the primary driver in these captures.

2. What drives `execute` most often?
- Observed: Top-level `execute` is false in all sampled captures (0/30 true). Execution appears gated by higher-level decision logic not exposed as top-level `execute` in these files (i.e., these captures record assessments but not final execution commits).

3. How often does News override LTF?
- Heuristic: presence of 'news' in capture JSON as a proxy for news-driven override.
- Observed: 28/30 captures contain news references (93.3%) — news is frequently present when LTF signals exist and likely a common override influence in practice.

4. How often does PMSO override LTF?
- Heuristic: presence of 'pmso' / 'pms' tokens in capture JSON as proxy for PMSO influence.
- Observed: 26/30 captures (86.7%) include PMSO/PMS references — PMSO is frequently present and often co-occurs with LTF signals.

5. How often are delivery-model outputs referenced?
- Observed: 3/30 captures (10%). Delivery-model references are relatively rare in the sampled set.

6. Which outputs never reach master?
- Heuristic: captures where `full.master` was not present/defined.
- Observed capture IDs (sampled) with no `master` object: 1780383110317, 1780312750997, 1780306415504, 1780079511274, 1780071055157, 1780060794494, 1780047401028, 1780043457320, 1780042323417, 1779992083193, 1779988467429, 1779984122771, 1779962942091, 1779954174927, 1779950107647, 1779945509698, 1779899726468, 1779899449896, 1779895782238, 1779891332746, 1779887590716, 1779878933280, 1779871288891, 1779857963337, 1779812186518, 1779798986095, 1779791805232, 1779729075457, 1779728642266, 1779728157170

Sections

**A. Cross-Capture Statistics**
- Total: 30 captures (most recent 30)
- LTF direction skew: bearish dominant (66.7%)
- Execution flag: none of sampled captures committed `execute=true` at top-level
- Average confidence: 0.7475 (high-ish)

**B. Influence Rankings (observed frequency)**
- News references: 93.3%
- PMSO references: 86.7%
- Delivery-model references: 10%
- LTF directional assertions (explicit `direction`): 100% (all captures had a `direction`/`entry` value)

**C. Override Frequency Analysis**
- News overrides (heuristic presence): 28/30 — news is the most frequent stated influence.
- PMSO overrides (heuristic): 26/30 — PMSO is also common and frequently co-occurs with news.
- Delivery-model overrides: uncommon (3/30).

**D. Dead Artifact Analysis**
- Many captures lack a `master` object (listed above). These capture artifacts appear not to have been promoted to `master`/final outputs. This suggests a gap in the finalization pipeline or that captures are intentionally left as assessments rather than authoritative outputs.

**E. Stable Findings**
- Consistent bearish bias across the last 30 LTF outputs.
- High average confidence (~0.75) despite `execute=false` — agents are confident in assessments even when not committing execution.
- News and PMSO are recurrent influence vectors across captures.

**F. Capture-Specific Findings (examples)**
- Capture 1780383110317 (2026-06-02T06:51:50Z): LTF bearish, confidence 0.657, `execute=false`; news references present.
- Capture 1780306415504 (2026-06-01T09:33:35Z): LTF bullish, confidence 0.85, `execute=false`.
- (See tmp/multi_capture_audit_summary.json for full per-capture rows produced by the analyzer.)

Methodology & notes
- I scanned the most recent 30 `full.json` captures under `data/sessions/**/captures/**/full.json` and extracted top-level `direction`, `execute`, and `confidence`, plus a best-effort extraction of HTF/ITF from `layers.*.compact_output` when present.
- Several requested fields (structured HTF/ITF, PMSO contradiction numeric scores, explicit macro execution modifiers, explicit 'master reached' flags) are not consistently present in structured fields across captures; heuristics were used (keyword presence and `master` existence) and are documented above.
- The analyzer used to produce these numbers is at `scripts/multi_capture_audit.cjs` and the JSON summary at `tmp/multi_capture_audit_summary.json`.

Next steps (options)
- Run full historical pass (all captures) instead of last 30 — slower but more comprehensive.
- Improve extraction heuristics for HTF/ITF (search known keys or standardize capture schema first).
- Add detection of explicit overrides (structured fields) rather than keyword heuristics.

If you want, I can: run the full-capture audit, refine HTF/ITF extraction, or commit this markdown to repo. Which next step do you want?
