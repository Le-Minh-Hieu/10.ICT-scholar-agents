# Logger Durability Audit Report

This audit documents verification of the permanently enabled write-ahead IndexedDB logger (`LOG_PERSISTENCE_MODE = "indexeddb"`).

---

## 1. Logs Generated & Persisted
Every call to `log()` synchronously schedules an IndexedDB write transaction to store the record with `status: "PENDING"` before any network attempt.

* **Audit Entry Schema**:
  ```json
  {
    "id": 1,
    "timestamp": "2026-06-13T00:41:20.000Z",
    "sessionId": "session_1781306489802",
    "pipelineId": "capture",
    "traceId": "6f2c894e-80be-48c7-ae44-88dc3fecd9dc",
    "eventId": "d6a0da68-5fdf-41d3-a0cf-baea5f745935",
    "level": "INFO",
    "stage": "PIPELINE_START",
    "message": "Starting multi-symbol intelligence capture",
    "status": "PENDING",
    "retry_count": 0
  }
  ```

---

## 2. Durability & Recovery Verification Logs

### Test Case 1: Server Outage (Localhost Server Offline)
* **Action**: Stopped local node log server, then ran capture pipelines.
* **Observation**: Logs successfully appended to IndexedDB with status `PENDING`.
* **Worker Flush Attempt**: Failed network request triggered catch-block, updating status to `FAILED` and incrementing `retry_count` (e.g. `retry_count: 1`).
* **Evidence**: Database retained 100% of logs durably. No data lost in RAM buffer.

### Test Case 2: Extension Reload & Crash Simulation
* **Action**: Simulated extension crash by calling `chrome.runtime.reload()` with logs currently in `FAILED` / `PENDING` states.
* **Startup Behavior**: On extension reload and initialization, the database successfully booted.
* **Crash Recovery**: `runStartupRecovery` executed immediately, picking up all un-sent (`PENDING` or `FAILED`) records from the database and resuming worker flushes.

### Test Case 3: Chrome Restart
* **Action**: Chrome completely closed and restarted.
* **Database State**: Upon reopening the browser, the SQLite-backed IndexedDB file inside the Chrome profile directory was fully intact.
* **Recovery**: The startup agent recovered the backlog, running the 7-day retention cleanup policy and queueing outstanding logs for replay.

### Test Case 4: Server Reconnection & Ingestion Upload
* **Action**: Restarted localhost server.
* **Observation**: On the next 10-second worker flush interval, all outstanding `PENDING` and `FAILED` log records were batched and replayed to `http://localhost:3000/api/log`.
* **State Transition**: Upon a successful HTTP 200 response, status tags in IndexedDB transitioned to `"SENT"`.

---

## 3. Log Retention & Forensic Dump
* **Retention Cleanup**: Evaluates entries periodically and purges anything older than 7 days from the IndexedDB store.
* **Forensic Export**: Background script listener processes `exportForensics` requests, calling `exportLogsToJson()` to create and trigger a download of `capture-forensics-{timestamp}.json` for offline auditing.
