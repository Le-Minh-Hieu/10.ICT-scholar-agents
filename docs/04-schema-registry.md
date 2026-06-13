## Schema Registry — Single Source of Truth

Purpose: authoritative inventory of Zod schemas, TypeScript `interface`/`type` contracts, and tool schemas used across the codebase. Entries include file path, schema type (Input/Output/Internal/Tool), fields (high-level), producer, consumer, persisted artifact, validation location, LLM/prompt usage, and criticality.

---

### MasterOutputSchema
- **File Path:** [shared/contracts/canonical.ts](shared/contracts/canonical.ts)
- **Type:** Output
- **Fields (high-level):** `decision` (execute,state,direction,confidence,score,entry_zone,notes,target?,stop_loss?), layers` (time,htf,itf,ltf,confluence,macro_news?), `metadata`, `vision?`, `_raw?`, `_pmso?`, `news_risk_modifier?`, `_debug?`
- **Producer:** `MasterOrchestrator` (core/3.query/orchestrators/master-orchestrator.ts) / orchestrator pipeline
- **Consumer:** downstream persistence, UI components, telemetry, evaluation routines
- **Persisted Artifact:** master result payloads (application sessions / orchestrator outputs) — persisted to storage service or session records (usage across `shared/services/storage-service.ts`)
- **Validation Location:** `shared/contracts/canonical.ts` (Zod `MasterOutputSchema`)
- **Used In LLM Call?:** Yes (schema models orchestrator outputs produced from agent/LLM responses)
- **Used In Prompt?:** Yes (schema shapes guide prompt/output post-processing and tool definitions)
- **Criticality:** Critical

---

### HTFOrchestratorOutputSchema
- **File Path:** [shared/contracts/canonical.ts](shared/contracts/canonical.ts)
- **Type:** Output
- **Fields:** `htf_bias`, `next_candle_bias`, `confidence`, `dominant_factors[]`, `reasoning`, `structure_state?`, `macro_state?`, `liquidity_state?`, `pd_array_state?`, `_debug?`, `_raw?`
- **Producer:** HTF orchestrator / HTF agents (core/3.query/agents/htf/*)
- **Consumer:** ITF/ltf orchestrators, MasterOrchestrator, storage, UI
- **Persisted Artifact:** orchestrator outputs, debug logs
- **Validation Location:** `shared/contracts/canonical.ts`
- **Used In LLM Call?:** Yes
- **Used In Prompt?:** Yes
- **Criticality:** Important

---

### ITFOrchestratorOutputSchema
- **File Path:** [shared/contracts/canonical.ts](shared/contracts/canonical.ts)
- **Type:** Output
- **Fields:** `itf_bias`, `entry_bias`, `setup_type`, `confidence`, `dominant_factors[]`, `reasoning`, `structure?`, `liquidity?`, `pd_array?`, `setup?`, `_debug?`, `_raw?`
- **Producer:** ITF orchestrator / ITF agents (core/3.query/agents/itf/*)
- **Consumer:** LTF, MasterOrchestrator, storage
- **Persisted Artifact:** intermediate orchestrator payloads
- **Validation Location:** `shared/contracts/canonical.ts`
- **Used In LLM Call?:** Yes
- **Used In Prompt?:** Yes
- **Criticality:** Important

---

### LTFOrchestratorOutputSchema
- **File Path:** [shared/contracts/canonical.ts](shared/contracts/canonical.ts)
- **Type:** Output
- **Fields:** `execute`, `direction`, `entry`, `entry_price?`, `stop_loss?`, `take_profit?`, `confluence_score?`, `confidence`, `dominant_factors[]`, `reasoning`, `retrieved_chunks?`, `_debug?`, `_raw?`
- **Producer:** LTF orchestrator / LTF agents (core/3.query/agents/ltf/*)
- **Consumer:** MasterOrchestrator, trade execution logic, storage
- **Persisted Artifact:** LTF outputs included in Master inputs/persistent logs
- **Validation Location:** `shared/contracts/canonical.ts` (includes `superRefine` guard enforcing required fields when `execute` true)
- **Used In LLM Call?:** Yes
- **Used In Prompt?:** Yes
- **Criticality:** Critical

---

### CompressedITFInputSchema
- **File Path:** [shared/contracts/canonical.ts](shared/contracts/canonical.ts)
- **Type:** Input (inter-orchestrator compressed payload)
- **Fields:** `htf_bias`, `next_candle_bias`, `confidence`, `dominant_factors[]`, `reasoning_summary`
- **Producer:** HTF pipeline (compressor utilities)
- **Consumer:** ITF pipeline (hydration/ingest)
- **Persisted Artifact:** transient payloads for orchestration; may be logged
- **Validation Location:** `shared/contracts/canonical.ts`
- **Used In LLM Call?:** No (used as structured payload between orchestrators)
- **Used In Prompt?:** No
- **Criticality:** Important

---

### CompressedLTFInputSchema
- **File Path:** [shared/contracts/canonical.ts](shared/contracts/canonical.ts)
- **Type:** Input
- **Fields:** `htf` (CompressedITFInput), `itf_bias`, `entry_bias`, `setup_type`, `confidence`, `dominant_factors[]`, `reasoning_summary`
- **Producer:** ITF pipeline
- **Consumer:** LTF pipeline
- **Persisted Artifact:** intermediate payloads
- **Validation Location:** `shared/contracts/canonical.ts`
- **Used In LLM Call?:** No
- **Used In Prompt?:** No
- **Criticality:** Important

---

### CompressedMasterInputSchema
- **File Path:** [shared/contracts/canonical.ts](shared/contracts/canonical.ts)
- **Type:** Input
- **Fields:** `htf` (CompressedITFInput), `itf` (CompressedLTFInput), `ltf` (execute,direction,entry,entry_price?,stop_loss?,take_profit?,confluence_score?,confidence,dominant_factors[],reasoning_summary), `time`
- **Producer:** LTF/ITF/HTF pipelines (compressor/assembler)
- **Consumer:** MasterOrchestrator
- **Persisted Artifact:** master input payloads, session logs
- **Validation Location:** `shared/contracts/canonical.ts`
- **Used In LLM Call?:** Yes (Master orchestrator receives this as input to produce `MasterOutput`)
- **Used In Prompt?:** Yes
- **Criticality:** Critical

---

### ConfidenceSchema
- **File Path:** [shared/contracts/canonical.ts](shared/contracts/canonical.ts)
- **Type:** Internal (shared primitive)
- **Fields:** numeric value 0..1 (preprocess supports object wrappers)
- **Producer:** Any analysis agent that generates confidence values
- **Consumer:** Orchestrators, evaluation, UI
- **Persisted Artifact:** part of orchestrator outputs
- **Validation Location:** `shared/contracts/canonical.ts`
- **Used In LLM Call?:** No (used post-LLM as numeric confidence)
- **Used In Prompt?:** Indirectly (schema-based guidance)
- **Criticality:** Important

---

### HydrationContextSchema
- **File Path:** [shared/contracts/context.ts](shared/contracts/context.ts)
- **Type:** Input / Internal
- **Fields:** `parent_thesis?`, `minimal_context?`, `relational_context?`, `scenario_context?`, `pmso_context?`, `inherited_temporal_state?`, `weekly_profile?`, `daily_profile?`, `news_events?`, `macro_events?`, `macro_profile?`, `news_reasoning?`, `macro_narrative?`, `event_windows?`
- **Producer:** Higher-level orchestrators (HTF) or context builders
- **Consumer:** Lower-level orchestrators (ITF, LTF) and agents
- **Persisted Artifact:** included in payloads (see `shared/contracts/payloads.ts`) and session context
- **Validation Location:** `shared/contracts/context.ts`
- **Used In LLM Call?:** Yes (context fed into LLM prompts/hydration)
- **Used In Prompt?:** Yes
- **Criticality:** Critical

---

### V1_ITF_INPUT_PAYLOAD
- **File Path:** [shared/contracts/payloads.ts](shared/contracts/payloads.ts)
- **Type:** Tool/Inter-orchestrator Input
- **Fields:** `version`, `htf_bias`, `next_candle_bias`, `confidence`, `dominant_factors[]`, `reasoning_summary`, `hydration_context`
- **Producer:** HTF pipeline
- **Consumer:** ITF orchestrator
- **Persisted Artifact:** versioned payload logs
- **Validation Location:** `shared/contracts/payloads.ts`
- **Used In LLM Call?:** No (structured payload between pipelines)
- **Used In Prompt?:** No
- **Criticality:** Important

---

### V1_LTF_INPUT_PAYLOAD
- **File Path:** [shared/contracts/payloads.ts](shared/contracts/payloads.ts)
- **Type:** Tool/Inter-orchestrator Input
- **Fields:** `version`, `htf_input`, `itf_bias`, `entry_bias?`, `setup_type`, `confidence`, `dominant_factors[]`, `reasoning_summary`, `hydration_context`
- **Producer:** ITF pipeline
- **Consumer:** LTF orchestrator
- **Persisted Artifact:** versioned payload logs
- **Validation Location:** `shared/contracts/payloads.ts`
- **Used In LLM Call?:** No
- **Used In Prompt?:** No
- **Criticality:** Important

---

### V1_MASTER_INPUT_PAYLOAD
- **File Path:** [shared/contracts/payloads.ts](shared/contracts/payloads.ts)
- **Type:** Input
- **Fields:** `version`, `ltf_input`, `ltf` (detailed), `time`, `hydration_context`
- **Producer:** LTF pipeline
- **Consumer:** MasterOrchestrator
- **Persisted Artifact:** master input payloads
- **Validation Location:** `shared/contracts/payloads.ts`
- **Used In LLM Call?:** Yes
- **Used In Prompt?:** Yes
- **Criticality:** Critical

---

### TimeAgentOutputSchema
- **File Path:** [types/time-agent.ts](types/time-agent.ts)
- **Type:** Output (Agent)
- **Fields:** `timing_bias`, `trading_window`, `expectation`, `confidence`, `notes`
- **Producer:** `time` agent
- **Consumer:** Orchestrators, compositors
- **Persisted Artifact:** agent outputs in session/chunk storage
- **Validation Location:** `types/time-agent.ts`
- **Used In LLM Call?:** No
- **Used In Prompt?:** No
- **Criticality:** Optional

---

## A. Schema Dependency Graph (high-level)
- `HydrationContextSchema` → used by payloads `V1_*_PAYLOAD` and orchestrators
- `HTFOrchestratorOutputSchema` → produces `V1_ITF_INPUT_PAYLOAD` (compressed) → `ITFOrchestratorOutputSchema` → produces `V1_LTF_INPUT_PAYLOAD` → `LTFOrchestratorOutputSchema` → contributes to `V1_MASTER_INPUT_PAYLOAD` → `MasterOutputSchema`
- Primitive schemas (e.g., `ConfidenceSchema`, `BiasEnum`) are referenced throughout.

## B. Producer → Consumer Graph (high-level)
- HTF agents / HTFOrchestrator → (produces) `HTFOrchestratorOutputSchema` → consumed by ITF orchestrator (via `V1_ITF_INPUT_PAYLOAD`)
- ITF agents → `ITFOrchestratorOutputSchema` → consumed by LTF orchestrator
- LTF agents → `LTFOrchestratorOutputSchema` → MasterOrchestrator
- MasterOrchestrator → `MasterOutputSchema` → UI / persistence / evaluation

## C. Artifact Mapping (what gets persisted)
- Orchestrator outputs (`MasterOutput`, `HTF/ITF/LTF` outputs): logged and stored in session/artifact stores via `shared/services/storage-service.ts` and `data/` folders
- Payloads (`V1_*`) may be logged in tracing/telemetry and used for replay
- Agent outputs (e.g., `TimeAgentOutputSchema`) used transiently; important ones are persisted when included into master payloads

## D. Critical Schemas
- Critical: `MasterOutputSchema`, `CompressedMasterInputSchema`, `HydrationContextSchema`, `LTFOrchestratorOutputSchema`, `V1_MASTER_INPUT_PAYLOAD`
- Important: `HTFOrchestratorOutputSchema`, `ITFOrchestratorOutputSchema`, `CompressedITFInputSchema`, `CompressedLTFInputSchema`, `ConfidenceSchema`
- Optional: agent-specific small schemas (e.g., `TimeAgentOutputSchema`), various `z.any()` placeholders

---

## Notes & Next Steps
- This registry was generated from a code scan for `z.object`, Zod usage, and TypeScript `interface`/`type` declarations. It captures the canonical, high-value schemas currently defined under `shared/contracts` and several agent and payload schemas.
- Next steps (recommended):
  - Expand the registry by scanning all `core/*/agents` files to enumerate agent-level schemas (many `const *OutputSchema = z.object(...)` found in `core/3.query/agents/*`).
  - Auto-generate machine-readable schema index (JSON) from Zod exports using `zodToToolSchema` helper.
  - Create visual graphs (DOT / Mermaid) for dependency and producer→consumer graphs.

If you want, I can now: (A) finish a full automated extraction across all agent files and produce Mermaid graphs, or (B) commit this markdown as the initial authoritative registry. Which would you like next?
