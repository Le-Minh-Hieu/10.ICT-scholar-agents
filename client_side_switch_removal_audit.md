# TradingView Client-Side Switch Removal Audit

This audit documents the removal and bypass of client-side tab updates in the TradingView capture pipeline, routing navigation requests exclusively through the deterministic URL reload pathway.

---

## 1. Audited Code Paths

The entry point for `CLIENT_SIDE_UPDATE` is located in `updateTabAndVerify()` inside [background.js](file:///d:/10. ict-scholar-agents-V1/extension/background.js#L274).

When `ENABLE_CLIENT_SIDE_SWITCHING = false` is active, the following pathways are bypassed:
1. **`changeSymbolAndResolution` Messaging**: The background script no longer sends message payloads requesting the main world bridge to update the active widget properties.
2. **Bridge Change Handler**: Bypasses the `CHANGE_SYMBOL_AND_RESOLUTION` evaluation logic in `bridge.js`.
3. **Retry Loop Logic**: The background script skips the retryCount cycles (`0`, `1`, `2`) and the client-side error fallback logic.
4. **Log Tracing**: Bypasses the logging calls for `CLIENT_SIDE_UPDATE`, `CLIENT_SIDE_UPDATE_FAILURE`, and `CLIENT_SIDE_UPDATE_EXHAUSTED`.

---

## 2. Expected Latency Reduction Per Timeframe

* **Old Behavior (Bridges fail 100%)**:
  - Attempt 1: Client-side command sent $\rightarrow$ wait 8000ms $\rightarrow$ timeout/failure.
  - Attempt 2: Client-side command retry 1 $\rightarrow$ wait 8000ms $\rightarrow$ timeout/failure.
  - Attempt 3: Client-side command retry 2 $\rightarrow$ wait 8000ms $\rightarrow$ timeout/failure.
  - Exhausted: Force URL Reload $\rightarrow$ wait 3000ms – 10000ms for DOM load.
  - Total overhead before capture starts: **$\sim$ 24,000ms** of wasted timeout loops.

* **New Behavior (Direct URL reload)**:
  - Immediate `TAB_UPDATE` URL switch $\rightarrow$ wait 3000ms – 6000ms for DOM load.
  - Total overhead before capture starts: **3,000ms – 6,000ms**.

* **Net Latency Reduction**: **18,000ms – 21,000ms** saved per timeframe/symbol capture cycle.

---

## 3. Safety Analysis

- **High Reliability**: Bypassing client-side manipulation ensures the extension does not rely on TradingView's complex, obfuscated single-page application (SPA) state collection, which changes and invalidates global variables frequently at runtime.
- **Consistent Injections**: Re-injecting the content script and main world bridge on every hard reload ensures the scripts are running in clean execution contexts, resolving context invalidation warnings (`Extension context invalidated`).
- **DOM Verification Guard**: Bypassing client-side updates does not impact the verification stages. High-level DOM check selectors in `getMetadata()` are still executed to verify that the loaded page's symbol and timeframe match the target symbol/timeframe configuration before proceeding to stabilization.
