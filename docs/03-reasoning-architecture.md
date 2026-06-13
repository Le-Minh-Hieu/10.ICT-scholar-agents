# Reasoning Architecture

Purpose: Describe how the system reasons—its cognitive flow—across layers (HTF, ITF, LTF, Time, News, Scenario Engine, Master). Focus is on thinking (facts → retrieval → grounding → prompts → LLM reasoning → validation → outputs), not code.

---

## VERIFIED Findings Insert (codebase-only)

### Temporal continuity (TemporalEngine reconciliation)
- VERIFIED: Master passes inherited temporal state into `TemporalEngine.reconcile()` and `capture_count` increments when inherited state exists:
  - `capture_count: (inheritedState?.capture_count || 0) + 1`.

### Scenario inheritance
- VERIFIED: prior scenarios are loaded and reconciled through `loadLatestScenarios()` → `reconcileScenarios()`.

### Temporal structure lifecycle states
- VERIFIED: explicit lifecycle statuses used in code:
  - `DISCOVERED`, `ACTIVE`, `TAPPED`, `MITIGATED`, `INVALIDATED`.

### Reconciliation semantics (quality)
- VERIFIED: invalidation removes only the affected structure (no global polarity exclusivity).
- VERIFIED: structures are generally retained by pushing into `newState.structures` unless pruned/invalidated.

-----------------------------------------
Summary notes
- Design intent: modular cognitive stages that convert observed facts and retrieved evidence into inferences, narratives and final decisions using LLMs plus deterministic reconciliation layers.
- Core primitives: Facts, Retrieval chunks (evidence), Grounding (contextual anchors), Prompt templates (structured calls), LLM reasoning, Deterministic validation, PMSO memory snapshots, Output artifacts.

=========================================
A. Cognitive Architecture (high level)

- Per-layer cognitive pipeline (same high-level shape across HTF/ITF/LTF/Time):
  1. Facts Ingest: images, metadata, prior PMSO facts, hydration contexts.
  2. Retrieval: search RAG vectors for local evidence chunks and historical outputs.
  3. Grounding: assemble context (parent thesis, pmso, timed profiles, news chunks) to constrain LLM.
  4. Prompt Construction: structured, tool-style prompts with explicit schema expectations and anchored evidence citations.
  5. LLM Reasoning: structured function-call or completion producing JSON objects (thesis, bias, anchors).
  6. Validation: deterministic checks, cross-agent reconciliation, sanity heuristics and confidence scoring.
  7. Persist & Consume: agent/orchestrator outputs saved to analysis/ and fed upward to higher layers and PMSO.

Key properties:
- Iterative and hierarchical: HTF feeds ITF → LTF; Time layer hydrates temporal priors; News and Scenario Engine feed the Master.
- Hybrid reasoning: probabilistic LLM inferences + deterministic aggregator (reconciler, bias functions, temporal engine).
- Evidence-first: grounding and retrieval are primary to avoid hallucination.

=========================================
B. Per-component reasoning breakdown

For each component: facts consumed, retrieval used, grounding, prompt construction, LLM step, validation, output schema, consumers, artifact type, confidence, error recovery.

1) HTF (High Timeframe)
- Facts consumed: D/W/M images, prior weekly/monthly profiles, PMSO macro facts, recent macro events.
- Retrieval used: RAG search for macro analysis, historical HTF agent outputs, intermarket chunks.
- Grounding used: HTF context (structure/macro/liquidity/pd_array), relevant calendar events, parent PMSO facts.
- Prompt construction: structured template asking for HTF structure, macro drivers, liquidity portrait, PD array synthesis; expects JSON with named fields (bias, anchors, confidence, tradable).
- LLM reasoning step: synthesize structure + macro thesis; create anchors and supporting chunk citations; produce HTF canonical JSON.
- Validation step: deterministic `htfBiasAgent()` computes bias from structured agent outputs; cross-checks anchors against retrieved chunks; confidence adjusted by coverage and retrieval score.
- Output schema: { bias, confidence, tradable, key_anchors[], summary, supporting_chunks[] , raw_agents: {structure,macro,liquidity,pd_array} }
- Output consumers: ITF/ LTF orchestrators, Master reconciler, Scenario Engine.
- Creates: Facts (structured extractions), Inference (bias, tradable), Narrative (summary/anchors)
- Confidence mechanism: aggregation of LLM confidence (if present), average retrieval similarity, deterministic agreement between agents; scaled into 0-1 score.
- Error recovery: if grounding coverage low → mark low confidence + attach missing evidence list; fallback to deterministic heuristics (structure-derived bias) and persist partial HTF artifact.

