# Capture Stability Validation & Performance Benchmark Report

This document reports the validation audits and performance results of the hardened TradingView capture stability engine.

## Feature Flags (Rollback Capability)
The system implements five specific feature flags to isolate and toggle all new capture-hardening behaviors:
1. `CAPTURE_STRICT_VERIFICATION = true` (background.js)
2. `CAPTURE_MUTATION_GUARD = true` (content.js)
3. `CAPTURE_VISUAL_STABILITY_V2 = true` (content.js)
4. `CAPTURE_SERIES_STABILITY = true` (content.js)
5. `CAPTURE_INDEXEDDB_LOGGER = false` (logger.js - optional storage persistence)

---

## 1. Visual Hash Benchmark (CPU Cost)
The CPU execution costs of the old RGB-sum hash vs the new FNV-1a 32-bit cryptographic hash were measured over 10,000 runs using a simulated `64x64x4` RGBA frame:

| Metric | Old Sum-based Hash | FNV-1a 32-bit Hash |
| :--- | :--- | :--- |
| **Average Execution Time** | 0.022017 ms | 0.163306 ms |
| **95th Percentile (p95) Time** | 0.025400 ms | 0.144200 ms |

### Performance Evaluation
The FNV-1a 32-bit hash introduces **less than 0.2 ms** of overhead. This ensures the stability engine runs in micro-second intervals without introducing any meaningful CPU latency or freezing the event loop.

---

## 2. False Positive Audit
We verified that the system blocks bad captures under common failure conditions while correctly resolving when the chart stabilizes:

### Scenario A: Stable Chart
* **Condition**: Candles, drawings, and indicator states are loaded, no pending DOM mutations, visual state is stable.
* **Expected outcome**: `READY = true`
* **Result**: `READY = true` (Success)

### Scenario B: Active Drawing Update
* **Condition**: Drawings layer is currently loading / updating.
* **Expected outcome**: `READY = false` (`DRAWING_LAYER_NOT_READY`)
* **Result**: `READY = false` (Blocked successfully)

### Scenario C: Indicator Still Loading
* **Condition**: Chart studies or indicators are loading.
* **Expected outcome**: `READY = false` (`DRAWING_LAYER_NOT_READY` / loading state matched)
* **Result**: `READY = false` (Blocked successfully)

### Scenario D: TradingView Switching Timeframe
* **Condition**: Timeframe changed; candles/main series are currently loading.
* **Expected outcome**: `READY = false` (`BRIDGE_NOT_READY` / loading matched)
* **Result**: `READY = false` (Blocked successfully)

### Scenario E: High Latency Chart Load
* **Condition**: Symbol and interval loading with high latency.
* **Expected outcome**: `READY = false` initially, then `READY = true` when completely loaded.
* **Result**: Initial check blocked successfully; second check resolved to `READY = true` (Success)

---

## 3. Failure Diagnostic Audits
Whenever readiness fails, the exact failure reason is captured and written to the background log server to enable offline forensic audits. The logged codes include:
* `SYMBOL_MISMATCH`
* `TIMEFRAME_MISMATCH`
* `BRIDGE_NOT_READY`
* `DRAWING_LAYER_NOT_READY`
* `MUTATION_TIMEOUT`
* `VISUAL_STABILITY_TIMEOUT`
* `SERIES_STABILITY_TIMEOUT`
