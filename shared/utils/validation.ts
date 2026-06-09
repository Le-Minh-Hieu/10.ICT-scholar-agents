import { log } from "./logger.js";

export const TF_MAP: Record<string, string> = {
  "1MO": "m",
  "1M": "m",
  "M": "m",
  "1W": "w",
  "W": "w",
  "1D": "d",
  "D": "d",
  "4H": "h4",
  "1H": "h1",
  "H1": "h1",
  "H4": "h4",
  "15m": "m15",
  "5m": "m5",
  "1m": "m1"
};

/**
 * Returns the required timeframes for a given symbol
 */
export function getRequiredTF(symbol: string): string[] {
  const macroSymbols = ["DXY", "US10Y", "US20Y"];

  if (macroSymbols.includes(symbol.toUpperCase())) {
    return ["m", "w", "d"];
  }

  return ["d", "h4", "h1"];
}

export interface SymbolData {
  [tf: string]: string | null | undefined;
}

export const INTERNAL_PIPELINE_KEYS = [
  "query",
  "newsEvents",
  "_inheritedTemporalState"
];

/**
 * Validates symbol data for completeness and integrity
 */
export function validateSymbolData(symbol: string, data: SymbolData): { valid: boolean; missing: string[]; errors: string[] } {
  const missing: string[] = [];
  const errors: string[] = [];
  const required = getRequiredTF(symbol);

  if (data == null || typeof data !== 'object') {
    errors.push("Symbol data is null or not an object");
    missing.push(...required);
    log({
      stage: "VALIDATION",
      message: `Validation failed for ${symbol}`,
      data: {
        symbol,
        missing,
        errors,
        status: "FAIL"
      },
      level: "WARN"
    });
    return { valid: false, missing, errors };
  }

  // Check required TFs
  for (const tf of required) {
    if (!data[tf]) {
      missing.push(tf);
    }
  }

  // Check for null/empty values in provided data
  for (const [tf, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === "") {
      errors.push(`Empty data for timeframe: ${tf}`);
    }
  }

  const valid = missing.length === 0 && errors.length === 0;

  if (!valid) {
    log({
      stage: "VALIDATION",
      message: `Validation failed for ${symbol}`,
      data: {
        symbol,
        missing,
        errors,
        status: "FAIL"
      },
      level: "WARN"
    });
  } else {
    log({
      stage: "VALIDATION",
      message: `Validation passed for ${symbol}`,
      data: {
        symbol,
        status: "SUCCESS"
      },
      level: "DEBUG"
    });
  }

  return { valid, missing, errors };
}

/**
 * Normalizes symbol names (e.g., eurusd -> EURUSD)
 */
export function normalizeSymbol(symbol: string): string {
  if (!symbol) return "";
  return symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Checks if symbol has minimum data to proceed with analysis
 */
export function hasMinimumData(symbol: string, data: SymbolData): boolean {
  const { valid, missing } = validateSymbolData(symbol, data);
  const required = getRequiredTF(symbol);
  
  if (missing.some(tf => required.includes(tf))) {
    log({
      stage: "PIPELINE_GUARD",
      message: `Insufficient data for ${symbol}. Missing required TFs: ${missing.join(", ")}`,
      data: {
        symbol,
        missing
      },
      level: "WARN"
    });
    return false;
  }
  
  return true;
}

export function isSymbolObject(obj: any): boolean {
  // Reject non-objects and arrays immediately
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;

  // Known metadata or pipeline objects (not symbol TF containers)
  const knownMetadataKeys = ['htf', 'itf', 'ltf', 'time', 'memory', 'query', 'confidence', '_pmso', '_raw', '_debug', 'parent_thesis', 'hydration_context', 'pmso_context', 'scenario_context', 'relational_context'];

  for (const k of knownMetadataKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return false;
  }

  // Recognized timeframe keys (both lower and upper variants)
  const tfKeys = ['d','h4','h1','m15','m5','m','D','H4','H1','M15','M5','M'];

  // A valid symbol object MUST contain at least one recognized timeframe key
  for (const tf of tfKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, tf)) return true;
  }

  return false;
}