2) ITF (Intermediate Timeframe)
- Facts consumed: H4/H1/M15 images, HTF compact output, prior ITF artifacts, PMSO context.
- Retrieval used: RAG search for similar intraday patterns, agent-level past outputs, HTF supporting chunks.
- Grounding used: HTF thesis as parent, intraday historical events, liquidity snapshots.
- Prompt construction: targeted prompt to synthesize intraday structure, liquidity, PD arrays and setup; expects object with bias, trigger-related anchors, confidence.
- LLM reasoning step: produce ITF canonical JSON synthesizing HTF inputs with intraday evidence.
- Validation step: compare ITF anchors and bias with HTF-derived constraints; if mismatch, surface reconciliation items for Master.
- Output schema: { bias, confidence, key_anchors, structure, liquidity, pd_array, setup }
- Output consumers: LTF orchestrator, Master orchestrator, Scenario Engine.
- Creates: Inference (intraday bias), Narrative (ITF thesis), Facts (agent extractions)
- Confidence mechanism: retrieval match rate, HTF/ITF agreement, internal anchor coverage.
- Error recovery: mark non-tradable if insufficient anchors; request alternative summarization (re-run summarizer) or fallback to last-known ITF state.

3) LTF (Low Timeframe)
- Facts consumed: M15/M5/M1 images, ITF+HTF contexts, recent market microstructure facts.
- Retrieval used: fine-grained RAG search for micro patterns, previous trigger artifacts, execution history from capture storage.
- Grounding used: ITF/LTF parent theses, PMSO triggers, current session facts.
- Prompt construction: M15 thesis prompt plus structured ask for trigger/execution payload (entry, stop, target, rationale) in JSON.
- LLM reasoning step: produce LTF trigger JSON (ltf-trigger) and M15 anchors; may output multiple candidate triggers.
- Validation step: deterministic trigger sanity checks (price levels consistency, mismatch detection), PD-array verification, tradability tests.
- Output schema: { triggers: [{entry, stop, target, rationale, confidence}], M15_thesis, structure, liquidity }
- Output consumers: Master orchestrator (decision), execution subsystems, StorageService persist.
- Creates: Inference (trade triggers), Decision-level proposals (candidate triggers), Narrative (rationale)
- Confidence mechanism: ensemble: LLM scoring, retrieval support, deterministic checks (no crossing orders), historical trigger-success heuristics.
- Error recovery: drop triggers failing checks; annotate failed candidates with reasons; escalate to Master with low-confidence flag.

4) Time Layer
- Facts consumed: H1/M15/M5 images, session metadata, timing-related patterns, calendar slot boundaries.
- Retrieval used: session history, timeline entries, past session-level outputs.
- Grounding used: daily/weekly temporal priors, macro temporal expectations.
- Prompt construction: request trading_window, timing_bias, expectations and confidence (structured JSON) with supporting anchors.
- LLM reasoning step: synthesize a temporal profile that influences risk windows and timing bias.
- Validation step: cross-check with real session timestamps, ensure windows align with market hours and known events.
- Output schema: { trading_window: {start,end}, timing_bias, expectation, confidence, narrative }
- Output consumers: orchestrators for schedule-aware weighting, Master for temporal reconciliation.
- Creates: Facts (session windows), Inference (timing bias), Narrative
- Confidence mechanism: timestamp alignment, historical session success, retrieval match.
- Error recovery: fall back to default trading windows; mark uncertain windows and down-weight time-based signals.

5) News (News Reasoner)
- Facts consumed: macro calendar events, raw calendar events, staged macro events, retrieved news chunks and prior weekly/daily profiles.
- Retrieval used: RAG search across news corpus, event-specific documents, previously persisted weekly/daily profiles, related chunk citations.
- Grounding used: event context (time, symbol), PMSO macro facts, intermarket references.
- Prompt construction: per-event prompt asking for evidence summary, directional pressure, uncertainty/volatility pressure, and chunk citations; expects structured JSON with evidence_summaries and pressures.
- LLM reasoning step: create event-level reasoning objects (evidence summary, directional pressure scores, volatility/uncertainty descriptors) and suggested narrative links to market bias.
- Validation step: check chunk citation coverage, cross-validate facts against retrieved canonical sources, deterministic plausibility checks (dates, named entities).
- Output schema: { event_id, evidence_summaries[], chunk_citations[], directional_pressure, volatility_pressure, uncertainty_pressure }
- Output consumers: Master orchestrator (newsModifier), Scenario Engine, HTF/ITF for macro-context.
- Creates: Facts (extracted event evidence), Narrative (macro narrative), Inference (pressure measures)
- Confidence mechanism: citation coverage, retrieval similarity, entity/date consistency.
- Error recovery: if citations missing → lower confidence and attach raw calendar snippet; mark event as 'needs human review' if critical.

