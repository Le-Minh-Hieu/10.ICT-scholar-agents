console.log("🔥 CORRECT SERVER FILE LOADED");
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runAnalysis } from './app/facades/run-analysis.js';
import { getTradingDate, getICTSession, getNYTime, isMarketOpen, getNYDayOfWeek } from './shared/utils/time-utils.js';
import { StorageService } from './shared/services/storage-service.js';
import { ValidationService } from './shared/services/validation-service.js';
import { sanitizeImageLog } from './shared/utils/log-utils.js';
import { runWithTracing, log, cleanupLogs } from './shared/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.send('Capture Pipeline Server is running. Use POST /api/vision/multi-tf for data.');
});

/**
 * POST /api/vision/multi-tf
 * Receive batch of images for multiple symbols and timeframes
 * AUTO-FLOW INTEGRATED
 */
app.post('/api/vision/multi-tf', async (req, res) => {
  runWithTracing(async () => {
    const { data } = req.body; // session_id from extension is ignored in favor of backend generation

    if (!data) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Hard-fail validation for required timeframes
    const requiredTFs = { "EURUSD": ["1MO", "1W", "1D"], "GBPUSD": ["1MO", "1W", "1D"], "DXY": ["1MO", "1W", "1D"] };
    for (const symbol in requiredTFs) {
      if (!data[symbol]) {
        const errorMsg = `Validation failed: Missing symbol ${symbol}`;
        log("SERVER", errorMsg, { symbol }, "ERROR");
        return res.status(400).json({ success: false, error: errorMsg });
      }
      const receivedTFs = new Set(data[symbol].map(item => item.timeframe));
      for (const tf of requiredTFs[symbol]) {
        if (!receivedTFs.has(tf)) {
          const errorMsg = `Validation failed: Missing timeframe ${tf} for ${symbol}`;
          log("SERVER", errorMsg, { symbol, timeframe: tf }, "ERROR");
          return res.status(400).json({ success: false, error: errorMsg });
        }
      }
    }

    log("BOUNDARY_TRACE", "Server received Multi-TF data", {
      stage: "Server",
      input: { symbols: Object.keys(data) }
    });

    try {
      const now = new Date();
      const date = getTradingDate(now);
      const session = getICTSession(now);
      const capture_id = Date.now().toString();
      const capturePath = StorageService.getCapturePath(date, session, capture_id);

      log({ stage: "INGESTION_START", message: `Starting Auto-Flow for Capture ${capture_id} (${session})`, data: { capture_id, session } });

      // 1. Initialize Directory
      StorageService.initCaptureDirectory(capturePath);

      // 2. Save Images & Build Input Map
      let totalSaved = 0;
      const inputMap = {};

      for (const symbol in data) {
        inputMap[symbol] = [];
        const images = data[symbol];
        for (const item of images) {
          const { timeframe, image } = item;
          if (!timeframe || !image) continue;

          const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');

          const filePath = StorageService.saveImage(capturePath, symbol, timeframe, buffer);
          log({ stage: "IMAGE_SAVE", message: `Saved image for ${symbol} @ ${timeframe}`, data: { symbol, timeframe, path: filePath, size: buffer.length } });
          inputMap[symbol].push(timeframe);
          totalSaved++;
        }
      }

      // 3. Save Metadata
      const primarySymbol = Object.keys(data).find(s => ['EURUSD', 'GBPUSD'].includes(s)) || Object.keys(data)[0];
      const metadata = {
        primary_symbol: primarySymbol,
        correlated_pairs: Object.keys(data).filter(s => s !== primarySymbol && !['DXY', 'US10Y', 'US20Y'].includes(s)),
        macro: {
          dxy: !!data['DXY'],
          rates: ['US10Y', 'US20Y'].filter(s => !!data[s])
        },
        capture_id,
        timestamp_utc: now.toISOString(),
        timestamp_ny: getNYTime(now),
        day_of_week: getNYDayOfWeek(now),
        is_market_open: isMarketOpen(now),
        session
      };
      StorageService.saveJson(path.join(capturePath, 'metadata.json'), metadata);
      log({ stage: "METADATA_SAVE", message: "Saved metadata.json", data: { capturePath } });

      // 4. Save Input Map
      StorageService.saveJson(path.join(capturePath, 'input_map.json'), inputMap);

      // 5. Run Validation & Save Status
      const status = ValidationService.validateInput(inputMap);
      StorageService.saveJson(path.join(capturePath, 'status.json'), status);
      log({ stage: "VALIDATION", message: "Input validation complete", data: { status } });

      // 6. Prepare Analysis Input (Transformation to match agent expectations)
      const mapTF = (tf) => {
        const map = {
          "1MO": "m", "1W": "w", "1D": "d",
          "4H": "h4", "1H": "h1", "15m": "m15",
          "5m": "m5", "1m": "m1"
        };
        return map[tf] || tf.toLowerCase();
      };

      const analysisInput = {
        query: "analyze current market"
      };

      for (const symbol in data) {
        const symbolKey = symbol.toLowerCase();
        analysisInput[symbolKey] = {};
        data[symbol].forEach(item => {
          const mappedTF = mapTF(item.timeframe);
          analysisInput[symbolKey][mappedTF] = item.image;
        });
      }

      log("BOUNDARY_TRACE", "Images saved, triggering analysis", {
        stage: "Server -> runAnalysis",
        input: { capturePath, totalSaved }
      });

      // 7. AUTO-TRIGGER Analysis
      // We run it and wait for it to return the response to the UI
      log({ stage: "DEBUG_ANALYSIS", message: "Attempting to call runAnalysis...", data: { capturePath } });
      const analysisResult = await runAnalysis(analysisInput, { capturePath });
      try {
        if (analysisResult?._pmso) {
          StorageService.saveTemporalState(analysisResult._pmso);
        }

        if (analysisResult?.scenarios) {
          StorageService.saveScenarios(analysisResult.scenarios);
        }
      } catch (e) {
        console.warn('[Server] Failed to persist PMSO state:', e);
      }
      log({ stage: "DEBUG_ANALYSIS", message: "runAnalysis call completed.", data: { capturePath, hasResult: !!analysisResult } });

      log("BOUNDARY_TRACE", "Analysis complete", {
        stage: "runAnalysis -> Server",
        output: { success: true, capture_id }
      });

      // UPDATE TIMELINE
      try {
        const timelineEntry = {
          capture_id,
          timestamp: now.toISOString(),
          session,
          execute: analysisResult.execute,
          direction: analysisResult.direction,
          confidence: analysisResult.confidence.toString(),
          score: analysisResult.score,
          htf_bias: analysisResult.layers.htf?.htf_bias || 'neutral'
        };
        StorageService.updateTimeline(date, session, timelineEntry);
        log({ stage: "TIMELINE_UPDATE", message: "Timeline updated successfully", data: { capture_id } });
      } catch (error) {
        log({ stage: "TIMELINE_UPDATE_ERROR", message: "Failed to update timeline", data: { capture_id, error: error.message } }, "ERROR");
      }

      res.json({
        success: true,
        capture_id,
        date,
        session,
        status,
        analysis: analysisResult
      });

    } catch (error) {
      log({ stage: "DEBUG_ANALYSIS_ERROR", message: "CRITICAL: Error occurred during runAnalysis auto-trigger.", data: { error: error.message, stack: error.stack } }, "ERROR");
      log("SERVER", "Error in multi-tf auto-flow", { error: error.message }, "ERROR");
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

app.post('/api/analyze-session', async (req, res) => {
  console.log("!!! ANALYZE-SESSION ROUTE HANDLER HIT !!!");
  runWithTracing(async () => {
    const { session_id, debug } = req.body;

    if (!session_id) {
      return res.status(400).json({ success: false, error: 'Missing session_id' });
    }

    log("SERVER", "Received Analyze Session Request", { session_id });

    try {
      // Note: session_id here is expected to be a full capturePath
      const result = await runAnalysis(session_id, { debug, capturePath: session_id });

      // Persist PMSO and scenarios after successful run so subsequent captures can inherit state
      try {
        if (result?._pmso) {
          StorageService.saveTemporalState(result._pmso);
        }
        if (result?.scenarios) {
          StorageService.saveScenarios(result.scenarios);
        }
      } catch (e) {
        console.warn('[Server] Failed to persist PMSO state:', e);
      }

      res.json({
        success: true,
        session_id,
        analysis: result
      });
    } catch (err) {
      log("SERVER", "Error in analyze-session", { error: err.message }, "ERROR");
      res.status(500).json({ success: false, error: err.message });
    }
  });
});

import { runSystem } from './core/4.output/run-system.js';
import { startAdapters } from './core/news/ingestion/start-adapters.js';

app.post('/api/analyze', async (req, res) => {
  runWithTracing(async () => {
    try {
      log("SERVER", "Received Direct Analysis Request", req.body);
      const result = await runSystem(req.body);

      res.json({
        success: true,
        analysis: result
      });
    } catch (err) {
      log("SERVER", "Error in direct analyze", { error: err.message }, "ERROR");
      res.status(500).json({ success: false, error: err.message });
    }
  });
});

app.get('/api/sessions', (req, res) => {
  try {
    const sessionsDir = path.join(__dirname, 'data', 'sessions');
    if (!fs.existsSync(sessionsDir)) {
      return res.json({ success: true, sessions: {} });
    }

    const dates = fs.readdirSync(sessionsDir).sort().reverse();
    const result = {};

    for (const date of dates) {
      const dateDir = path.join(sessionsDir, date);
      if (fs.lstatSync(dateDir).isDirectory()) {
        const sessions = fs.readdirSync(dateDir).filter(s =>
          fs.lstatSync(path.join(dateDir, s)).isDirectory()
        );
        result[date] = sessions;
      }
    }

    res.json({
      success: true,
      sessions: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/capture', (req, res) => {
  const { date, session, capture_id } = req.query;
  if (!date || !session || !capture_id) {
    return res.status(400).json({ success: false, error: 'Missing parameters' });
  }

  try {
    const capturePath = StorageService.getCapturePath(date, session, capture_id);
    const fullResult = StorageService.readJson(path.join(capturePath, 'full.json'));
    const status = StorageService.readJson(path.join(capturePath, 'status.json'));
    const metadata = StorageService.readJson(path.join(capturePath, 'metadata.json'));

    res.json({
      success: true,
      date,
      session,
      capture_id,
      analysis: fullResult,
      status,
      metadata
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/session/timeline', (req, res) => {
  const { date, session } = req.query;
  if (!date || !session) {
    return res.status(400).json({ success: false, error: 'Missing date or session' });
  }

  try {
    const timelinePath = path.join(__dirname, 'data', 'sessions', date, session, 'timeline.json');
    if (!fs.existsSync(timelinePath)) {
      return res.json({ success: true, timeline: [] });
    }
    const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
    res.json({ success: true, timeline });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/session/:date/:session/captures/:capture_id/analysis/:layer/:agent', (req, res) => {
  const { date, session, capture_id, layer, agent } = req.params;
  try {
    const capturePath = StorageService.getCapturePath(date, session, capture_id);
    const layerDir = path.join(capturePath, 'analysis', layer.toLowerCase());

    if (!fs.existsSync(layerDir)) {
      return res.status(404).json({ success: false, error: 'Layer directory not found' });
    }

    // Try to find the file with various naming conventions used by StorageService
    const possibleFiles = [
      `${agent.toLowerCase()}.json`,
      `${layer.toLowerCase()}-${agent.toLowerCase()}.json`,
      `${layer.toLowerCase()}-${agent.toLowerCase().replace('-', '')}.json`,
      `${agent.toLowerCase().replace('-', '')}.json`
    ];

    let foundFile = null;
    for (const file of possibleFiles) {
      const fullPath = path.join(layerDir, file);
      if (fs.existsSync(fullPath)) {
        foundFile = fullPath;
        break;
      }
    }

    if (!foundFile) {
      return res.status(404).json({ success: false, error: `Agent data not found for ${agent} in ${layer}` });
    }

    const data = JSON.parse(fs.readFileSync(foundFile, 'utf-8'));
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/latest-capture', (req, res) => {
  try {
    const sessionsDir = path.join(__dirname, 'data', 'sessions');
    if (!fs.existsSync(sessionsDir)) {
      return res.json({ success: false, error: 'No sessions yet' });
    }

    const dates = fs.readdirSync(sessionsDir).sort().reverse();
    if (dates.length === 0) return res.json({ success: false, error: 'No dates' });

    const latestDate = dates[0];
    const sessionsDirForDate = path.join(sessionsDir, latestDate);
    const sessions = fs.readdirSync(sessionsDirForDate);
    if (sessions.length === 0) return res.json({ success: false, error: 'No sessions for date' });

    // Find the latest capture across all sessions for the date
    let latestCapture = null;
    let latestTime = 0;

    for (const session of sessions) {
      const capturesDir = path.join(sessionsDirForDate, session, 'captures');
      if (fs.existsSync(capturesDir)) {
        const captures = fs.readdirSync(capturesDir);
        for (const capId of captures) {
          const capTime = parseInt(capId);
          if (capTime > latestTime) {
            latestTime = capTime;
            latestCapture = { date: latestDate, session, capture_id: capId };
          }
        }
      }
    }

    if (!latestCapture) return res.json({ success: false, error: 'No captures found' });

    const capturePath = StorageService.getCapturePath(latestCapture.date, latestCapture.session, latestCapture.capture_id);
    const fullResult = StorageService.readJson(path.join(capturePath, 'full.json'));
    const status = StorageService.readJson(path.join(capturePath, 'status.json'));
    const metadata = StorageService.readJson(path.join(capturePath, 'metadata.json'));

    res.json({
      success: true,
      ...latestCapture,
      analysis: fullResult,
      status,
      metadata
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/log', (req, res) => {
  const logs = req.body;
  if (!Array.isArray(logs)) {
    return res.status(400).json({ success: false, error: 'Invalid payload. Expected an array of logs.' });
  }

  for (const logEntry of logs) {
    const { sessionId, pipelineId } = logEntry;
    if (!sessionId || !pipelineId) {
      console.warn('[Server] Received log entry without sessionId or pipelineId:', logEntry);
      continue;
    }

    try {
      const date = new Date(logEntry.timestamp).toISOString().split('T')[0];
      const sessionLogDir = path.join(__dirname, 'shared', 'log', date, sessionId);
      if (!fs.existsSync(sessionLogDir)) {
        fs.mkdirSync(sessionLogDir, { recursive: true });
      }
      const logFile = path.join(sessionLogDir, `${pipelineId}.jsonl`);
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('[Server] Failed to write log entry:', error);
    }
  }

  res.status(202).json({ success: true });
});

cleanupLogs();

const enableShadowRunner = String(process.env.ENABLE_SHADOW_RUNNER || '').toLowerCase() === 'true';

// Start adapters in shadow-only mode; failures must not prevent server boot
try {
  startAdapters().catch((err) => {
    log({ stage: 'NEWS_ADAPTER_START_FAIL', message: 'Async adapter startup failed', data: { error: err?.message }, level: 'ERROR' });
  });
} catch (err) {
  log({ stage: 'NEWS_ADAPTER_START_FAIL', message: 'Adapter startup threw', data: { error: err?.message }, level: 'ERROR' });
}

if (enableShadowRunner) {
  // Optional live news loop for runtime monitoring only.
  try {
    import('./core/news/shadow/shadow-runner.js')
      .then((m) => {
        if (typeof m.startShadowRunner === 'function') {
          m.startShadowRunner().catch((err) => {
            log({ stage: 'SHADOW_RUNNER_BOOT_FAIL', message: 'Shadow runner failed to start', data: { error: err?.message }, level: 'ERROR' });
          });
          console.info('SHADOW_RUNNER_BOOT', { mode: 'enabled' });
        } else {
          log({ stage: 'SHADOW_RUNNER_BOOT_FAIL', message: 'startShadowRunner not exported', data: {}, level: 'ERROR' });
        }
      })
      .catch((err) => {
        log({ stage: 'SHADOW_RUNNER_BOOT_FAIL', message: 'Dynamic import failed', data: { error: err?.message }, level: 'ERROR' });
      });
  } catch (err) {
    log({ stage: 'SHADOW_RUNNER_BOOT_FAIL', message: 'Shadow runner import threw', data: { error: err?.message }, level: 'ERROR' });
  }
} else {
  log({
    stage: 'SHADOW_RUNNER_DISABLED',
    message: 'Shadow runner disabled for capture-only server mode',
    data: {
      enableShadowRunner
    }
  });
}

console.log("UNIFIED AI STACK ACTIVE");
console.log(`AUTH MODE: GOOGLE CLOUD ADC`);
console.log(`SDK: @google/genai (Vertex AI Routing)`);
console.log(`PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT}`);
console.log(`LOCATION: ${process.env.GOOGLE_CLOUD_LOCATION}`);

app.listen(PORT, () => {
  console.log(`[Capture Pipeline Server] Running on http://localhost:${PORT}`);
});
