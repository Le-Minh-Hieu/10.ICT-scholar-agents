**05 — Data Lineage (Field-level)**

Objective: trace how the final MasterOutput `decision` fields are produced, validated, transformed, persisted and consumed.

---

## VERIFIED Findings Insert (codebase-only)

### Temporal continuity inputs → TemporalEngine
- VERIFIED: `hydration_context.inherited_temporal_state` is forwarded into `TemporalEngine.reconcile()` by the Master orchestrator.

### TemporalEngine update rules
- VERIFIED: `capture_count` is incremented from inherited state (`(inheritedState?.capture_count || 0) + 1`) and idempotence returns `inheritedState` when `last_reconciled_capture_id === captureId`.

### Lifecycle states exposed by code
- VERIFIED: `TemporalEngine` uses `DISCOVERED`, `ACTIVE`, `TAPPED`, `MITIGATED`, `INVALIDATED` statuses.

### Execution-layer robustness (schema/null safety)
- VERIFIED: price validation runs only when `currentPrice` is provided and `price_bounds` exists (`if (currentPrice && updatedStructure.price_bounds)`).
- VERIFIED: `newsModifier` fields are accessed defensively via optional chaining (e.g., `newsModifier?.uncertainty_pressure`).

Scope: fields analyzed — `decision.execute`, `decision.direction`, `decision.confidence`, `decision.entry_zone`, `decision.stop_loss`, `decision.take_profit`.

**Summary**
- **Producer (ultimate):** Master Orchestrator (LLM-backed `generateMasterDecision`) with hydration/fallback logic in `core/3.query/orchestrators/master-orchestrator.ts` and normalization helpers in `core/4.output/normalize-output.ts`.
- **Upstream primary producers:** LTF orchestrator (LTF output: `execute`, `direction`, `entry`, `entry_price`, `stop_loss`, `take_profit`, `confidence`), ITF/HTF orchestrators (bias & confidence), PMSO reconciler (market state influencing defaults/modifiers), news modifier (uncertainty/volatility modifiers).
- **Persistence:** persisted via `shared/services/storage-service.ts` (persistAnalysisOutput / saveCaptureArtifact) into capture `analysis/master/*.json` (e.g. `master-orchestrator.json`).
- **Consumers:** response formatting ([core/4.output/response-formatter.ts](core/4.output/response-formatter.ts)), capture artifacts, dashboards, timeline updates, downstream evaluation/test harnesses under `test/`.

**A. Field Lineage Table**
- `decision.execute`:
  - Producer: Master Orchestrator (LLM output then boolean gating).
  - Immediate inputs: LLM `decision.execute`, `ltf.execute`, `itf.entry_bias` / `itf.setup_type`, news modifiers (`volatilityPressure`).
  - Upstream sources: LTF orchestrator outputs; ITF/HTF bias & confidence; PMSO (market_context) and news artifacts.
  - Transformations: normalization hydration/fallback in `normalizeMasterOutput` (master-orchestrator), `normalizeConfidence`/`normalizeDirection` used elsewhere; gating `execute = normalizedOutput.decision.execute && volatilityPressure < 0.8`.
  - Validation: `LTFOrchestratorOutputSchema.superRefine` (requires stop/TP when `execute` true), `MasterOutputSchema` parse at end of `normalizeMasterOutput`.
  - Persistence points: `StorageService.persistAnalysisOutput('master', 'master-orchestrator', finalOutput)` -> `analysis/master/master-orchestrator.json`.
  - Consumers: response layer, persisted captures, timeline/updater (`StorageService.updateTimeline`).

- `decision.direction`:
  - Producer: Master LLM; fallback hydration from LTF -> normalized via `normalizeDirection`.
  - Immediate inputs: LLM `decision.direction`, `ltf.direction`, `itf.itf_bias`, `htf.htf_bias`.
  - Upstream sources: LTF/ITF/HTF orchestrator outputs; PMSO market bias.
  - Transformations: `normalizeDirection` (core/4.output/normalize-output.ts), hydration from PMSO in `normalizeMasterOutput`.
  - Validation: `BiasEnum` in `MasterOutputSchema` and Zod parse.
  - Persistence: same as above.
  - Consumers: response formatting, scoring/eval consumers.

- `decision.confidence`:
  - Producer: Master LLM (primary) with fallback merging from LTF/ITF/HTF; final adjustment by news modifiers.
  - Immediate inputs: LLM `decision.confidence`, `ltf.confidence`, `itf.confidence`, `htf.confidence`, `newsModifier.uncertainty_pressure`.
  - Upstream sources: per-layer orchestrator confidences; PMSO-derived confidences.
  - Transformations: `normalizeConfidence`, scalar multiplication by `(1 - uncertaintyPressure * 0.3)` and clamp to [0,1].
  - Validation: `ConfidenceSchema` in `shared/contracts/canonical.ts` (0..1) and Zod parsing.
  - Persistence: `analysis/master/*.json`.
  - Consumers: risk sizing modules, timeline, evaluation tests.

- `decision.entry_zone`:
  - Producer: Master LLM; fallback to `ltf.entry` when missing.
  - Immediate inputs: LLM `decision.entry_zone`, `ltf.entry`.
  - Upstream sources: LTF orchestrator `entry` / `entry_price` context.
  - Transformations: hydration in `normalizeMasterOutput` (if default or missing, restore from LTF).
  - Validation: `MasterOutputSchema` (string) and LTF superRefine ensures `entry_price` present when `execute` true.
  - Persistence: master artifact; may be persisted into capture `input`/`analysis` artifacts.
  - Consumers: execution systems, reporting.

