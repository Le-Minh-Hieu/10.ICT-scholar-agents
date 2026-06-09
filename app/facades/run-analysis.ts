import fs from "fs";
import path from "path";
import { runSystem } from "../../core/4.output/run-system.js";
import { StorageService, CaptureStatus, TimelineEntry } from "../../shared/services/storage-service.js";
import { log } from "../../shared/utils/logger.js";
import { TF_MAP, validateSymbolData, normalizeSymbol } from "../../shared/utils/validation.js";
import { ingestionController } from "../../core/news/ingestion/ingestion-controller";
import { SystemResult } from "../../types/system-results.js";

export async function runAnalysis(inputData: any, options?: { debug?: boolean; capturePath?: string }): Promise<SystemResult> {
  log({
    stage: "BOUNDARY_TRACE", message: "Starting runAnalysis", data: {
      stage: "runAnalysis",
      input: { capturePath: options?.capturePath, query: inputData?.query }
    }
  });

  const capturePath = options?.capturePath || (typeof inputData === 'string' ? inputData : null);
  if (capturePath) {
    (global as any).currentCapturePath = capturePath;

    // Inject Session Context from metadata
    const metadataPath = path.join(capturePath, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        (global as any).currentDate = metadata.timestamp_ny.split('T')[0];
        (global as any).currentSession = metadata.session;
        (global as any).currentCaptureId = metadata.capture_id;

        log({
          stage: "SESSION_CONTEXT", message: "Activated session context from metadata", data: {
            date: (global as any).currentDate,
            session: (global as any).currentSession,
            captureId: (global as any).currentCaptureId
          }
        });
      } catch (err: any) {
        log({ stage: "SESSION_CONTEXT_ERROR", message: "Failed to parse metadata for context injection", data: { error: err.message }, level: "WARN" });
      }
    }
  }

  let finalInput = inputData;

  if (typeof inputData === 'string' || options?.capturePath) {
    const capturePath = options?.capturePath || inputData;
    const inputDir = path.join(capturePath, 'input');

    if (!fs.existsSync(inputDir)) {
      log({ stage: "LINEAGE", message: "Input directory missing", data: { capturePath, inputDir }, level: "ERROR" });
      throw new Error(`Input directory missing: ${inputDir}`);
    }

    const assets = fs.readdirSync(inputDir);
    const symbolsData: Record<string, any> = {};

    for (const asset of assets) {
      const assetDir = path.join(inputDir, asset);
      if (!fs.lstatSync(assetDir).isDirectory()) continue;

      const symbol = normalizeSymbol(asset);
      const symbolKey = symbol.toLowerCase();
      symbolsData[symbolKey] = {};

      log({ stage: "LINEAGE", message: `Processing symbol: ${symbol}`, data: { stage: "runAnalysis", symbol } });

      const files = fs.readdirSync(assetDir);
      for (const file of files) {
        if (!file.endsWith(".jpg")) continue;

        const tf = file.replace(".jpg", "");
        const mapped = TF_MAP[tf];

        log({
          stage: "TF_MAPPING", message: `Mapping timeframe: ${tf} -> ${mapped || "FAILED"}`, data: {
            original: tf,
            mapped,
            success: !!mapped
          }
        });

        if (!mapped) {
          log({ stage: "TF_MAPPING_FAIL", message: `Unsupported timeframe: ${tf}`, data: { tf, symbol }, level: "WARN" });
          continue;
        }

        const filePath = path.join(assetDir, file);
        const image = fs.readFileSync(filePath, { encoding: "base64" });
        symbolsData[symbolKey][mapped] = `data:image/jpeg;base64,${image}`;

        log({
          stage: "LINEAGE", message: `Loaded image for ${symbol} @ ${mapped}`, data: {
            stage: "runAnalysis",
            symbol,
            tf: mapped,
            hasData: true
          }
        });
      }

      // Validation
      validateSymbolData(symbol, symbolsData[symbolKey]);
    }

    // Load PMSO context before running the system so pipeline can be anchored
    let pmsoContext = null;
    try {
      const date = (global as any).currentDate;
      const session = (global as any).currentSession;
      if (date && session) {
        pmsoContext = StorageService.loadLatestTemporalState(date, session);
      }
      log({
        stage: "TEMPORAL_TRACE_1",
        message: "Loaded temporal state at runAnalysis",
        data: {
          date,
          session,
          loaded: !!pmsoContext,
          capture_count: pmsoContext?.capture_count,
          structures: pmsoContext?.structures?.length
        }
      });
    } catch (_) { }

    finalInput = {
      ...symbolsData,
      query: inputData?.query || "analyze current market",
      newsEvents: ingestionController.getAcceptedEvents(),
      _inheritedTemporalState: pmsoContext
    };
  }

  log({
    stage: "BOUNDARY_TRACE", message: "runAnalysis calling runSystem", data: {
      stage: "runAnalysis -> runSystem",
      input: {
        symbols: Object.keys(finalInput).filter(
          k =>
            ![
              'query',
              'newsEvents',
              '_inheritedTemporalState'
            ].includes(k)
        ),
        debug: options?.debug
      }
    }
  });

  const result = await runSystem(finalInput, {
    debug: options?.debug,
    capturePath: options?.capturePath
  });

  log({
    stage: "BOUNDARY_TRACE", message: "runSystem complete, returning to runAnalysis", data: {
      stage: "runSystem -> runAnalysis",
      output: {
        execute: result.execute,
        direction: result.direction,
        confidence: result.confidence
      }
    }
  });

  if (capturePath) {
    // Save the full result
    const fullJsonPath = path.join(capturePath, 'full.json');
    StorageService.saveJson(fullJsonPath, result);
    log({ stage: "PERSISTENCE", message: "Saved full.json", data: { path: fullJsonPath } });

    // Save the master decision
    if (result.layers.master) {
      const decisionPath = path.join(capturePath, 'master', 'decision.json');
      StorageService.saveJson(decisionPath, result.layers.master);
      log({ stage: "PERSISTENCE", message: "Saved master/decision.json", data: { path: decisionPath } });
    }
  }

  return result;
}
