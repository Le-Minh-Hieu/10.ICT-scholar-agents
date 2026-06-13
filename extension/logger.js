const LOG_SERVER_URL = 'http://localhost:3000/api/log';

// Durability configuration
const LOG_PERSISTENCE_MODE = "indexeddb";

let sessionId = null;
let pipelineId = null;
let traceId = null;

let db = null;
const dbQueue = [];

// Initialize database with keyPath matching autoincrement
try {
  const request = indexedDB.open("LoggerDB", 1);
  request.onupgradeneeded = (event) => {
    const database = event.target.result;
    if (!database.objectStoreNames.contains("logs")) {
      database.createObjectStore("logs", { keyPath: "id", autoIncrement: true });
    }
  };
  request.onsuccess = (event) => {
    db = event.target.result;
    while (dbQueue.length > 0) {
      const task = dbQueue.shift();
      task();
    }
    runStartupRecovery();
  };
  request.onerror = (event) => {
    console.error("[EXT-LOGGER] DB failed to open:", event.target.error);
  };
} catch (e) {
  console.error("[EXT-LOGGER] IndexedDB setup exception:", e);
}

function runInTransaction(mode, callback) {
  const execute = () => {
    try {
      const transaction = db.transaction(["logs"], mode);
      const store = transaction.objectStore("logs");
      callback(store);
    } catch (e) {
      console.error("[EXT-LOGGER] Transaction error:", e);
    }
  };
  if (db) {
    execute();
  } else {
    dbQueue.push(execute);
  }
}

function getTimestamp() {
  return new Date().toISOString();
}

export function initTracer(sId, pId, tId) {
  sessionId = sId;
  pipelineId = pId;
  traceId = tId;
  flushLogs();
}

export function log(options) {
  const entry = {
    timestamp: getTimestamp(),
    sessionId,
    pipelineId,
    traceId,
    eventId: self.crypto.randomUUID(),
    level: options.level || 'INFO',
    stage: options.stage,
    message: options.message,
    data: options.data,
    metrics: options.metrics,
    status: "PENDING",
    retry_count: 0
  };

  // Write-ahead logging: direct persistence to DB before returning
  runInTransaction("readwrite", (store) => {
    store.add(entry);
  });
}

export async function flushLogs() {
  runInTransaction("readwrite", (store) => {
    const cursorReq = store.openCursor();
    const pendingLogs = [];
    const logIds = [];

    cursorReq.onsuccess = async (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const val = cursor.value;
        if (val.status === "PENDING" || val.status === "FAILED") {
          pendingLogs.push(val);
          logIds.push(cursor.key);
        }
        cursor.continue();
      } else {
        if (pendingLogs.length === 0) return;

        try {
          await fetch(LOG_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pendingLogs),
          });

          // Mark SENT
          runInTransaction("readwrite", (updateStore) => {
            logIds.forEach(id => {
              const getReq = updateStore.get(id);
              getReq.onsuccess = () => {
                const data = getReq.result;
                if (data) {
                  data.status = "SENT";
                  updateStore.put(data);
                }
              };
            });
          });
        } catch (error) {
          console.error('[EXT-LOGGER] Flush failed:', error);
          // Mark FAILED and increment retry_count
          runInTransaction("readwrite", (updateStore) => {
            logIds.forEach(id => {
              const getReq = updateStore.get(id);
              getReq.onsuccess = () => {
                const data = getReq.result;
                if (data) {
                  data.status = "FAILED";
                  data.retry_count = (data.retry_count || 0) + 1;
                  updateStore.put(data);
                }
              };
            });
          });
        }
      }
    };
  });
}

function runRetentionCleanup() {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  runInTransaction("readwrite", (store) => {
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const val = cursor.value;
        const logTime = new Date(val.timestamp).getTime();
        if (logTime < sevenDaysAgo) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  });
}

function runStartupRecovery() {
  runRetentionCleanup();
  flushLogs();
}

export function getAllLogsFromDB() {
  return new Promise((resolve, reject) => {
    runInTransaction("readonly", (store) => {
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  });
}

export function exportLogsToJson() {
  return new Promise((resolve, reject) => {
    runInTransaction("readonly", (store) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const allLogs = request.result || [];
        const jsonStr = JSON.stringify(allLogs, null, 2);
        try {
          const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
          const url = 'data:application/json;base64,' + base64;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          chrome.downloads.download({
            url: url,
            filename: `capture-forensics-${timestamp}.json`,
            saveAs: false
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(downloadId);
            }
          });
        } catch (e) {
          reject(e);
        }
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  });
}

// 10s worker interval
setInterval(flushLogs, 10000);

// Flush when tab is suspending
self.addEventListener('suspend', () => {
  flushLogs();
});
