/**
 * TradingView Content Script - Stabilized Range Control
 */

// Feature Flags
const CAPTURE_MUTATION_GUARD = false;
const CAPTURE_VISUAL_STABILITY_V2 = true;
const CAPTURE_SERIES_STABILITY = false;

const CONTEXT_ID = Date.now();
window.TV_CONTEXT_ID = CONTEXT_ID;

// Benchmark tracking
window.TV_BENCHMARK_RESULTS = {
  oldHashTimes: [],
  fnvHashTimes: []
};

function getPercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function isContextValid() {
  return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

// 1. Cleanup: If we are a new script injection, always try to remove any old button 
// that might be from an invalidated context.
function cleanupOldUI() {
  document.querySelectorAll('#capture-all-tf-btn').forEach(btn => btn.remove());
}

cleanupOldUI();

window.addEventListener("message", (event) => {
  if (event.data && (event.data.action === "TV_BRIDGE_DIAGNOSTICS" || event.data.action === "TV_BRIDGE_DIAGNOVICS")) {
    console.log("[EXT-DIAGNOSTICS] Bridge Health:", event.data);
  }
  if (event.data && event.data.action === "QUERY_CAPTURE_LOGS") {
    chrome.runtime.sendMessage({ action: "queryAllLogs" }, (response) => {
      window.postMessage({
        action: "QUERY_CAPTURE_LOGS_RESPONSE",
        success: response && response.success,
        logs: response && response.logs,
        error: response && response.error
      }, "*");
    });
  }
  if (event.data && event.data.action === "EXPORT_CAPTURE_LOGS") {
    chrome.runtime.sendMessage({ action: "exportForensics" }, (response) => {
      window.postMessage({
        action: "EXPORT_CAPTURE_LOGS_RESPONSE",
        success: response && response.success,
        error: response && response.error
      }, "*");
    });
  }
});

function getLargestVisibleCanvas() {
  const canvases = document.querySelectorAll('canvas');
  let largestCanvas = null;
  let maxArea = 0;
  canvases.forEach(canvas => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const area = rect.width * rect.height;
      if (area > maxArea) {
        maxArea = area;
        largestCanvas = canvas;
      }
    }
  });
  return largestCanvas;
}

class VisualStabilityGuard {
  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 64;
    this.offscreenCanvas.height = 64;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
  }

  captureVisualHash() {
    const canvas = getLargestVisibleCanvas();
    if (!canvas) return null;

    this.offscreenCtx.clearRect(0, 0, 64, 64);
    try {
      this.offscreenCtx.drawImage(canvas, 0, 0, 64, 64);
    } catch (e) {
      return null;
    }

    try {
      const imgData = this.offscreenCtx.getImageData(0, 0, 64, 64).data;

      // FNV-1a 32-bit Hash
      let hash = 0x811c9dc5;
      for (let i = 0; i < imgData.length; i++) {
        hash ^= imgData[i];
        hash = (hash * 0x01000193) | 0;
      }
      return hash >>> 0;
    } catch (err) {
      return null;
    }
  }

  async awaitStability(timeoutMs = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let matchCount = 1;
      let lastHash = null;

      const checkStability = () => {
        if (Date.now() - startTime > timeoutMs) {
          console.warn("[Stability] Timeout waiting for visual stability.");
          resolve(false);
          return;
        }

        const currentHash = this.captureVisualHash();
        if (currentHash === null) {
          // If no canvas is found/visible yet, retry in 100ms
          setTimeout(checkStability, 100);
          return;
        }

        if (lastHash !== null) {
          if (currentHash === lastHash) {
            matchCount++;
          } else {
            matchCount = 1;
          }
        }

        lastHash = currentHash;

        if (matchCount >= 5) {
          resolve(true);
        } else {
          setTimeout(checkStability, 100);
        }
      };

      checkStability();
    });
  }
}

