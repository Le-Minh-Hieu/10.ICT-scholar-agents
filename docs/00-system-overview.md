**Executive Summary**

- **Problem:** Orchestrate multi-timeframe market analysis and news cognition to produce actionable trading guidance (execute/no-trade, direction, entry/stop/take-profit, confidence) from aggregated market data and staged news events.
- **Final output:** Structured decision artifacts and analysis JSON (master decision, per-layer orchestrator outputs, news artifacts) persisted under capture/artifact paths (e.g., `analysis/news/*`, persisted orchestrator outputs via `StorageService.persistAnalysisOutput`).
- **Primary consumers:** Automated trading/analysis pipelines and humans reviewing analysis; downstream modules that load `master`/`analysis` artifacts or a persistence layer for replay and evaluation.

**System Purpose**

- **Market analysis objectives:** Produce hierarchical, evidence-backed directional bias across HTF/ITF/LTF (High/Intermediate/Low timeframes), quantify confidence and confluence, and persist structured artifacts for analysis and reuse.
- **Trading objectives:** Decide whether to `execute` a trade and, if so, provide `direction`, `entry`, `entry_price`/`stop_loss`/`take_profit`, and a `confluence_score` used to gate execution (confluence < 2 => no-trade logic observed).
- **News cognition objectives:** Ingest news (shadow and production), score/normalize/dedupe events, compute exposure and event windows, hydrate macro weekly/daily profiles, and produce news artifacts used to alter execution modifiers and macro bias.
- **Decision generation objectives:** Reconcile layer outputs into a master decision using hierarchical memory, PMSO (probabilistic market-state object), scenario and temporal engines, and persist master artifacts for downstream consumption.

**High Level Architecture**

- **Ingestion Layer**: news ingestion and normalization, staging (shadow/production). (See [core/news/ingestion/ingestion-controller.ts](core/news/ingestion/ingestion-controller.ts))
- **News Cognition Layer**: macro profile storage, hydration, reasoning, and shadow reasoning selection. (See [core/news/macro-context.ts](core/news/macro-context.ts), [core/news/staging/staging-event-store.ts] [NEEDS VERIFICATION])
- **Index / Retrieval Layer**: retrieval-core, embedding/indexing components used by reasoning agents. (Files under [core/2.index](core/2.index) and [core/3.query/retrieval-core.ts] [NEEDS VERIFICATION])
- **Time Layer**: `time-orchestrator` producing time/window artifacts consumed by master. (Referenced in [core/4.output/run-system.ts](core/4.output/run-system.ts))
- **Agent Orchestration Layer**: HTF/ITF/LTF orchestrators run agents (structure, liquidity, pd-array, trigger, setup, etc.). (See [core/3.query/orchestrators/htf-orchestrator.ts](core/3.query/orchestrators/htf-orchestrator.ts), [core/3.query/orchestrators/itf-orchestrator.ts](core/3.query/orchestrators/itf-orchestrator.ts), [core/3.query/orchestrators/ltf-orchestrator.ts](core/3.query/orchestrators/ltf-orchestrator.ts))
- **Master/Decision Layer**: `master-orchestrator` reconciles HTF/ITF/LTF outputs with hydration context, scenario & temporal engines, PMSO, and news modifiers to produce final master output and analysis artifacts. (See [core/3.query/orchestrators/master-orchestrator.ts](core/3.query/orchestrators/master-orchestrator.ts))
- **Output Layer**: `run-system` entry writes normalized outputs, news artifacts, and persists capture artifacts via `StorageService`. (See [core/4.output/run-system.ts](core/4.output/run-system.ts))

**End-to-End Data Flow**

- Input: raw symbol timeframes + optional `macro_events` + staged news events
  ↓
- Ingestion: `IngestionController.ingest()` normalizes, dedupes and appends events to staging (shadow or production). (See [core/news/ingestion/ingestion-controller.ts](core/news/ingestion/ingestion-controller.ts))
  ↓