6) Scenario Engine
- Facts consumed: hierarchical memory (agent outputs), retrieved scenario-relevant chunks, PMSO memory.
- Retrieval used: RAG to find precedent scenarios, historical outcome traces, scenario templates.
- Grounding used: memory state (hierarchy), newsModifier, pmso context.
- Prompt construction: structured instructions to enumerate plausible scenarios conditioned on memory and newsModifier; expects array of scenario objects with triggers and probabilities.
- LLM reasoning step: generate scenario candidates, causal chains, outcome probabilities, action implications.
- Validation step: deterministic pruning (impossible or contradictory scenarios removed), probability recalibration using retrieval evidence frequency.
- Output schema: [{id, description, causal_chain[], probability, implications[] }]
- Output consumers: Master orchestrator (scenario_context), PMSO, downstream decision engine.
- Creates: Narrative (scenarios), Inference (probabilities), Decision inputs
- Confidence mechanism: evidence-backed probability (count and strength of supporting chunks) and memory agreement.
- Error recovery: prune low-support scenarios; provide scenario provenance and confidence breakdown.

7) Master Orchestrator
- Facts consumed: HTF/ITF/LTF outputs, Time profile, News reasoner outputs, Scenario Engine outputs, PMSO memory and reconcilers.
- Retrieval used: memory retrieval for similar master states, prior decisions, historical outcomes from capture store.
- Grounding used: assembled PMSO, temporal_state, grounded news reasoning, reconciled hierarchical facts.
- Prompt construction: structured `generateMasterDecision` prompt asking for canonical decision object (master decision) combining layers and scenarios; strict JSON schema expected.
- LLM reasoning step: produce master decision structured JSON (decision, rationale, confidence, supporting citations, scenario-weighted rationale).
- Validation step: multi-pass deterministic reconciliation: PMSOReconciler.extractFactsFromOutputs, TemporalEngine.reconcile, deterministic rule checks (consistency across layers), scenario-weighted plausibility checks. If mismatches, request LLM re-run with flagged inconsistencies or apply deterministic overrides.
- Output schema: { decision: {action|no-action, payload}, pmso_snapshot, temporal_state, scenarios_snapshot, master_confidence, rationale, citations }
- Output consumers: App facade (master/decision.json), storage, downstream execution or human review.
- Creates: Decision (final), Narrative (rationale), Facts (pmso snapshot), Inference (final confidence)
- Confidence mechanism: hierarchical aggregation (layer confidences weighted by reliability), scenario support, news pressure multipliers. Normalized score (0-1) produced.
- Error recovery: if validation fails, Master will either: 1) re-prompt LLM with reconciliation context, 2) apply deterministic fallback (e.g., no-action or last-known safe state), 3) persist partial master artifact and flag human review.

=========================================
C. Reasoning Flow Graph (textual)

- Nodes: Facts → Retrieval → Grounding → Prompt → LLM → Validation → Persist/Upstream
- Flow (HTF→ITF→LTF):
  Facts(images) -> HTF Agents -> HTF LLM -> HTF Validation -> HTF Output -> ITF Grounding
  ITF Agents -> ITF LLM -> ITF Validation -> ITF Output -> LTF Grounding
  LTF Agents -> LTF LLM -> LTF Validation -> LTF Triggers -> Master
  Time Layer runs in parallel -> supplies timing_bias to all orchestrators
  News Reasoner runs per-event -> supplies newsModifier to Master and Scenario Engine

Simple ASCII flow:

Facts(images, events, pmso)
  ├─> Time Layer ──> timing_bias
  ├─> HTF Agents ──> HTF Output
  │     └─> Retrieval, Grounding
  ├─> ITF Agents ──> ITF Output
  ├─> LTF Agents ──> LTF Triggers
  └─> News Reasoner ──> eventReasoning