async function awaitMutationStability(quietPeriodMs = 300, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const chartArea = document.querySelector('.chart-container-border') ||
      document.querySelector('.layout__area--center') ||
      document.body;

    let lastMutationTime = Date.now();

    const observer = new MutationObserver(() => {
      lastMutationTime = Date.now();
    });

    observer.observe(chartArea, {
      childList: true,
      subtree: true,
      attributes: true
    });

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastMutationTime >= quietPeriodMs) {
        clearInterval(checkInterval);
        observer.disconnect();
        resolve(true);
      } else if (now - startTime > timeoutMs) {
        clearInterval(checkInterval);
        observer.disconnect();
        resolve(false);
      }
    }, 50);
  });
}

function normalizeTFHelper(tf) {
  if (!tf) return "";
  const raw = tf.toString().trim();
  const val = raw.toLowerCase();

  if (val === "d" || val === "1d") return "1D";
  if (val === "w" || val === "1w") return "1W";

  // Case-sensitive check for 1 Month vs 1 Minute
  if (raw === "1M" || raw === "M" || val === "1mo" || val === "mo") return "1M";

  if (raw === "1m" || raw === "m" || (val.endsWith("m") && !val.includes("mo") && raw !== "1M")) {
    return val.replace("m", "").toUpperCase();
  }

  if (val.endsWith("h")) {
    const hours = parseInt(val.replace("h", ""));
    if (!isNaN(hours)) return (hours * 60).toString();
  }
  return val.toUpperCase();
}

async function runReadinessSequence(expectedSymbol, expectedInterval, timeoutMs = 15000) {
  const startTime = Date.now();
  const metrics = {
    start: startTime,
    mutationTime: 0,
    visualTime: 0,
    bufferTime: 0,
    totalTime: 0
  };

  const gates = {
    symbolVerified: false,
    timeframeVerified: false,
    mutationReady: false,
    visualReady: false,
    bufferReady: false
  };

  // Stage 1: DOM Verification (Symbol and Timeframe Match Verification)
  const meta = getMetadata();
  if (expectedSymbol && meta.symbol !== 'UNKNOWN') {
    gates.symbolVerified = meta.symbol.toUpperCase().includes(expectedSymbol.toUpperCase());
  } else {
    gates.symbolVerified = true;
  }

  if (expectedInterval && meta.timeframe !== 'UNKNOWN') {
    const currentTFNorm = normalizeTFHelper(meta.timeframe);
    const expectedTFNorm = normalizeTFHelper(expectedInterval);
    gates.timeframeVerified = currentTFNorm === expectedTFNorm;
  } else {
    gates.timeframeVerified = true;
  }

  if (!gates.symbolVerified) {
    console.error("[Readiness Gate Blocked] symbolVerified = false. Expected symbol: " + expectedSymbol + ", Current: " + meta.symbol);
    return { stable: false, failureStage: "SYMBOL_MISMATCH", gates };
  }
  if (!gates.timeframeVerified) {
    console.error("[Readiness Gate Blocked] timeframeVerified = false. Expected interval: " + expectedInterval + ", Current: " + meta.timeframe);
    return { stable: false, failureStage: "TIMEFRAME_MISMATCH", gates };
  }

  console.log("[Diagnostic] READINESS_STEP_METADATA_OK");

  // Stage 2: Mutation Quiet Guard (300ms quiet window, 5000ms timeout)
  console.log('[Capture Pipeline] Stage 2: Awaiting MutationObserver quiet period...');
  const mutationStart = Date.now();
  const mutationStable = await awaitMutationStability(300, 5000);
  metrics.mutationTime = Date.now() - mutationStart;
  
  if (!mutationStable) {
    console.error("[Readiness Gate Blocked] mutationReady = false (Mutation quiet period timeout)");
    return { stable: false, failureStage: "MUTATION_TIMEOUT", gates };
  }
  gates.mutationReady = true;
  console.log("[Diagnostic] READINESS_STEP_MUTATION_OK");

  // Stage 3: Visual Stability Guard (Sample largest visible chart canvas, require 5 consecutive identical hashes)
  console.log('[Capture Pipeline] Stage 3: Awaiting Visual stability...');
  const visualStart = Date.now();
  const stabilityGuard = new VisualStabilityGuard();
  const visualStable = await stabilityGuard.awaitStability(5000);
  metrics.visualTime = Date.now() - visualStart;

  if (!visualStable) {
    console.error("[Readiness Gate Blocked] visualReady = false (Visual hash stability timeout)");
    return { stable: false, failureStage: "VISUAL_STABILITY_TIMEOUT", gates };
  }
  gates.visualReady = true;
  console.log("[Diagnostic] READINESS_STEP_VISUAL_OK");

  // Stage 4: Post-stability buffer (wait additional 200ms)
  console.log('[Capture Pipeline] Stage 4: Awaiting post-stability buffer (200ms)...');
  const bufferStart = Date.now();
  await new Promise(resolve => setTimeout(resolve, 200));
  metrics.bufferTime = Date.now() - bufferStart;
  gates.bufferReady = true;
  console.log("[Diagnostic] READINESS_STEP_BUFFER_OK");

  metrics.totalTime = Date.now() - startTime;

  console.log('[Capture Pipeline] All visual-first readiness gates passed successfully!');
  return {
    stable: true,
    details: {
      symbol: meta.symbol,
      resolution: meta.timeframe
    },
    metrics: metrics,
    gates
  };
}

