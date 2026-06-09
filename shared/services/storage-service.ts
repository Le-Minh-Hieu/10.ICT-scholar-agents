
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getNYTime, getTradingDate, getICTSession, ICTSession } from '../utils/time-utils.js';
import { log } from '../utils/logger.js';
import { StandardPersistWrapper } from '../../types/system-results.js';

export interface InputMap {
  [asset: string]: string[];
}

export interface CaptureMetadata {
  primary_symbol: string;
  correlated_pairs: string[];
  macro: {
    dxy: boolean;
    rates: string[];
  };
  capture_id: string;
  timestamp_utc: string;
  timestamp_ny: string;
  day_of_week: string;
  is_market_open: boolean;
  session: ICTSession;
}

export interface CaptureStatus {
  input_complete: boolean;
  analysis_complete: boolean;
  has_primary: boolean;
  has_macro: boolean;
  has_ltf: boolean;
  missing: string[];
}

export interface TimelineEntry {
  capture_id: string;
  timestamp: string;
  session: ICTSession;
  execute: boolean;
  direction: string;
  confidence: string;
  score: number;
  htf_bias: string;
}

export class StorageService {
  private static BASE_DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

  private static estimateTokens(value: any): number {
    try {
      const raw = typeof value === 'string' ? value : JSON.stringify(value);
      return Math.ceil((raw?.length || 0) / 4);
    } catch {
      return 0;
    }
  }

  private static estimateSize(value: any): number {
    try {
      const raw = typeof value === 'string' ? value : JSON.stringify(value);
      return raw?.length || 0;
    } catch {
      return 0;
    }
  }

  private static summarizeImagePayload(value: string) {
    const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const mimeType = match?.[1] || 'image/jpeg';
    const base64 = match?.[2] || '';
    const byteLength = Math.floor((base64.length * 3) / 4);
    const sha256 = crypto.createHash('sha256').update(base64).digest('hex');

    return {
      kind: 'external_image_ref',
      mime_type: mimeType,
      size_bytes: byteLength,
      sha256_prefix: sha256.slice(0, 16),
      original_length: value.length,
    };
  }

  private static sanitizeInputSummary(inputSummary: any): any {
    if (inputSummary === null || inputSummary === undefined) {
      return inputSummary;
    }

    if (typeof inputSummary === 'string') {
      if (inputSummary.startsWith('data:image/')) {
        return this.summarizeImagePayload(inputSummary);
      }
      return inputSummary;
    }

    if (Array.isArray(inputSummary)) {
      return inputSummary.map((item) => this.sanitizeInputSummary(item));
    }

    if (typeof inputSummary !== 'object') {
      return inputSummary;
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(inputSummary)) {
      if (
        key === 'data' &&
        typeof value === 'string' &&
        value.length > 128 &&
        /^[A-Za-z0-9+/=]+$/.test(value)
      ) {
        const byteLength = Math.floor((value.length * 3) / 4);
        const sha256 = crypto.createHash('sha256').update(value).digest('hex');
        sanitized[key] = {
          kind: 'external_image_ref',
          size_bytes: byteLength,
          sha256_prefix: sha256.slice(0, 16),
          original_length: value.length,
        };
        continue;
      }

      sanitized[key] = this.sanitizeInputSummary(value);
    }

    return sanitized;
  }

  static getCapturePath(date: string, session: ICTSession, captureId: string): string {
    return path.join(this.BASE_DATA_DIR, date, session, 'captures', captureId);
  }

