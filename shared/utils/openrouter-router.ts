import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { log } from "./logger.js";

const CACHE_FILE = path.join(process.cwd(), "data", "openrouter-models-cache.json");
const RELIABILITY_FILE = path.join(process.cwd(), "data", "llm-reliability.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ROLLING_WINDOW_SIZE = 10;

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  supported_parameters?: string[];
}

export interface ExecutionMetric {
  success: boolean;
  error_type?: "schema_failure" | "malformed_function_call" | "timeout" | "provider_error";
  latency_ms: number;
  timestamp: string;
}

export interface ModelReliability {
  success_count: number;
  failure_count: number;
  schema_failure_count: number;
  malformed_function_call_count: number;
  timeout_count: number;
  average_latency_ms: number;
  last_success_at: string | null;
  recent_executions: ExecutionMetric[];
}

export type ReliabilityDatabase = Record<string, ModelReliability>;

/**
 * Ensures directories for caching exist.
 */
function ensureDirectories() {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
}

/**
 * Loads dynamic list of models from OpenRouter or returns cached copy.
 */
export async function getOpenRouterModels(apiKey: string): Promise<OpenRouterModel[]> {
  ensureDirectories();

  try {
    if (fs.existsSync(CACHE_FILE)) {
      const stats = fs.statSync(CACHE_FILE);
      const age = Date.now() - stats.mtimeMs;
      if (age < CACHE_TTL_MS) {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        if (Array.isArray(cached) && cached.length > 0) {
          return cached;
        }
      }
    }
  } catch (err: any) {
    log({
      stage: "OPENROUTER_ROUTER_CACHE_READ_ERROR",
      message: `Failed to read OpenRouter model cache: ${err.message}`,
      level: "WARN",
    });
  }

  log({
    stage: "OPENROUTER_ROUTER_FETCH",
    message: "Fetching fresh models from OpenRouter API...",
  });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/Le-Minh-Hieu/10.ICT-scholar-agents",
        "X-Title": "ICT Scholar Agents",
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API responded with status ${response.status}`);
    }

    const json = await response.json();
    if (json && Array.isArray(json.data)) {
      const models: OpenRouterModel[] = json.data.map((m: any) => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length || 4096,
        pricing: {
          prompt: m.pricing?.prompt || "0",
          completion: m.pricing?.completion || "0",
        },
        supported_parameters: m.supported_parameters || [],
      }));

      fs.writeFileSync(CACHE_FILE, JSON.stringify(models, null, 2), "utf8");
      return models;
    }
  } catch (err: any) {
    log({
      stage: "OPENROUTER_ROUTER_FETCH_ERROR",
      message: `Failed to fetch OpenRouter models: ${err.message}. Falling back to old cache if available.`,
      level: "WARN",
    });

    if (fs.existsSync(CACHE_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      } catch {
        // Fall through
      }
    }
  }

  // Absolute fallback default models if API and cache are both completely unavailable
  return [
    {
      id: "google/gemini-2.5-flash",
      name: "Google: Gemini 2.5 Flash",
      context_length: 1000000,
      pricing: { prompt: "0.000000075", completion: "0.0000003" },
      supported_parameters: ["tools", "response_format"],
    },
    {
      id: "meta-llama/llama-3-70b-instruct:free",
      name: "Meta: Llama 3 70B Instruct (free)",
      context_length: 8192,
      pricing: { prompt: "0", completion: "0" },
      supported_parameters: ["tools", "response_format"],
    },
  ];
}

/**
 * Loads the reliability stats from file.
 */
export function loadReliabilityDb(): ReliabilityDatabase {
  ensureDirectories();
  if (!fs.existsSync(RELIABILITY_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(RELIABILITY_FILE, "utf8"));
  } catch (err: any) {
    log({
      stage: "RELIABILITY_LOAD_ERROR",
      message: `Failed to load reliability database: ${err.message}`,
      level: "WARN",
    });
    return {};
  }
}

/**
 * Saves the reliability stats to file.
 */
export function saveReliabilityDb(db: ReliabilityDatabase) {
  ensureDirectories();
  try {
    fs.writeFileSync(RELIABILITY_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err: any) {
    log({
      stage: "RELIABILITY_SAVE_ERROR",
      message: `Failed to save reliability database: ${err.message}`,
      level: "WARN",
    });
  }
}

/**
 * Calculates reliability score using both lifetime and rolling window metrics.
 */
export function calculateReliabilityScore(metrics: ModelReliability | undefined): number {
  if (!metrics) {
    return 1.0; // Default score for unexplored models to encourage discovery
  }

  const lifetimeTotal = metrics.success_count + metrics.failure_count;
  if (lifetimeTotal === 0) {
    return 1.0;
  }

  // 1. Lifetime reliability calculation
  const schemaPenalties = metrics.schema_failure_count * 2.0;
  const malformedPenalties = metrics.malformed_function_call_count * 1.5;
  const timeoutPenalties = metrics.timeout_count * 1.0;
  const providerErrors = metrics.failure_count - (metrics.schema_failure_count + metrics.malformed_function_call_count + metrics.timeout_count);
  const providerPenalties = Math.max(0, providerErrors) * 0.5;

  const lifetimeScore = (metrics.success_count - (schemaPenalties + malformedPenalties + timeoutPenalties + providerPenalties)) / (lifetimeTotal + 1);

  // 2. Rolling window reliability calculation
  let rollingScore = 1.0;
  const recent = metrics.recent_executions || [];
  if (recent.length > 0) {
    let recentPenalizedSum = 0;
    for (const run of recent) {
      if (run.success) {
        recentPenalizedSum += 1.0;
      } else {
        // Apply weights based on failure type in rolling window
        if (run.error_type === "schema_failure") {
          recentPenalizedSum -= 2.0;
        } else if (run.error_type === "malformed_function_call") {
          recentPenalizedSum -= 1.5;
        } else if (run.error_type === "timeout") {
          recentPenalizedSum -= 1.0;
        } else {
          recentPenalizedSum -= 0.5; // Provider error
        }
      }
    }
    rollingScore = recentPenalizedSum / recent.length;
  }

  // 3. Combined score: 40% lifetime weight + 60% rolling window weight
  // If we have fewer than 3 rolling window executions, rely more on lifetime stats
  const rollingWeight = recent.length >= 3 ? 0.6 : 0.2;
  const lifetimeWeight = 1.0 - rollingWeight;

  return (lifetimeScore * lifetimeWeight) + (rollingScore * rollingWeight);
}

/**
 * Updates reliability metrics for a model.
 */
export function recordExecutionResult(
  modelId: string,
  success: boolean,
  latencyMs: number,
  errorType?: "schema_failure" | "malformed_function_call" | "timeout" | "provider_error"
) {
  const db = loadReliabilityDb();
  if (!db[modelId]) {
    db[modelId] = {
      success_count: 0,
      failure_count: 0,
      schema_failure_count: 0,
      malformed_function_call_count: 0,
      timeout_count: 0,
      average_latency_ms: 0,
      last_success_at: null,
      recent_executions: [],
    };
  }

  const stats = db[modelId];

  // Update lifetime metrics
  if (success) {
    stats.success_count++;
    stats.last_success_at = new Date().toISOString();
  } else {
    stats.failure_count++;
    if (errorType === "schema_failure") stats.schema_failure_count++;
    else if (errorType === "malformed_function_call") stats.malformed_function_call_count++;
    else if (errorType === "timeout") stats.timeout_count++;
  }

  // Update running latency average
  const totalCalls = stats.success_count + stats.failure_count;
  stats.average_latency_ms = ((stats.average_latency_ms * (totalCalls - 1)) + latencyMs) / totalCalls;

  // Update rolling window
  const newRun: ExecutionMetric = {
    success,
    error_type: errorType,
    latency_ms: latencyMs,
    timestamp: new Date().toISOString(),
  };

  stats.recent_executions = stats.recent_executions || [];
  stats.recent_executions.push(newRun);
  if (stats.recent_executions.length > ROLLING_WINDOW_SIZE) {
    stats.recent_executions.shift();
  }

  saveReliabilityDb(db);
}

export interface CapabilityRoutingOptions {
  schema?: any;
  tools?: any[];
  responseType?: "json" | "text";
  estimatedPromptChars?: number;
}

/**
 * Builds a dynamically sorted chain of failover candidate models.
 */
export async function getFailoverChain(
  apiKey: string,
  options: CapabilityRoutingOptions
): Promise<string[]> {
  const models = await getOpenRouterModels(apiKey);
  const reliabilityDb = loadReliabilityDb();

  const promptChars = options.estimatedPromptChars || 2000;
  const estimatedPromptTokens = Math.ceil(promptChars / 4);
  const requiredOutputTokens = 4000;
  const minRequiredContext = estimatedPromptTokens + requiredOutputTokens;

  const needsTools = !!(options.schema || (options.tools && options.tools.length > 0));
  const needsJson = options.responseType === "json";

  // Filter candidates based on requirements
  const eligible = models.filter((model) => {
    // 1. Context check
    if (model.context_length < minRequiredContext) {
      return false;
    }

    // 2. Capabilities check
    const supported = model.supported_parameters || [];
    if (needsTools) {
      // Check if it supports tool calling parameter
      const hasToolsSupport = supported.includes("tools") || 
        model.id.includes("gpt-") || 
        model.id.includes("claude-") || 
        model.id.includes("gemini-") ||
        model.id.includes("llama-3");
      if (!hasToolsSupport) return false;
    }

    if (needsJson) {
      const hasJsonSupport = supported.includes("response_format") || 
        model.id.includes("gpt-") || 
        model.id.includes("claude-") || 
        model.id.includes("gemini-") ||
        model.id.includes("llama-3");
      if (!hasJsonSupport) return false;
    }

    // 3. Keep out persistent severe failures (reliability threshold check)
    const stats = reliabilityDb[model.id];
    if (stats) {
      const score = calculateReliabilityScore(stats);
      if (score < -5.0) {
        return false;
      }
    }

    return true;
  });

  // Calculate pricing & score weighting for all eligible
  const scored = eligible.map((model) => {
    const stats = reliabilityDb[model.id];
    const reliabilityScore = calculateReliabilityScore(stats);

    // Calculate dynamic cost estimates
    const promptPrice = parseFloat(model.pricing.prompt) || 0;
    const completionPrice = parseFloat(model.pricing.completion) || 0;
    const estimatedCost = (estimatedPromptTokens * promptPrice) + (requiredOutputTokens * completionPrice);

    // We rank by a custom score combining reliability and cost.
    // Higher reliability score and lower cost translates to a higher priority.
    // Base priority is derived from reliability. Add a penalty for cost to sort equivalent models.
    // Cost scaling: since cost values are tiny (e.g. 0.0000003), we can scale them to be meaningful.
    // A model costing $0 is prioritized. A model costing $0.05 per call will have a minor penalty.
    const costPenalty = estimatedCost * 100; // $0.01 cost = 1.0 penalty points
    const finalScore = reliabilityScore - costPenalty;

    return {
      id: model.id,
      finalScore,
      cost: estimatedCost,
      reliabilityScore,
    };
  });

  // Sort descending by final score
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // If no models matched filters, fallback to the top 2 default models to prevent complete failure
  if (scored.length === 0) {
    return ["google/gemini-2.5-flash", "meta-llama/llama-3-70b-instruct:free"];
  }

  return scored.map((s) => s.id);
}
