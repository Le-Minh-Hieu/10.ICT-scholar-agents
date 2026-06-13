/**
 * Background Script - Multi-Symbol Intelligence with Range Control
 */
import { log, initTracer, exportLogsToJson, getAllLogsFromDB } from './logger.js';

console.log("[EXT] background running");

import TIMEFRAMES from './config/timeframes.js';
import { SYMBOL_GROUPS } from './config/symbol-groups.js';
import { TIMEFRAME_SETS } from './config/timeframe-sets.js';
import { captureTab, wait } from './capture.js';

const useRangeControl = true;
const injectedTabs = new Set();
let isCapturing = false;

// Feature Flags
const CAPTURE_STRICT_VERIFICATION = true;
const ENABLE_CLIENT_SIDE_SWITCHING = false;

function normalizeTF(tf) {
  if (!tf) return "";
  const raw = tf.toString().trim();
  const val = raw.toLowerCase();

  // Normalize common aliases
  if (val === "d" || val === "1d") return "1D";
  if (val === "w" || val === "1w") return "1W";

  // Case-sensitive check for 1 Month vs 1 Minute
  if (raw === "1M" || raw === "M" || val === "1mo" || val === "mo") return "1M";

  // Handle minute format: "1m", "15m" -> "15"
  if (raw === "1m" || raw === "m" || (val.endsWith("m") && !val.includes("mo") && raw !== "1M")) {
    return val.replace("m", "").toUpperCase();
  }

  // Handle hour format: "1h" -> "60", "4h" -> "240"
  if (val.endsWith("h")) {
    const hours = parseInt(val.replace("h", ""));
    if (!isNaN(hours)) return (hours * 60).toString();
  }

  return val.toUpperCase();
}