  static initCaptureDirectory(capturePath: string): void {
    const dirs = [
      path.join(capturePath, 'input'),
      path.join(capturePath, 'analysis'),
      path.join(capturePath, 'master'),
      path.join(capturePath, 'debug'),
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  static saveImage(capturePath: string, asset: string, timeframe: string, buffer: Buffer): void {
    const assetDir = path.join(capturePath, 'input', asset);
    if (!fs.existsSync(assetDir)) {
      fs.mkdirSync(assetDir, { recursive: true });
    }
    const filePath = path.join(assetDir, `${timeframe}.jpg`);
    fs.writeFileSync(filePath, buffer);
  }

  static saveJson(filePath: string, data: any): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    console.log("WRITING FILE:", filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  static saveCaptureArtifact(relativePath: string, data: any): void {
    const capturePath = (global as any).currentCapturePath;
    if (!capturePath) {
      log("PERSISTENCE_ERROR", `Cannot persist capture artifact: global.currentCapturePath is missing`, { relativePath }, "WARN");
      return;
    }

    try {
      const filePath = path.join(capturePath, relativePath);
      this.saveJson(filePath, data);
      log("PERSISTENCE_WRITE", "Persisted capture artifact", { filePath, relativePath }, "INFO");
    } catch (err) {
      log("PERSISTENCE_ERROR", "Failed to persist capture artifact", {
        relativePath,
        error: err instanceof Error ? err.message : String(err)
      }, "ERROR");
      throw err;
    }
  }

  static loadLatestScenarios(date: string, session: ICTSession): any | null {
    const sessionDir = path.join(this.BASE_DATA_DIR, date, session, 'captures');
    if (!fs.existsSync(sessionDir)) return null;

    const captures = fs.readdirSync(sessionDir).sort().reverse();
    for (const capId of captures) {
      const scenarioPath = path.join(sessionDir, capId, 'analysis', 'master', 'scenarios.json');
      if (fs.existsSync(scenarioPath)) {
        const data = this.readJson(scenarioPath);
        log({
          stage: "PERSIST_TRACE_2",
          message: "loadLatestScenarios loaded",
          data: {
            date,
            session,
            loaded_capture_id: capId,
            capture_count: data?.capture_count || null
          }
        });
        return data;
      }
    }
    return null;
  }

  static loadLatestTemporalState(date: string, session: ICTSession): any | null {
    const sessionDir = path.join(this.BASE_DATA_DIR, date, session, 'captures');

    log({ stage: 'TEMPORAL_LOAD_SCAN', message: 'Scanning temporal state candidates', data: { date, session, directory: sessionDir } });

    if (!fs.existsSync(path.join(this.BASE_DATA_DIR, date))) {
      log({ stage: 'TEMPORAL_LOAD_RESULT', message: 'Date folder missing', data: { found: false, reason: 'DATE_FOLDER_MISSING', date } });
      return null;
    }

    if (!fs.existsSync(sessionDir)) {
      log({ stage: 'TEMPORAL_LOAD_RESULT', message: 'Session folder missing', data: { found: false, reason: 'SESSION_FOLDER_MISSING', date, session } });
      return null;
    }

    const captures = fs.readdirSync(sessionDir).sort().reverse();
    const candidates: string[] = [];
    const filenameVariants = ['temporal_state.json', 'temporal-state.json'];

    for (const capId of captures) {
      for (const fname of filenameVariants) {
        const temporalPath = path.join(sessionDir, capId, 'analysis', 'master', fname);
        candidates.push(temporalPath);

        if (!fs.existsSync(temporalPath)) {
          // Candidate file not present, continue to next variant
          log({ stage: 'TEMPORAL_LOAD_REJECTED', message: 'Candidate missing', data: { file: temporalPath, reason: 'MISSING_FIELDS' } });
          continue;
        }

        try {
          const wrapper = this.readJson<any>(temporalPath);
          if (!wrapper) {
            log({ stage: 'TEMPORAL_LOAD_REJECTED', message: 'Parse failed', data: { file: temporalPath, reason: 'PARSE_FAILED' } });
            continue;
          }

          const data = wrapper?.data || null;
          if (!data) {
            log({ stage: 'TEMPORAL_LOAD_REJECTED', message: 'Missing data field in wrapper', data: { file: temporalPath, reason: 'MISSING_FIELDS' } });
            continue;
          }

          // Accept valid temporal state
          log({ stage: 'TEMPORAL_LOAD_ACCEPTED', message: 'Temporal state accepted', data: { file: temporalPath, loaded_capture_id: capId, capture_count: data?.capture_count || null } });
          return data;
        } catch (err: any) {
          log({ stage: 'TEMPORAL_LOAD_REJECTED', message: 'Read/parse failed', data: { file: temporalPath, reason: 'PARSE_FAILED', error: err?.message } });
          continue;
        }
      }
    }

    // Log candidate list for diagnostics
    log({ stage: 'TEMPORAL_LOAD_CANDIDATE', message: 'Temporal state candidate files scanned', data: { candidates } });

    log({ stage: 'TEMPORAL_LOAD_RESULT', message: 'No temporal state files found', data: { found: false, reason: 'NO_FILES_FOUND' } });
    return null;
  }

  /**
   * High-level persistence for all agents and orchestrators.
   */
  static persistAnalysisOutput(
    layer: string,
    componentName: string,
    data: any,
    status: "SUCCESS" | "FAIL" | "NO_DATA" = "SUCCESS",
    error: string | null = null,
    inputSummary: any = {},
    missingTfs: string[] = []
  ): void {
    try {
      const capturePath = (global as any).currentCapturePath;
      if (!capturePath) {
        log("PERSISTENCE_ERROR", `Cannot persist ${componentName}: global.currentCapturePath is missing`, { layer, componentName }, "ERROR");
        return;
      }

      const layerDir = path.join(capturePath, 'analysis', layer.toLowerCase());
      if (!fs.existsSync(layerDir)) {
        fs.mkdirSync(layerDir, { recursive: true });
      }

      const fileName = `${componentName.toLowerCase().replace(/-agent$/, "").replace(/-orchestrator$/, "")}.json`;
      const filePath = path.join(layerDir, fileName);

      const sanitizedInputSummary =
        this.sanitizeInputSummary(inputSummary);

      const wrapper: StandardPersistWrapper = {
        status,
        data,
        error,
        meta: {
          agent: componentName,
          timestamp: new Date().toISOString(),
          input_summary: sanitizedInputSummary,
          missing_tfs: missingTfs
        }
      };

      this.saveJson(filePath, wrapper);

      log("[STORAGE][SANITIZE]", "Sanitized persisted input summary", {
        captureId: (global as any).currentCaptureId || path.basename(capturePath),
        componentName,
        original_payload_size: this.estimateSize(inputSummary),
        sanitized_payload_size: this.estimateSize(sanitizedInputSummary),
        original_tokens_estimate: this.estimateTokens(inputSummary),
        sanitized_tokens_estimate: this.estimateTokens(sanitizedInputSummary),
      }, "INFO");

      log("PERSISTENCE_WRITE", `Persisted output for ${componentName}`, {
        layer,
        componentName,
        filePath,
        status
      }, "INFO");

    } catch (err) {
      log("PERSISTENCE_ERROR", `Failed to persist ${componentName}`, {
        layer,
        componentName,
        error: err instanceof Error ? err.message : String(err)
      }, "ERROR");
    }
  }

  static readJson<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  }

  static updateTimeline(date: string, session: ICTSession, entry: TimelineEntry): void {
    const timelinePath = path.join(this.BASE_DATA_DIR, date, session, 'timeline.json');
    let timeline: TimelineEntry[] = [];

    if (fs.existsSync(timelinePath)) {
      timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
    }

    const index = timeline.findIndex(e => e.capture_id === entry.capture_id);
    if (index !== -1) {
      timeline[index] = entry;
    } else {
      timeline.push(entry);
    }

    this.saveJson(timelinePath, timeline);
  }

  /**
   * Save the provided temporal state for the given date/session or current globals.
   */
  static saveTemporalState(temporalState: any, date?: string, session?: ICTSession): void {
    try {
      const d = date || (global as any).currentDate;
      const s = session || (global as any).currentSession;
      const captureId = (global as any).currentCaptureId;

      if (!d || !s) {
        log("PERSISTENCE_ERROR", 'Cannot save temporal state: missing date/session', { date: d, session: s }, "WARN");
        return;
      }

      const basePath = captureId
        ? path.join(this.BASE_DATA_DIR, d, s, 'captures', captureId, 'analysis', 'master')
        : path.join(this.BASE_DATA_DIR, d, s, 'captures');

      const dir = captureId ? basePath : path.join(this.BASE_DATA_DIR, d, s, 'analysis', 'master');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const filePath = path.join(dir, 'temporal_state.json');
      this.saveJson(filePath, { data: temporalState });
      log({ stage: 'TEMPORAL_SAVE_TRACE', message: 'Saved temporal state', data: { path: filePath, capture_count: temporalState?.capture_count } });
      log({
        stage: "PERSIST_TRACE_1",
        message: "Saved temporal state",
        data: {
          file_path: filePath,
          capture_count: temporalState?.capture_count
        }
      });
      log("PERSISTENCE_WRITE", `Saved temporal_state.json`, { path: filePath }, "INFO");
    } catch (err) {
      log("PERSISTENCE_ERROR", 'Failed to save temporal state', { error: err instanceof Error ? err.message : String(err) }, "ERROR");
    }
  }

  static saveScenarios(scenarios: any, date?: string, session?: ICTSession): void {
    try {
      const d = date || (global as any).currentDate;
      const s = session || (global as any).currentSession;
      const captureId = (global as any).currentCaptureId;

      if (!d || !s) {
        log("PERSISTENCE_ERROR", 'Cannot save scenarios: missing date/session', { date: d, session: s }, "WARN");
        return;
      }

      const dir = captureId
        ? path.join(this.BASE_DATA_DIR, d, s, 'captures', captureId, 'analysis', 'master')
        : path.join(this.BASE_DATA_DIR, d, s, 'analysis', 'master');

      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, 'scenarios.json');
      this.saveJson(filePath, scenarios);
      log("PERSISTENCE_WRITE", `Saved scenarios.json`, { path: filePath }, "INFO");
    } catch (err) {
      log("PERSISTENCE_ERROR", 'Failed to save scenarios', { error: err instanceof Error ? err.message : String(err) }, "ERROR");
    }
  }
}
