import { log as baseLog } from "../../shared/utils/logger.js";

type TraceData = { [k: string]: any };

function trace(stage: string, message: string, data: TraceData = {}, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
  // Ensure deterministic keys ordering for easier diffing in logs
  const ordered: TraceData = {} as any;
  Object.keys(data).sort().forEach(k => (ordered[k] = data[k]));
  baseLog({ stage, message, data: ordered, level: level === 'ERROR' ? 'ERROR' : level === 'WARN' ? 'WARN' : 'INFO' });
}

export { trace };

export default { trace };
