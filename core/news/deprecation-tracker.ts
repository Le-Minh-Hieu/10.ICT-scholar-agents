import { log } from "../../shared/utils/logger.js";
import { StorageService } from "../../shared/services/storage-service.js";

export function markDeprecated(path: string, info: any) {
  const entry = {
    path,
    info,
    timestamp: new Date().toISOString()
  };
  try {
    log({ stage: "DEPRECATION_TRACK", message: `Deprecated path used: ${path}`, data: entry });
    // persist small deprecation telemetry for later review
    StorageService.persistAnalysisOutput("deprecation", path + "_" + Date.now().toString(), entry);
  } catch (e: any) {
    log({ stage: "DEPRECATION_TRACK", message: "Failed to persist deprecation entry", data: { error: e?.message }, level: "WARN" });
  }
}

export default markDeprecated;
