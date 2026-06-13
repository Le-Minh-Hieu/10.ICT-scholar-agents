# Root Cause Analysis: TradingView Timeframe Navigation Failures

This document details why TradingView remained stuck on the `1H` timeframe throughout the entire capture run.

---

## 1. Audited Trace Path

During the execution of `updateTabAndVerify()` for `EURUSD` at each configured timeframe:

1. **Requested Timeframe**: e.g., `1W`.
2. **Generated URL**: `https://www.tradingview.com/chart/bNq27R5x/?symbol=EURUSD&interval=1W`
3. **`chrome.tabs.update()`**: Executed.
4. **Actual `tab.url` after update**: Updated to contain `&interval=1W` query parameter.
5. **TradingView SPA State Response**:
   - Because `ENABLE_CLIENT_SIDE_SWITCHING = false` was configured, the script loaded same-page URLs.
   - Chrome's tab manager does not perform a hard reload when only the search query parameters change on the same URL path.
   - Furthermore, the interval parameter value supplied (`1W`, `1D`, `1M`) was **invalid**. TradingView's platform URL routing expects `W`, `D`, and `M` (not `1W`, `1D`, `1M`).
   - Consequently, TradingView ignored the parameter completely and defaulted to the layout's saved/active resolution context, which was **`1H`** (or `60`).
6. **DOM Metadata Timeframe**: Selector parsed `"1h"` from the DOM, leading to a `TIMEFRAME_MISMATCH` verification check, aborting the capture.

---

## 2. Answers to Investigation Targets

1. **Is the interval parameter generated correctly?**
   No. The generated interval values for Weekly, Daily, and Monthly were `"1W"`, `"1D"`, and `"1M"`. TradingView expects `"W"`, `"D"`, and `"M"`.

2. **Is TradingView ignoring the interval parameter?**
   Yes. When receiving the malformed query parameters (`1W`/`1D`/`1M`), the router fails silently and loads the default interval saved inside the chart layout object.

3. **Is the URL changing but SPA state not changing?**
   Yes. The URL changed in the browser tab, but since Chrome did not trigger a hard page reload and the parameters were invalid, the SPA chart state remained unchanged.

4. **Is the interval parameter name incorrect?**
   No, the parameter name `interval` is correct. Only the values were invalid.

5. **Is the TradingView chart layout URL overriding the interval?**
   Yes. If the interval query parameter value is malformed or invalid, TradingView defaults to loading the layout's saved timeframe (which was `1H`).

---

## 3. URL Verification Examples

### Malformed URL (Ignored by TradingView)
`https://www.tradingview.com/chart/bNq27R5x/?symbol=EURUSD&interval=1W`

### Standard/Correct URL (Processed by TradingView)
`https://www.tradingview.com/chart/bNq27R5x/?symbol=EURUSD&interval=W`
