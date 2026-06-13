# Phase 0B — Dual Provider Shadow Testing Session Summary

This document summarizes the activities and outcomes of the Phase 0B Dual Provider Shadow Testing session. The objective was to validate OpenRouter compatibility with our Agent Layer without altering production paths (Gemini remains the production response source).

---

## 1. Summary of Accomplished Tasks

### Task 1 — Shadow Test Harness Implementation
* Implemented a non-intrusive shadow execution block inside `callLLM()` in `shared/utils/llm-utils.ts`.
* Configured it to run only if `SHADOW_OPENROUTER=true` is enabled, the call is not a vision call (`!isVisionCall`), and is subject to `SHADOW_SAMPLE_RATE`.
* Production logic executes the Gemini request and returns its result immediately, while a duplicate request is dispatched to OpenRouter, compared, and stored as an analysis JSON under `data/shadow-debug/`.

### Task 2 — Representative Agent Test Execution
Ran shadow tests sequentially (to avoid Jina AI 429 concurrency rate limits) for:
1. **Weekly-Agent** (`test/test-weekly-vision.ts`)
2. **HTF-Structure-Agent** (`test/test-htf-structure.ts`)
3. **ITF-Setup-Agent** (`test/test-itf-setup-agent.ts`)
4. **LTF-Trigger-Agent** (`test/test-ltf-trigger-agent.ts`)

These tests successfully captured:
* Raw Gemini request/response and parsed output.
* Raw OpenRouter request/response and parsed output.

### Task 3 — Function Call Validation
* Verified that OpenRouter successfully maps Zod schemas to OpenAI-compatible tool call payloads and returns native `tool_calls` for `output` rather than plain JSON or assistant prose.
* Tool calling was validated as functional for 3 of the 4 agents. `HTF-Structure-Agent` failed to generate a valid tool call.

### Task 4 & 5 — Schema Compatibility & Token Accounting Audit
Audited output shapes and token metrics. Discovered that prompt tokens on OpenRouter are lower because multimodal vision images are filtered out for reasoning calls.

| Agent | Schema Validation | Gemini Tokens (P / C / T) | OpenRouter Tokens (P / C / T) | Total Token Delta % |
| :--- | :--- | :--- | :--- | :---: |
| **Weekly-Agent** | Success | 3,153 / 739 / 7,855 | 2,441 / 304 / 2,745 | -65.0% |
| **HTF-Structure-Agent** | **Failure (MALFORMED)** | 3,959 / 3,916 / 15,414 | 0 / 0 / 0 | -100% |
| **ITF-Setup-Agent** | Success | 3,260 / 1,227 / 7,664 | 2,560 / 758 / 3,318 | -56.7% |
| **LTF-Trigger-Agent** | Success | 3,373 / 1,130 / 6,657 | 2,657 / 910 / 3,567 | -46.4% |

### Task 6 & 7 — Latency & Similarity Audit
Measured performance and semantic alignment.

* **Latency (min / avg / max)**:
  * **Gemini**: Min 33.60s, Avg 64.70s, Max 120.26s.
  * **OpenRouter**: Min 3.06s, Avg 25.55s, Max 55.14s.
* **Output Similarity Score (0-100)**:
  * **Weekly-Agent**: **54** (Direction/Bias disagreed: `favorable` vs `unfavorable`).
  * **HTF-Structure-Agent**: **41** (Failed response).
  * **ITF-Setup-Agent**: **88** (High agreement on setup `none` vs `none`).
  * **LTF-Trigger-Agent**: **73** (High agreement, minor missing optional fields).

---

## 2. Failure Mode Analysis

1. **`MALFORMED_FUNCTION_CALL` (Critical)**: OpenRouter failed to parse/deliver the complex facts array schema for `HTF-Structure-Agent` with Google/Gemini backend.
2. **Credit Limit `402` Error (High)**: Resolved by adding an explicit `max_tokens: 4000` limit to OpenRouter configurations, preventing it from requesting the maximum model context.
3. **Model Deprecation `404` Error (Medium)**: Updated `.env` model slug from `google/gemini-2.5-flash:free` to `google/gemini-2.5-flash`.

---

## 3. Migration Readiness Verdict

### **C. Additional compatibility work required.**

We **cannot** proceed with full OpenRouter migration at this time due to:
* The critical failure of `HTF-Structure-Agent` on the OpenRouter adapter.
* Discrepancies in directional bias output (e.g. `Weekly-Agent`).
* The necessity of tuning adapter parameters (like `max_tokens`) globally.