async function captureMultiSymbolPipeline(startTabId) {
  let currentTabId = startTabId;
  const sessionId = `session_${Date.now()}`;
  const pipelineId = "capture";
  const traceId = self.crypto.randomUUID();
  initTracer(sessionId, pipelineId, traceId);

  log({ stage: "PIPELINE_START", message: "Starting multi-symbol intelligence capture" });

  try {
    const allData = {};

    for (const groupName in SYMBOL_GROUPS) {
      const group = SYMBOL_GROUPS[groupName];
      log({ stage: "GROUP_PROCESSING", message: `Processing group: ${groupName}`, data: { groupName } });

      for (const symbolRaw of group.symbols) {
        const symbol = symbolRaw.toUpperCase();
        log({ stage: "SYMBOL_PROCESSING", message: `Processing symbol: ${symbol}`, data: { symbol } });
        allData[symbol] = [];

        for (const tfName of group.timeframes) {
          const tfConfig = TIMEFRAMES.find(t => t.name === tfName);
          if (!tfConfig) continue;

          try {
            log({ stage: "CAPTURE_ATTEMPT", message: `Attempting capture for ${symbol} @ ${tfName}`, data: { symbol, timeframe: tfName } });

            const success = await updateTabAndVerify(currentTabId, symbol, tfConfig);
            if (!success) {
              log({ stage: "READINESS_FAILURE", message: `Aborting capture for ${symbol} @ ${tfName} due to verification failure`, data: { symbol, timeframe: tfName, failureStage: "VERIFICATION_FAILED" }, level: "ERROR" });
              continue;
            }

            let box;
            try {
              // FIX 4 — ADD TIMEOUT (3s)
              box = await sendMessageWithTimeout(currentTabId, { action: 'getChartBox' }, 3000);
            } catch (e) {
              log({ stage: "CAPTURE_FAILURE", message: "getChartBox failed or timed out", data: { error: e.message, symbol, timeframe: tfName }, level: "ERROR" });
              continue;
            }
            const focusStart = Date.now();
            await chrome.tabs.update(currentTabId, { active: true });
            const currentTabInfo = await chrome.tabs.get(currentTabId);
            await chrome.windows.update(currentTabInfo.windowId, { focused: true });

            // Poll until tab is active and status is complete
            let tabStatusOk = false;
            const pollStart = Date.now();
            let currentTab = null;
            while (!tabStatusOk && (Date.now() - pollStart < 5000)) {
              currentTab = await chrome.tabs.get(currentTabId);
              if (currentTab.active === true && currentTab.status === 'complete') {
                tabStatusOk = true;
              } else {
                await wait(50);
              }
            }

            // Call awaitVisibilityAndRepaint on content script
            let visibilityState = "unknown";
            try {
              const visResponse = await sendMessageWithTimeout(currentTabId, { action: 'awaitVisibilityAndRepaint' }, 4000);
              if (visResponse && visResponse.success) {
                visibilityState = visResponse.visibilityState;
              } else if (visResponse && visResponse.error) {
                visibilityState = visResponse.error;
              }
            } catch (e) {
              visibilityState = "VISIBILITY_TIMEOUT";
              log({ stage: "VISIBILITY_TIMEOUT", message: "Document visibility timed out or failed", data: { error: e.message }, level: "ERROR" });
            }

            const focusSettleTime = Date.now() - focusStart;

            log({
              stage: "FOCUS_TIME",
              message: "Tab focus and visibility verification completed",
              metrics: {
                focusSettleTime
              },
              data: {
                tabActive: currentTab ? currentTab.active : false,
                tabStatus: currentTab ? currentTab.status : "unknown",
                visibilityState,
                focusSettleTime
              }
            });

            log({ stage: "STABILIZATION_START", message: "Awaiting visual stability contract..." });
            let isStable = false;
            try {
              const readinessResponse = await sendMessageWithTimeout(currentTabId, {
                action: 'waitForCaptureReadiness',
                expectedSymbol: symbol,
                expectedInterval: tfConfig.interval
              }, 15000);
              if (readinessResponse && readinessResponse.success && readinessResponse.stable) {
                isStable = true;
                log({
                  stage: "STABILIZATION_COMPLETE",
                  message: "Stability contract verified.",
                  data: readinessResponse,
                  metrics: readinessResponse.metrics
                });
              } else {
                const failureStage = (readinessResponse && readinessResponse.failureStage) || "UNKNOWN_STABILITY_FAILURE";
                log({ stage: "READINESS_FAILURE", message: `Stabilization check failed: ${failureStage}`, level: "ERROR", data: readinessResponse });
                if (CAPTURE_STRICT_VERIFICATION) {
                  continue; // Skip capture
                }
              }
            } catch (e) {
              log({ stage: "READINESS_FAILURE", message: `Stabilization timed out: ${e.message}`, level: "ERROR", data: { failureStage: "STABILIZATION_TIMEOUT" } });
              if (CAPTURE_STRICT_VERIFICATION) {
                continue; // Skip capture
              }
            }

            const captureStartTime = Date.now();
            const captureResult = await captureTab();
            const fullDataUrl = captureResult.dataUrl;
            const captureEndTime = Date.now();
            log({
              stage: "SCREENSHOT",
              message: `Screenshot taken for ${symbol} @ ${tfName}. Error: ${captureResult.error}`,
              metrics: {
                duration: captureEndTime - captureStartTime,
                size: fullDataUrl ? fullDataUrl.length : 0
              },
              data: {
                success: !!fullDataUrl,
                attempt: captureResult.attempt,
                dataUrlLength: fullDataUrl ? fullDataUrl.length : 0,
                lastError: captureResult.error,
                start: captureResult.startTimestamp,
                end: captureResult.endTimestamp,
                activeTabId: captureResult.activeTabId,
                activeWindowId: captureResult.activeWindowId
              }
            });

            await waitForContentReady(currentTabId);

            let processed;
            try {
              // FIX 4 — ADD TIMEOUT (15s for processing)
              processed = await sendMessageWithTimeout(currentTabId, {
                action: 'processImage',
                dataUrl: fullDataUrl,
                box: box
              }, 15000);
              log({ stage: "IMAGE_PROCESSING", message: `processImage result received for ${symbol} @ ${tfName}`, data: { success: !!processed } });
            } catch (e) {
              log({ stage: "IMAGE_PROCESSING_FAILURE", message: "processImage failed or timed out", data: { error: e.message, symbol, timeframe: tfName }, level: "ERROR" });
            }

            if (processed && processed.image) {
              // Ensure timeframe is standardized
              const standardizedTF = tfName;
              allData[symbol].push({
                symbol: symbol,
                timeframe: standardizedTF,
                image: processed.image
              });
              log({ stage: "CAPTURE_SUCCESS", message: `Successfully captured ${symbol} @ ${tfName}`, data: { symbol, timeframe: tfName } });
            } else {
              log({ stage: "CAPTURE_FAILURE", message: `Empty result for ${symbol} @ ${tfName}`, data: { symbol, timeframe: tfName }, level: "WARN" });
            }

          } catch (error) {
            log({ stage: "CAPTURE_ERROR", message: `Error during ${symbol} @ ${tfName}`, data: { error: error.message, symbol, timeframe: tfName }, level: "ERROR" });
          }
        }
      }
    }

    const totalResults = Object.values(allData).flat().length;
    log({ stage: "PIPELINE_END", message: `Capture complete. Total results: ${totalResults}`, metrics: { totalResults } });

    if (totalResults > 0) {
      await sendBatchToServer(sessionId, allData);
    } else {
      log({ stage: "PIPELINE_END", message: "No results to send to server.", level: "WARN" });
    }
  } catch (globalError) {
    log({ stage: "PIPELINE_FATAL", message: "Fatal pipeline error", data: { error: globalError.message }, level: "ERROR" });
  }
}

