import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeImageLog, truncateLongStrings } from './log-utils.js';

const LOG_DIR = path.join(process.cwd(), 'shared', 'log');
const RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || '14', 10);

interface LoggerContext {
    sessionId: string;
    pipelineId: string;
    traceId: string;
    stream: fs.WriteStream;
    logFile: string;
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'TRACE';

const storage = new AsyncLocalStorage<LoggerContext>();

function getTimestamp() {
    return new Date().toISOString();
}

function createLogStream(sessionId: string, pipelineId: string): [fs.WriteStream, string] {
    const date = new Date().toISOString().split('T')[0];
    const sessionLogDir = path.join(LOG_DIR, date, sessionId);
    if (!fs.existsSync(sessionLogDir)) {
        fs.mkdirSync(sessionLogDir, { recursive: true });
    }
    const logFile = path.join(sessionLogDir, `${pipelineId}.jsonl`);
    const stream = fs.createWriteStream(logFile, { flags: 'a' });
    return [stream, logFile];
}

export async function runWithTracing<T>(
    fn: (traceId: string) => Promise<T>,
    sessionId?: string,
    pipelineId?: string
): Promise<T> {
    const sid = sessionId || uuidv4();
    const pid = pipelineId || 'main';
    const traceId = uuidv4();

    const [stream, logFile] = createLogStream(sid, pid);

    const context: LoggerContext = {
        sessionId: sid,
        pipelineId: pid,
        traceId,
        stream,
        logFile,
    };

    try {
        return await storage.run(context, () => fn(traceId));
    } finally {
        stream.end();
    }
}

interface LogOptions {
    level?: LogLevel;
    stage: string;
    message: string;
    data?: any;
    metrics?: Record<string, number>;
}

function normalizeLogOptions(
    optionsOrStage: LogOptions | string,
    messageOrData?: string | any,
    dataOrLevel?: any,
    levelArg?: LogLevel
): LogOptions {
    if (typeof optionsOrStage === 'string') {
        return {
            stage: optionsOrStage,
            message: typeof messageOrData === 'string' ? messageOrData : '',
            data: typeof messageOrData === 'string' ? dataOrLevel : messageOrData,
            level: typeof messageOrData === 'string' ? levelArg : undefined,
        };
    }

    return optionsOrStage;
}

function normalizeLogData(data: any): any {
    if (data instanceof Error) {
        return {
            name: data.name,
            message: data.message,
            stack: data.stack,
        };
    }
    return data;
}

export function log(options: LogOptions): void;
export function log(stage: string, message: string, data?: any, level?: LogLevel): void;
export function log(
    optionsOrStage: LogOptions | string,
    messageOrData?: string | any,
    dataOrLevel?: any,
    levelArg?: LogLevel
): void {
    const options = normalizeLogOptions(optionsOrStage, messageOrData, dataOrLevel, levelArg);
    const context = storage.getStore();
    if (!context) {
        console.warn('Logging outside of a trace context. Some information will be missing.');
        console.log(JSON.stringify({
            timestamp: getTimestamp(),
            level: options.level || 'INFO',
            stage: options.stage,
            message: options.message,
            data: options.data,
        }));
        return;
    }

    const { sessionId, pipelineId, traceId, stream } = context;

    const entry = {
        timestamp: getTimestamp(),
        sessionId,
        pipelineId,
        traceId,
        eventId: uuidv4(),
        level: options.level || 'INFO',
        stage: options.stage,
        message: options.message,
        data: options.data ? truncateLongStrings(sanitizeImageLog(normalizeLogData(options.data))) : undefined,
        metrics: options.metrics,
    };

    stream.write(JSON.stringify(entry) + '\n');
}

// Helper for pipeline stage transition
export async function withStage<T>(
    stage: string,
    fn: () => Promise<T>,
    startData?: any
): Promise<T> {
    const startTime = Date.now();
    log({ stage, message: `Entering stage: ${stage}`, data: startData, level: 'TRACE' });

    try {
        const result = await fn();
        const duration = Date.now() - startTime;
        log({
            stage,
            message: `Exiting stage: ${stage}`,
            metrics: { duration },
            level: 'TRACE',
        });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        log({
            stage,
            message: `Error in stage: ${stage}`,
            data: { error: error instanceof Error ? error.message : String(error) },
            metrics: { duration },
            level: 'ERROR',
        });
        throw error;
    }
}

export function getCurrentLogFile(): string | null {
    return storage.getStore()?.logFile || null;
}

export function cleanupLogs() {
    if (!fs.existsSync(LOG_DIR)) return;

    console.log(`[Logger] Cleaning logs older than ${RETENTION_DAYS} days...`);
    const now = Date.now();
    const dates = fs.readdirSync(LOG_DIR);
    let deletedCount = 0;

    dates.forEach(dateDir => {
        const datePath = path.join(LOG_DIR, dateDir);
        const dateMs = new Date(dateDir).getTime();
        if (isNaN(dateMs)) return; // Ignore non-date directories

        const diffDays = (now - dateMs) / (1000 * 60 * 60 * 24);
        if (diffDays > RETENTION_DAYS) {
            try {
                fs.rmSync(datePath, { recursive: true, force: true });
                console.log(`[Logger] Deleted old log directory: ${datePath}`);
                deletedCount++;
            } catch (err) {
                console.error(`[Logger] Failed to delete ${datePath}:`, err);
            }
        }
    });

    if (deletedCount > 0) {
        console.log(`[Logger] Deleted ${deletedCount} old log directories.`);
    }
}