function getMetadata() {
  const SYMBOL_SELECTORS = [
    '[data-name="header-symbol-search"]',
    '[data-name="legend-source-title"]',
    '#header-toolbar-symbol-search',
    '.chart-title-text',
    'span.value-JQZ0HKD4'
  ];

  const TIMEFRAME_SELECTORS = [
    'button[data-name="interval-dialog-button"]',
    '#header-toolbar-intervals',
    '[data-name="legend-resolution"]',
  ];

  let symbol = 'UNKNOWN';
  let timeframe = 'UNKNOWN';

  console.log('[EXT] Searching for symbol and timeframe...');

  // Find Symbol
  for (const selector of SYMBOL_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`[EXT] Found symbol with selector: ${selector}`);
      symbol = element.textContent.trim();
      break;
    }
  }

  // Find Timeframe
  for (const selector of TIMEFRAME_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`[EXT] Found timeframe with selector: ${selector}`);
      timeframe = element.textContent.trim();
      break;
    }
  }

  if (symbol === 'UNKNOWN') {
    console.log('[EXT] Could not find symbol with any of the selectors.');
  }

  if (timeframe === 'UNKNOWN') {
    console.log('[EXT] Could not find timeframe with any of the selectors.');
  }

  return { symbol, timeframe, timestamp: Date.now() };
}


async function changeSymbolAndResolution(symbol, resolution, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let resolved = false;

    const listener = (event) => {
      if (event.data && event.data.action === "CHANGE_SYMBOL_AND_RESOLUTION_RESPONSE") {
        resolved = true;
        window.removeEventListener("message", listener);
        if (event.data.error) {
          console.warn("[InternalState] changeSymbolAndResolution error:", event.data.error);
        }
        resolve(event.data);
      }
    };

    window.addEventListener("message", listener);

    window.postMessage({ action: "CHANGE_SYMBOL_AND_RESOLUTION", symbol: symbol, resolution: resolution }, "*");

    const checkTimeout = () => {
      if (resolved) return;
      if (Date.now() - startTime > timeoutMs) {
        resolved = true;
        window.removeEventListener("message", listener);
        resolve({ success: false, error: "Timeout", diagnostics: null });
      } else {
        setTimeout(checkTimeout, 100);
      }
    };
    checkTimeout();
  });
}