- `decision.stop_loss` and `decision.take_profit`:
  - Producer: Primarily produced by LTF orchestrator (LTF output provides numeric stop_loss/take_profit), optionally returned by Master LLM if it synthesizes pricing.
  - Immediate inputs: LTF `stop_loss`, `take_profit`; LLM fields if present.
  - Upstream sources: lower-timeframe agent outputs and retrieved price anchors.
  - Transformations: hydration (copied from `ltf` when missing), type normalization if strings -> numeric via `normalizeConfidence`-style helpers where applicable; schema expects optional strings in Master schema but LTF uses numbers (note: conversion/harmonization happens during normalization/hydration).
  - Validation: LTF schema enforces numeric presence when `execute` true; MasterOutputSchema accepts optional string for `stop_loss` but LTF persisted values are numeric -> master normalization ensures consistent types before final parse.
  - Persistence: persisted in master artifact and LTF artifacts (`analysis/ltf/*.json`).
  - Consumers: trade execution, simulations, backtests, reporting dashboards.

**B. End-to-End Field Graph (textual)**
HTF/ITF/LTF -> PMSO reconcilers & ScenarioEngine -> Master Orchestrator prompt (buildPrompt) -> LLM generateMasterDecision -> normalizeMasterOutput (hydration + fallback from LTF/ITF/HTF + PMSO/news modifiers) -> final gates (volatility/uncertainty) -> StorageService.persistAnalysisOutput -> response-formatter / consumers

**C. Bias Generation Graph**
HTF.bias (primary) -> HTF.confidence -> PMSO.market_context.htf_bias -> memory.theses -> Master prompt
ITF.itf_bias -> Master prompt
LTF.direction -> fallback into Master `decision.direction`
LLM master output synthesizes final `decision.direction` -> `normalizeDirection` -> MasterOutput

**D. Confidence Generation Graph**
LTF.confidence, ITF.confidence, HTF.confidence -> used as fallback seeds in `normalizeMasterOutput` -> LLM master `decision.confidence` is primary -> adjusted by newsModifier.uncertainty_pressure (multiplied by (1 - uncertaintyPressure*0.3)) -> clamped to [0,1] -> validated by `ConfidenceSchema` -> persisted

**E. Execution Decision Graph**
LTF.execute (trigger) + ITF setup/entry gates + Master LLM decision.execute -> master hydration preserves LTF.execute into decision if LLM blank -> final gate: `execute = normalizedOutput.decision.execute && volatilityPressure < 0.8` -> if trading window inactive then forced false -> persisted

**F. Dead Fields Analysis**
- Fields present in `MasterOutputSchema` but rarely set or consumed (candidate dead fields):
  - `vision.analysis` — optional, rarely populated in code paths.
  - `decision.target` — optional and seldom set by LLM.
  - `_confluence` / some `_debug` fields — internal debug scaffolding only.
Recommendation: audit usages of these keys across the codebase and tests to confirm removals or document the rare consumers.

**G. Fields With No Consumers (known)**
- `MasterOutput.layers.time.timing_bias` — set during hydration, not widely consumed except telemetry.
- `decision.target` — no known consumers; likely safe to deprioritize.

**H. Fields That Reach decision.json / persisted master artifact**
- Final persisted artifact path is produced by `shared/services/storage-service.ts` using the current capture path. The orchestrator writes the final wrapper via `persistAnalysisOutput('master', 'master-orchestrator', finalOutput)` which ends up in the capture at `.../analysis/master/master-orchestrator.json` (see [shared/services/storage-service.ts](shared/services/storage-service.ts)).
- All final `decision.*` fields are present in that persisted object (or omitted if optional). LTF also persists its artifact under `analysis/ltf/*.json` containing the upstream `stop_loss`/`take_profit` numeric values.

**Notes & Observations**
- Master decision is LLM-first with deterministic hydration/fallback from upstream orchestrators — meaning the LLM can override upstream values but missing LLM fields are restored from LTF/ITF/HTF.
- News/PMSO modifiers alter two key runtime behaviors: they (1) tune `decision.confidence` downward based on `uncertainty_pressure`, and (2) block `decision.execute` when `volatilityPressure >= 0.8` (hard gate). These are applied after normalization.
- Validation happens at multiple layers: (a) LTF `superRefine` ensures critical numeric params when `execute` true; (b) Master final `MasterOutputSchema.parse` enforces types and value domains.

**Quick refs**
- Master orchestrator: [core/3.query/orchestrators/master-orchestrator.ts](core/3.query/orchestrators/master-orchestrator.ts)
- Normalizers: [core/4.output/normalize-output.ts](core/4.output/normalize-output.ts)
- Master schema / canonical types: [shared/contracts/canonical.ts](shared/contracts/canonical.ts)
- Persistence: [shared/services/storage-service.ts](shared/services/storage-service.ts)
- Response formatting (consumer): [core/4.output/response-formatter.ts](core/4.output/response-formatter.ts)

If you want, I can:
- extract a visual DOT or Mermaid diagram for the graphs, or
- run quick code searches to enumerate every file that references each field (would produce a full cross-reference table).