async function waitForContentReady(tabId, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response === 'pong') return true;
    } catch (e) {
      // Content script not ready yet
    }
    await wait(100);
  }
  return false;
}

async function waitForChartReady(tabId, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const metadata = await sendMessageWithTimeout(tabId, { action: 'getMetadata' });
      if (metadata && metadata.symbol !== 'UNKNOWN' && metadata.timeframe !== 'UNKNOWN') {
        return true;
      }
    } catch (e) {
      // Message fail or timeout
    }
    await wait(200);
  }
  return false;
}

async function sendMessageWithTimeout(tabId, message, timeout = 3000) {
  return Promise.race([
    chrome.tabs.sendMessage(tabId, message),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
  ]);
}

async function updateTabAndVerify(tabId, symbol, tf, forceReload = false, retryCount = 0) {
  let isReady = false;
  if (ENABLE_CLIENT_SIDE_SWITCHING && !forceReload) {
    try {
      const response = await sendMessageWithTimeout(tabId, { action: 'ping' }, 1000);
      if (response === 'pong') isReady = true;
    } catch (e) {
      // Content script not ready or page not loaded
    }
  }

  if (!isReady) {
    const tab = await chrome.tabs.get(tabId);
    const url = new URL(tab.url);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', tf.interval);

    log({ stage: "TAB_UPDATE", message: `Updating tab URL (First Load / Forced Reload) to ${symbol} @ ${tf.name}`, data: { symbol, timeframe: tf.name } });
    await chrome.tabs.update(tabId, { url: "about:blank" });
    await wait(200);
    await chrome.tabs.update(tabId, { url: url.toString() });

    await new Promise((resolve) => {
      const listener = (tId, info) => {
        if (tId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 10000);
    });

    log({ stage: "REINJECT_SCRIPT", message: "Re-injecting content script and bridge" });
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
      injectedTabs.add(tabId);

      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["bridge.js"],
        world: 'MAIN'
      });
    } catch (err) {
      log({ stage: "REINJECT_SCRIPT_FAILURE", message: "Injection failed", data: { error: err.message }, level: "ERROR" });
    }

    await waitForContentReady(tabId);
    await waitForChartReady(tabId);
  } else {
    log({ stage: "CLIENT_SIDE_UPDATE", message: `Updating symbol and resolution client-side: ${symbol} @ ${tf.name} (retryCount: ${retryCount})` });
    let response = null;
    try {
      response = await sendMessageWithTimeout(tabId, { action: 'changeSymbolAndResolution', symbol: symbol, resolution: tf.interval }, 8000);
      if (!response || !response.success) {
        throw new Error(response && response.error ? response.error : "Bridge symbol update failed");
      }
    } catch (e) {
      log({
        stage: "CLIENT_SIDE_UPDATE_FAILURE",
        message: `Client-side update failed: ${e.message}.`,
        level: "WARN",
        data: response ? response.diagnostics : null
      });
      if (retryCount < 2) {
        return updateTabAndVerify(tabId, symbol, tf, false, retryCount + 1);
      } else {
        log({ stage: "CLIENT_SIDE_UPDATE_EXHAUSTED", message: `Client-side retries exhausted. Forcing URL reload path.`, level: "WARN" });
        return updateTabAndVerify(tabId, symbol, tf, true, 0);
      }
    }
  }

  // Verification
  try {
    const metadata = await sendMessageWithTimeout(tabId, { action: 'getMetadata' });
    if (!metadata) throw new Error("No metadata received");

    const currentSymbol = metadata.symbol.toUpperCase();
    const currentTF = metadata.timeframe;

    const symbolMatch = currentSymbol.includes(symbol.toUpperCase());
    const currentTFNorm = normalizeTF(currentTF);
    const expectedTFNorm = normalizeTF(tf.interval);
    const tfMatch = currentTFNorm === expectedTFNorm;

    log({
      stage: "VERIFICATION", message: `Verifying ${symbol} @ ${tf.name}`, data: {
        currentSymbol,
        currentTF,
        currentTFNorm,
        expectedTFNorm,
        tfMatch,
        symbolMatch
      }
    });

    if (symbolMatch && tfMatch) {
      log({ stage: "VERIFICATION_SUCCESS", message: `Verified ${symbol} @ ${tf.name}` });
      return true;
    }

    log({ stage: "VERIFICATION_FAILURE", message: `Verification mismatch for ${symbol} @ ${tf.name}`, data: { currentSymbol, currentTF, currentTFNorm, expectedTFNorm }, level: "WARN" });
    if (CAPTURE_STRICT_VERIFICATION) {
      const diagStage = !symbolMatch ? "SYMBOL_MISMATCH" : "TIMEFRAME_MISMATCH";
      log({ stage: "READINESS_FAILURE", message: `Readiness verification mismatch: ${diagStage}`, data: { failureStage: diagStage, expectedSymbol: symbol, currentSymbol, expectedTimeframe: tf.name, currentTimeframe: tf.interval }, level: "ERROR" });
      return false;
    }
    return true;
  } catch (e) {
    log({ stage: "VERIFICATION_ERROR", message: `Verification error for ${symbol} @ ${tf.name}`, data: { error: e.message }, level: "ERROR" });
    if (CAPTURE_STRICT_VERIFICATION) {
      log({ stage: "READINESS_FAILURE", message: `Readiness verification error`, data: { failureStage: "VERIFICATION_ERROR", error: e.message }, level: "ERROR" });
      return false;
    }
  }

  return true;
}