// Initialize always (SPA support)
window.TV_CAPTURE_LOADED = true;
window.CAPTURE_RUNNING = false;
console.log("[EXT] content script injected successfully");
initExtension();

function initExtension() {

  function getChartBoundingBox() {
    const chartArea = document.querySelector('.chart-container-border') ||
      document.querySelector('.layout__area--center') ||
      document.body;

    const rect = chartArea.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    };
  }

  async function processImage(dataUrl, box) {
    console.log("[Content-Crop] processImage entered. dataUrl length:", dataUrl ? dataUrl.length : 0, "box:", box);
    return new Promise((resolve, reject) => {
      if (!dataUrl) {
        console.error("[Content-Crop] Cannot process image: dataUrl is empty or undefined");
        reject(new Error("No dataUrl provided for image cropping"));
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const dpr = window.devicePixelRatio || 1;

          canvas.width = box.width;
          canvas.height = box.height;

          console.log("[Content-Crop] Drawing image on canvas with DPR:", dpr);
          ctx.drawImage(
            img,
            box.left * dpr, box.top * dpr, box.width * dpr, box.height * dpr,
            0, 0, box.width, box.height
          );

          const resultDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          console.log("[Content-Crop] processImage crop completed successfully. Result URL length:", resultDataUrl.length);
          resolve(resultDataUrl);
        } catch (e) {
          console.error("[Content-Crop] processImage crop error inside onload:", e);
          reject(e);
        }
      };
      img.onerror = (err) => {
        console.error("[Content-Crop] Image loading failed for dataUrl");
        reject(new Error("Image loading failed"));
      };
      img.src = dataUrl;
    });
  }

  /**
   * STABILIZED RANGE CONTROL
   */
  async function resetZoom() {
    console.log('[Capture Pipeline] Resetting zoom via zoom-in loop...');
    const chartArea = document.querySelector('.chart-container-border') ||
      document.querySelector('.layout__area--center') ||
      document.body;

    chartArea.focus();
    chartArea.click();
    await new Promise(r => setTimeout(r, 100));

    // FIX 2 — REDUCE ZOOM LOOP (from 120 to 30)
    for (let i = 0; i < 30; i++) {
      chartArea.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -120,
        ctrlKey: true,
        bubbles: true,
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 2
      }));
      if (i % 20 === 0) await new Promise(r => setTimeout(r, 10));
    }
    await new Promise(r => setTimeout(r, 200));
  }

  async function applyZoom(steps) {
    const chartArea = document.querySelector('.chart-container-border') ||
      document.querySelector('.layout__area--center') ||
      document.body;

    // FIX 3 — REMOVE VERIFICATION LOGIC (Label snapshot comparison removed)
    console.log(`[Capture Pipeline] Applying zoom: ${steps} steps`);

    for (let i = 0; i < steps; i++) {
      chartArea.dispatchEvent(new WheelEvent('wheel', {
        deltaY: 120,
        ctrlKey: true,
        bubbles: true,
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 2
      }));
      if (i % 10 === 0) await new Promise(r => setTimeout(r, 20));
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Listen for messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse('pong');
      return;
    }
    if (request.action === 'getMetadata') sendResponse(getMetadata());
    if (request.action === 'getChartBox') sendResponse(getChartBoundingBox());

    if (request.action === 'rangeControl') {
      (async () => {
        await resetZoom();
        if (request.steps > 0) {
          await applyZoom(request.steps);
        }
        sendResponse({ success: true });
      })();
      return true;
    }

    if (request.action === 'changeSymbolAndResolution') {
      (async () => {
        const response = await changeSymbolAndResolution(request.symbol, request.resolution);
        sendResponse(response);
      })();
      return true;
    }

    if (request.action === 'waitForCaptureReadiness') {
      (async () => {
        try {
          const res = await runReadinessSequence(request.expectedSymbol, request.expectedInterval, 15000);
          sendResponse({
            success: true,
            stable: res.stable,
            failureStage: res.failureStage || null,
            details: res.details,
            metrics: res.metrics,
            benchmark: res.benchmark,
            gates: res.gates
          });
        } catch (e) {
          sendResponse({
            success: false,
            stable: false,
            failureStage: "STABILIZATION_ERROR",
            error: e.message
          });
        }
      })();
      return true;
    }

    if (request.action === 'awaitVisibilityAndRepaint') {
      (async () => {
        try {
          if (document.visibilityState !== 'visible') {
            console.log("[Content-Visibility] document.visibilityState is", document.visibilityState, "- awaiting visibility change...");
            await new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                document.removeEventListener('visibilitychange', handler);
                console.warn("[Content-Visibility] VISIBILITY_TIMEOUT reached (3000ms)");
                reject(new Error("VISIBILITY_TIMEOUT"));
              }, 3000);

              const handler = () => {
                if (document.visibilityState === 'visible') {
                  clearTimeout(timeoutId);
                  document.removeEventListener('visibilitychange', handler);
                  console.log("[Content-Visibility] document.visibilityState changed to visible.");
                  resolve();
                }
              };

              document.addEventListener('visibilitychange', handler);
            });
          }

          // Wait two consecutive requestAnimationFrame cycles
          await new Promise((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          });

          sendResponse({ success: true, visibilityState: document.visibilityState });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (request.action === 'processImage') {
      processImage(request.dataUrl, request.box)
        .then(img => {
          console.log("[Content-Crop] Sending processImage success response.");
          sendResponse({ image: img });
        })
        .catch(err => {
          console.error("[Content-Crop] Sending processImage failure response:", err.message);
          sendResponse({ image: null, error: err.message });
        });
      return true;
    }
  });

  // UI Button
  function injectTriggerButton() {
    if (!isContextValid()) return;
    if (document.querySelector('#capture-all-tf-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'capture-all-tf-btn';
    btn.dataset.ctx = CONTEXT_ID;
    btn.textContent = '📸 Capture Intelligence';
    btn.style.cssText = 'position: fixed; top: 10px; left: 50%; transform: translateX(-50%); background: #2962ff; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; z-index: 9999;';

    btn.onclick = () => {
      if (btn.dataset.ctx != window.TV_CONTEXT_ID) {
        console.warn("stale button → removing");
        btn.remove();
        return;
      }

      if (!isContextValid()) {
        console.warn("[EXT] Extension context invalidated");
        btn.remove();
        return;
      }

      if (window.CAPTURE_RUNNING) {
        console.log("[EXT] Capture already running");
        return;
      }

      try {
        window.CAPTURE_RUNNING = true;
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.textContent = "⏳ Capturing...";

        console.log("[EXT] Button clicked - starting capture");
        console.log("[DEBUG] sending startCapture");
        chrome.runtime.sendMessage({ action: 'startCapture' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("[EXT] Message failed:", chrome.runtime.lastError);
            window.CAPTURE_RUNNING = false;
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.textContent = "📸 Capture Intelligence";
          }
        });
      } catch (err) {
        console.error("[EXT] sendMessage failed:", err);
        window.CAPTURE_RUNNING = false;
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.textContent = "📸 Capture Intelligence";
      }
    };

    document.body.appendChild(btn);
  }

  window.addEventListener("beforeunload", () => {
    cleanupOldUI();
  });

  function waitForDOM() {
    if (window.TV_INTERVAL) clearInterval(window.TV_INTERVAL);
    window.TV_INTERVAL = setInterval(() => {
      // CRITICAL: Stop interval if context is invalidated
      if (!isContextValid()) {
        clearInterval(window.TV_INTERVAL);
        return;
      }

      const root = document.body;
      if (root) {
        clearInterval(window.TV_INTERVAL);
        injectTriggerButton();
      }
    }, 1000);
  }

  waitForDOM();
}
