# Root Cause Analysis: Missing Timeframe 1W for GBPUSD

This document identifies why the `1W` timeframe capture for `GBPUSD` is missing from the payload sent to the backend, causing server validation to fail.

---

## 1. Lifecycle Trace of Timeframe Keys (GBPUSD)

During the `captureMultiSymbolPipeline` execution for `GBPUSD`:
- **1MO**: Successfully updated tab URL $\rightarrow$ Verification passed (1MO matches M) $\rightarrow$ Captured $\rightarrow$ Aggregated.
- **1W**: URL updated to `?symbol=GBPUSD&interval=1W`. However, since the base path of the URL remained the same, Chrome did not perform a hard reload. The page state stayed on `EURUSD`. Verification failed with `SYMBOL_MISMATCH` (Expected `GBPUSD`, found `EURUSD`). **Capture aborted.**
- **1D**: URL updated to `?symbol=GBPUSD&interval=1D`. Hard reload did not occur. Verification failed with `SYMBOL_MISMATCH`. **Capture aborted.**
- **4H**: Eventually, either a reload occurred or the SPA state settled, causing `currentSymbol` to be resolved as `GBPUSD`. Verification passed. **Captured & aggregated.**
- **1H**: Verification passed. **Captured & aggregated.**
- **15m**: URL updated. State reverted/stuck on `EURUSD`. Verification failed. **Capture aborted.**
- **5m**: Verification failed. **Capture aborted.**

---

## 2. Verification of 1W Capture Existence

A search of the runtime logs confirms that **no capture was ever taken for GBPUSD @ 1W**.
Instead, the attempt was aborted during verification:
```json
{"timestamp":"2026-06-13T08:21:05.563Z","stage":"VERIFICATION_FAILURE","message":"Verification mismatch for GBPUSD @ 1W","data":{"currentSymbol":"EURUSD","currentTF":"W","currentTFNorm":"1W","expectedTFNorm":"1W"}}
{"timestamp":"2026-06-13T08:21:05.564Z","stage":"READINESS_FAILURE","message":"Aborting capture for GBPUSD @ 1W due to verification failure","data":{"symbol":"GBPUSD","timeframe":"1W","failureStage":"VERIFICATION_FAILED"}}
```

---

## 3. Why the Timeframe Disappears (Root Cause)

Since `ENABLE_CLIENT_SIDE_SWITCHING` is set to `false`, symbol changing depends entirely on `chrome.tabs.update(tabId, { url: url.toString() })`. 

However, updating the query parameters (`?symbol=GBPUSD&interval=1W`) on the same TradingView base chart page does **not** trigger a hard page reload in Chrome. The browser fires `chrome.tabs.onUpdated` with status `complete` immediately because only the URL search parameters changed. Because the tab did not reload, it still displays the previous symbol (`EURUSD`).

This leads to a `SYMBOL_MISMATCH` in the verification phase, aborting the capture for `1W`, `1D`, `15m`, and `5m`.

---

## 4. Object Shape Before Ingestion/Validation

The payload sent to the backend `/api/vision/multi-tf` has the following shape:

```json
{
  "session_id": "session_1781338784840",
  "data": {
    "EURUSD": [
      { "symbol": "EURUSD", "timeframe": "1MO", "image": "data:image/jpeg;base64,..." },
      { "symbol": "EURUSD", "timeframe": "1W", "image": "data:image/jpeg;base64,..." },
      { "symbol": "EURUSD", "timeframe": "1D", "image": "data:image/jpeg;base64,..." }
    ],
    "GBPUSD": [
      { "symbol": "GBPUSD", "timeframe": "1MO", "image": "data:image/jpeg;base64,..." },
      { "symbol": "GBPUSD", "timeframe": "4H", "image": "data:image/jpeg;base64,..." },
      { "symbol": "GBPUSD", "timeframe": "1H", "image": "data:image/jpeg;base64,..." }
    ]
  }
}
```

Because `GBPUSD` contains no element with `"timeframe": "1W"`, the backend validation fails with `Missing timeframe 1W for GBPUSD`.

---

## 5. Location of Loss

- **File**: [background.js](file:///d:/10. ict-scholar-agents-V1/extension/background.js)
- **Function**: `updateTabAndVerify()`
- **Line**: Around line 292:
  ```javascript
  await chrome.tabs.update(tabId, { url: url.toString() });
  ```
  This call fails to force a hard page reload when navigating from `EURUSD` to `GBPUSD` on the same base layout path.