- News Hydration: `getLatestMacroHydration()` and daily hydration augment `HydrationContext` with `weekly_profile`, `daily_profile`, `event_windows`. `run-system` uses `stagingEventStore.getActiveEvents()` to compute exposure policy. (See [core/4.output/run-system.ts](core/4.output/run-system.ts))
  ↓
- Time & Retrieval: `time-orchestrator` and retrieval core supply temporal scaffolding and retrieval queries used by agents. (References in `run-system` and orchestrators) [NEEDS VERIFICATION on specific retrieval paths]
  ↓
- Layered Orchestration:
  - HTF: runs HTF agents (structure, macro, liquidity, pd-array), sanitizes, builds prompt, calls LLM (via `callLLM`), and produces HTF output. (See [core/3.query/orchestrators/htf-orchestrator.ts](core/3.query/orchestrators/htf-orchestrator.ts))
  - ITF: runs ITF agents (structure, liquidity, pd-array, setup), similar flow into LLM. (See [core/3.query/orchestrators/itf-orchestrator.ts](core/3.query/orchestrators/itf-orchestrator.ts))
  - LTF: runs LTF agents (structure, liquidity, pd-array, trigger) and produces final execution thesis for low timeframe; LTF may call LLM and returns `execute` + `confluence_score`. (See [core/3.query/orchestrators/ltf-orchestrator.ts](core/3.query/orchestrators/ltf-orchestrator.ts))
  ↓
- Confluence & Mastering: `master-orchestrator` ingests HTF/ITF/LTF outputs + hydration context, runs reconciler/temporal/scenario engines, optionally reasons about news (`reasonAboutNews`) and builds master output, persisting many news artifacts and analysis JSONs. (See [core/3.query/orchestrators/master-orchestrator.ts](core/3.query/orchestrators/master-orchestrator.ts))
  ↓
- Output: `runSystem()` collects orchestrator outputs, normalizes direction/confidence, stores artifacts using `StorageService` and returns a `SystemResult` summarizing execution decision and layers. Output folders include `analysis/news/*` and persisted orchestrator outputs (via `StorageService.persistAnalysisOutput`). (See [core/4.output/run-system.ts](core/4.output/run-system.ts))

**Execution Flow**

- Primary entry points:
  - `runSystem(input, options)` in [core/4.output/run-system.ts](core/4.output/run-system.ts) — the orchestrating entry used to run a full pipeline.
  - Facade entry points under `app/facades/*` appear present but are empty in workspace (indexFacade/ingestFacade are empty) — [NEEDS VERIFICATION].
- Main orchestrators:
  - `runHTFOrchestrator()` — HTF pipeline
  - `runITFOrchestrator()` — ITF pipeline
  - `runLTFOrchestrator()` — LTF pipeline
  - `runMasterOrchestrator()` — consolidates layers
  - `runTimeOrchestrator()` — time/window producer (imported by `run-system`)
- Execution order observed inside `runSystem`:
  1. Validate input & minimum data per-symbol.
  2. Hydration: build initial `HydrationContext` using staging events, `getLatestMacroHydration`, `getLatestDailyHydration`.
  3. Run timeframe orchestrators (HTF, ITF, LTF) — each runs multiple agents in parallel, then calls LLM via `callLLM` using a sanitized prompt.
  4. Run `runMasterOrchestrator` to reconcile timeframe outputs, apply news modifiers and scenario/temporal engines.
  5. Persist analysis artifacts (news artifacts, per-orchestrator outputs) and return `SystemResult`.

**Diagrams**

Component Flow:

Ingestion -> News Hydration -> Time/Index -> HTF/ITF/LTF Agents -> LLM Orchestration -> Master Reconciler -> Storage/Output

Execution Sequence (simplified):

