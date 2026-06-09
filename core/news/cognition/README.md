# Macro Cognition — Cognition Runner

This folder contains the Phase-1/2 macro cognition runtime artifacts.

CLI
---
- Run the full cognition pipeline (build latest weekly profile, retrieval, reasoning, validation, adaptation, persist, hydrate):

```bash
tsx core/news/cognition/run-weekly-builder.ts
```

Traces
---
The cognition pipeline emits deterministic structured traces via `trace()` (which wraps the shared logger). Key trace stages:

- `MACRO_PROFILE_TRACE` — workflow start, week detection, classification.
- `MACRO_RETRIEVAL_TRACE` — queries built, retrieved counts, top chunk summaries.
- `MACRO_REASONING_TRACE` — reasoning aggregation and narrative synthesis.
- `MACRO_VALIDATION_TRACE` — price validation results and alignment.
- `MACRO_ADAPTATION_TRACE` — adaptation pressure, alignmentScore, confidence updates.
- `MACRO_HYDRATION_TRACE` — hydration payload visibility and propagation.
- `MACRO_CONTEXT_PROPAGATION` — hydrator propagation details.
- `MACRO_CONTEXT_FINAL` — final persisted profile summary.
- `MACRO_RUNTIME_ASSERT` — assertions and runtime failures.

Files
---
- `macro-retrieval-adapter.ts` — context-aware retrieval bridge to `retrieveRAG`.
- `macro-narrative-engine.ts` — narrative synthesis heuristics and reasoning traces.
- `macro-validation.ts` — price validation hook.
- `macro-adaptation.ts` — adaptation engine that updates confidence/regime and records adaptation history.
- `weekly-profile-builder.ts` — orchestrator composing the full pipeline.
- `macro-context-hydrator.ts` — exposes compact hydration payload to downstream consumers.
- `run-weekly-builder.ts` — CLI wrapper for manual testing.

Notes
---
- This implementation intentionally keeps heuristics conservative.
- Persistence is via `MacroContextStore` (stored under `data/calendar_cache/macro_profiles`).
- For automated runs integrate with `shadow-runner` (the system triggers the builder on activation).