HTF/ITF/LTF outputs + timing_bias + eventReasoning -> Scenario Engine -> Scenarios
All above -> Master Orchestrator -> reconcile -> Master Decision

=========================================
D. Fact → Inference → Narrative → Decision Graph (component map)

- Facts: images, calendar events, retrieval chunks, pmso records
  → Inference: HTF bias, ITF bias, LTF triggers, timing bias, event pressures
    → Narrative: timeframe theses, master narrative linking events to bias and triggers
      → Decision: master decision payload (action/no-action, triggers, risk settings)

Mapping example (single signal):
- Fact: D1 daily swing + news event E
  → HTF Inference: macro bullish bias
  → ITF Inference: intraday bias aligned
  → LTF Inference: candidate entry level
  → Narrative: coherent thesis describing why macro + intraday support trade
  → Decision: execute trigger with stop/target (or no-action if validation fails)

=========================================
E. Validation Architecture

- Multi-layer validation strategy:
  1. Evidence coverage checks: ensure LLM outputs reference chunks; check retrieval similarity thresholds.
  2. Deterministic logic checks: domain-specific rules (price math, PD-array invariants, no-crossing orders).
  3. Cross-layer reconciliation: compare child layer (ITF/LTF) bias vs parent (HTF); flag mismatches.
  4. Temporal consistency: Time layer windows must align with decision timestamps.
  5. Provenance checks: ensure news claims match cited documents (entity/date checks).
  6. Confidence calibration: combine LLM-provided confidence (if any) with retrieval evidence score and deterministic agreement score.
  7. Failure modes: re-prompt with additional grounding, deterministic fallback, mark low-confidence, or escalate to human review.

Validation flow: LLM output -> evidence & schema check -> deterministic checks -> cross-layer checks -> confidence recompute -> accept/persist or reject/retry.

=========================================
F. Memory Architecture

- Memory primitives:
  - PMSO: canonical snapshot of persistent facts and mid-run reconciled observations.
  - Agent artifacts: per-layer persisted JSONs (analysis/<layer>/<agent>.json).
  - Temporal state: serialized temporal engine outputs.
  - News artifacts: weekly/daily profiles and event-level summaries.

- Roles:
  - Short-term memory: agent outputs and retrieval index for current run (used for immediate grounding).
  - Mid-term memory: PMSO snapshot and temporal_state persisted per-capture (used by Master and next runs).
  - Long-term memory: indexes and vectors stored in `vectors/` for RAG retrieval.

- Access patterns:
  - Read-heavy during orchestration (agents read PMSO, retrieval); write at persistence points (persistAnalysisOutput, saveCaptureArtifact).
  - Memory is the primary grounding source to prevent hallucination: prompts always include PMSO slices and cited chunk excerpts.

=========================================
G. PMSO Interaction Graph

- PMSO (Persistent Multi-Source Observations) acts as the canonical memory and reconciliation center.

- Interaction points:
  - Agent outputs are inputs to PMSOReconciler -> PMSO snapshot.
  - Master Orchestrator persists PMSO snapshot and uses it to ground final decisions.
  - Scenario Engine and News Reasoner read from PMSO to ensure scenarios and event reasoning are consistent with known facts.
  - Future runs read PMSO via `getLatestMacroHydration()` / `getLatestDailyHydration()` to seed priors.

Graph (text):
  Agents -> Reconciler -> PMSO
  PMSO -> Orchestrators/ScenarioEngine/NewsReasoner (read)
  Master -> persists updated PMSO
  Subsequent runs -> seed from PMSO (hydration)

=========================================
H. Practical notes / heuristics

- Prompts are structured to require JSON output to make programmatic validation easy and to reduce hallucination. They include explicit evidence citations and schema instructions.
- Grounding is prioritized: when retrieval coverage is low, outputs are forced low-confidence and deterministic fallbacks apply.
- Master is the safety gate: validation and deterministic rules can override LLM if inconsistencies are found.
- Confidence is multi-factor: retrieval score, agent agreement, deterministic checks, citation coverage, and scenario support.

=========================================
I. Deliverables

- This document (`03-reasoning-architecture.md`) captures the cognitive architecture and graphs requested.

If you want, I can also produce: a) a visual flow diagram (Mermaid), b) a short checklist for prompt templates, or c) annotate which persisted JSON fields map to each schema above.