`runSystem()`
→ hydrate (macro + daily)
→ runHTFOrchestrator
→ runITFOrchestrator
→ runLTFOrchestrator
→ runMasterOrchestrator
→ persist artifacts

**Core Components**

- IngestionController
  - Purpose: normalize/dedupe/score and stage news events (shadow/production).
  - Key files: [core/news/ingestion/ingestion-controller.ts](core/news/ingestion/ingestion-controller.ts)
  - Inputs: provider payloads from adapters.
  - Outputs: staged events in `stagingEventStore`, metrics, shadow reasoning candidate sets.

- Staging & Macro Profile Store
  - Purpose: persist macro weekly/daily profiles and staging event ledger.
  - Key files: [core/news/macro-context.ts](core/news/macro-context.ts) (store helpers), [core/news/staging/staging-event-store.ts] [NEEDS VERIFICATION]
  - Inputs: normalized news events, hydration results
  - Outputs: `weekly_profile`, `daily_profile`, `event_windows` used by orchestrators

- HTF/ITF/LTF Orchestrators
  - Purpose: run domain agents, sanitize agent outputs, build prompts, call LLMs, produce timeframe outputs.
  - Key files: [core/3.query/orchestrators/htf-orchestrator.ts](core/3.query/orchestrators/htf-orchestrator.ts), [core/3.query/orchestrators/itf-orchestrator.ts](core/3.query/orchestrators/itf-orchestrator.ts), [core/3.query/orchestrators/ltf-orchestrator.ts](core/3.query/orchestrators/ltf-orchestrator.ts)
  - Inputs: symbol timeframe data, `HydrationContext`, PMSO
  - Outputs: orchestrator JSON outputs saved via `StorageService.persistAnalysisOutput` and returned to caller

- Master Orchestrator
  - Purpose: reconcile timeframe outputs, run temporal/scenario logic, integrate news grounding, produce master output and many news artifacts.
  - Key files: [core/3.query/orchestrators/master-orchestrator.ts](core/3.query/orchestrators/master-orchestrator.ts)
  - Inputs: HTF/ITF/LTF outputs, `HydrationContext` (weekly/daily profiles, event windows), PMSO
  - Outputs: master output JSON and multiple `analysis/news/*` artifacts saved with `StorageService.saveCaptureArtifact` and `StorageService.persistAnalysisOutput`.

- Output Runner
  - Purpose: top-level orchestration (`runSystem`) — input validation, hydration, running orchestrators, artifact persistence, and result normalization.
  - Key file: [core/4.output/run-system.ts](core/4.output/run-system.ts)
  - Inputs: pipeline input payload (symbol timeframes + optional macro events)
  - Outputs: `SystemResult` (execute flag, direction, confidence, per-layer details) and persisted artifacts.

**Output Architecture**

- `analysis/news/*` (e.g., `macro-context.json`, `macro-narrative.json`, `weekly-profile.json`)
  - Producer: `master-orchestrator` and news reasoning flows.
  - Consumer: downstream analysis, persistence, evaluation, and UI/debug tools.
  - Purpose: represent macro narrative, grounding, and per-event reasoning.

- Persisted orchestrator outputs (via `StorageService.persistAnalysisOutput`)
  - Producer: HTF/ITF/LTF orchestrators.
  - Consumer: `master-orchestrator`, audit tools, and evaluation pipelines.

- Capture artifacts saved via `StorageService.saveCaptureArtifact` (path keys like `analysis/news/*`)
  - Producer: `master-orchestrator` and `runSystem` persistence bridges.
  - Consumer: later replay or manual inspection.

**LLM Architecture Summary**

- Files invoking LLMs: orchestrators and agents call `callLLM`.
  - Observed callers: `core/3.query/orchestrators/htf-orchestrator.ts`, `itf-orchestrator.ts`, `ltf-orchestrator.ts`, `master-orchestrator.ts` (also `callLLM` referenced in agent files under `core/3.query/agents/*`).