async function sendBatchToServer(session_id, data) {
  const url = 'http://localhost:3000/api/vision/multi-tf';
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id, data })
    });
    log({ stage: "SERVER_UPLOAD", message: `Uploaded batch for session ${session_id}` });
  } catch (error) {
    log({ stage: "SERVER_UPLOAD_FAILURE", message: "Server communication failed", data: { error: error.message }, level: "ERROR" });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("tradingview.com")
  ) {
    if (injectedTabs.has(tabId)) {
      console.log("[EXT] Tab already injected:", tabId);
      return;
    }

    console.log("[EXT] Injecting content script and bridge into:", tab.url);
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    }).then(() => {
      injectedTabs.add(tabId);
      // Inject bridge into main world
      return chrome.scripting.executeScript({
        target: { tabId },
        files: ["bridge.js"],
        world: 'MAIN'
      });
    }).catch(err => {
      console.error("[EXT] Injection failed:", err);
    });
  }
});

// Clear tab from set when closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

let listenerCount = 0;
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  listenerCount++;
  console.log(`[DEBUG] chrome.runtime.onMessage.addListener called. Total listeners: ${listenerCount}`);
  console.log("[EXT] received message:", request);
  if (request.action === 'startCapture') {
    console.log("[DEBUG] startCapture TRIGGERED");

    if (isCapturing) {
      console.warn("[EXT] Capture already running → BLOCK");
      return;
    }

    isCapturing = true;

    (async () => {
      try {
        await captureMultiSymbolPipeline(sender.tab.id);
      } catch (err) {
        console.error("[Capture Pipeline] Fatal error:", err);
      } finally {
        isCapturing = false;
      }
    })();

    sendResponse({ started: true });
    return true;
  }
  if (request.action === 'exportForensics') {
    exportLogsToJson()
      .then((downloadId) => sendResponse({ success: true, downloadId }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request.action === 'queryAllLogs') {
    getAllLogsFromDB()
      .then((logs) => sendResponse({ success: true, logs }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request.action === 'log') {
    log(request.options);
    sendResponse({ success: true });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  console.log("[DEBUG] tab updated", tabId, changeInfo.status);
});
