/**
 * Capture Utilities
 */

async function attemptCapture() {
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      const lastError = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
      resolve({ dataUrl, lastError });
    });
  });
}

export async function captureTab() {
  const startTimestamp = Date.now();
  
  let activeTabId = null;
  let activeWindowId = null;
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      activeTabId = tabs[0].id;
      activeWindowId = tabs[0].windowId;
    }
  } catch (e) {}

  // Attempt #1
  let result = await attemptCapture();
  let attempt = 1;

  if (!result.dataUrl || result.lastError) {
    console.warn(`[Capture] Attempt 1 failed. Error: ${result.lastError}. Retrying in 250ms...`);
    await wait(250);
    // Attempt #2
    result = await attemptCapture();
    attempt = 2;
  }

  const endTimestamp = Date.now();
  const dataUrlLen = result.dataUrl ? result.dataUrl.length : 0;
  const dataUrlPrefix = result.dataUrl ? result.dataUrl.substring(0, 50) : "N/A";

  console.log(`[Capture-Audit] Detail:
    1. captureVisibleTab start: ${startTimestamp}
    2. captureVisibleTab end: ${endTimestamp}
    3. attempt: ${attempt}
    4. chrome.runtime.lastError.message: ${result.lastError}
    5. returned data URL length: ${dataUrlLen}
    6. returned data URL prefix: ${dataUrlPrefix}
    7. active tab id: ${activeTabId}
    8. active window id: ${activeWindowId}
  `);

  return {
    dataUrl: result.dataUrl,
    error: result.lastError,
    attempt,
    startTimestamp,
    endTimestamp,
    activeTabId,
    activeWindowId
  };
}

export async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