- Files building prompts: `core/3.query/prompt-builder.ts` (referred to via `buildPrompt` in orchestrators) and per-orchestrator prompt construction code inside each orchestrator.
- Files consuming LLM outputs: orchestrators sanitize and persist outputs (they validate schemas using Zod and may call LLM with schema/tool hints). Outputs are passed into reconciler, persisted via `StorageService`, and used to construct the `SystemResult`.

**Critical Path Analysis (master/decision.json)**

To produce `master` decision artifacts the required components are:

1. Input with minimum timeframes (validated by `hasMinimumData` in `run-system`).
2. Hydration context (weekly/daily macro profile) via `getLatestMacroHydration` and `getLatestDailyHydration`.
3. HTF/ITF/LTF orchestrators run and return outputs (each relies on multiple agents and LLM calls).
4. `master-orchestrator` reconciler + scenario + temporal engines; apply news modifiers (`reasonAboutNews`) and produce master output.
5. `StorageService.saveCaptureArtifact` / `persistAnalysisOutput` persist the master decision and news artifacts.

Trace (backwards): master decision ← master-orchestrator ← HTF/ITF/LTF outputs ← their agents & callLLM ← retrieval/time context & hydration ← staged news + input timeframes.

**Architecture Risks**

- Tight coupling to global persisted profile and staging: `run-system` and orchestrators read global stores (stagingEventStore and MacroProfile store). Risk: hidden state affects determinism and testing.
- Heavy reliance on LLMs inside orchestrators: multiple LLM calls across HTF/ITF/LTF/master create latency and potential redundant token costs if inputs are not re-used or cached.
- Duplicate reasoning paths: news reasoning occurs both in `master-orchestrator` (grounded reasoning) and earlier shadow reasoning selection; potential duplication of effort and overlapping persisted artifacts.
- Potential bottleneck: `master-orchestrator` persists large artifact sets in a loop (iterating artifactMap and calling save), and orchestrators call LLMs sequentially in the runSystem flow — concurrency and IO cost may be critical under high volume.

**Component Graph**

IngestionController → stagingEventStore → MacroHydration → Time/Index → HTF/ITF/LTF Orchestrators → MasterOrchestrator → StorageService

**Data Flow Graph**

Raw news + symbol timeframes
→ Normalization & staging
→ Hydration (weekly/daily profile)
→ Retrieval/time scaffolding
→ Agents (structure, liquidity, pd-array, trigger, setup)
→ Orchestrators (HTF/ITF/LTF) + LLMs
→ Master reconciler + news grounding
→ Persisted analysis/news/* and master decision

**Initial Dependency Map**

Ingestion subsystem
→ Depends On: adapter normalizers, deduper, staging store
→ Produces: staged events, shadow candidates

Orchestration subsystem (HTF/ITF/LTF)
→ Depends On: agents, HydrationContext, callLLM, StorageService
→ Produces: per-timeframe analysis JSON (persisted)

Master subsystem
→ Depends On: timeframe outputs, scenario & temporal engines, news reasoning, PMSO
→ Produces: master decision artifacts, `analysis/news/*` artifacts

Notes & Verification Flags

- `app/facades/indexFacade.ts` and `app/facades/ingestFacade.ts` are present but empty in the workspace snapshot; entry points calling `runSystem` are likely external or present in other runtime code. Marked as [NEEDS VERIFICATION].
- Some storage helper file names (e.g., `staging-event-store.ts`, exact `StorageService` methods) and index/retrieval details were inferred by reading core orchestrator usages; where a file was not opened I marked `[NEEDS VERIFICATION]`.

If you want, I can:

- Expand this into a clickable architecture diagram (Mermaid) and link each component to exact lines in the repo.
- Produce a prioritized refactor plan to reduce LLM token usage and decouple global state.

---

Generated from direct code inspection of orchestrators and run-system. Marked uncertain items with [NEEDS VERIFICATION].
