import { log } from "../../../shared/utils/logger.js";

type MetricBuckets = {
  ingest_rate: number;
  dedupe_ratio: number;
  rejection_ratio: number;
  parse_failure_ratio: number;
  contradiction_avg: number;
  avg_retrieval_chunks: number;
  avg_selected_evidence: number;
  avg_latency_ms: number;
  shadow_memory_size: number;
  production_memory_size: number;
  adapter_health_score: number;
  dedupe_contamination_attempts: number;
  parser_degradation_rate: number;
  retention_prune_rate: number;
  shadow_reasoning_saturation: number;
};

const accum: { counters: Record<string, number>; gauges: Partial<MetricBuckets>; samples: number } = { counters: {}, gauges: {}, samples: 0 };

export function recordMetric(name: string, value = 1) {
  accum.counters[name] = (accum.counters[name] || 0) + value;
}

export function setGauge<K extends keyof MetricBuckets>(name: K, value: MetricBuckets[K]) {
  accum.gauges[name] = value;
}

export function sample() {
  accum.samples += 1;
}

export function flushAndLog() {
  const payload = { counters: accum.counters, gauges: accum.gauges, samples: accum.samples, ts: new Date().toISOString() };
  log({ stage: 'SHADOW_METRICS', message: 'Flushed shadow metrics', data: payload });
  // advanced health checks
  const rejection = (accum.gauges.rejection_ratio as number) || 0;
  const parseFail = (accum.counters['parse_failures'] || 0);
  const adapterHealth = (accum.gauges.adapter_health_score as number) ?? 1;
  const prodMem = (accum.gauges.production_memory_size as number) || 0;
  const shadowMem = (accum.gauges.shadow_memory_size as number) || 0;

  if (rejection > 0.5 || parseFail > 10 || adapterHealth < 0.5) {
    log({ stage: 'SHADOW_HEALTH_WARNING', message: 'Shadow health warning', data: { rejection_ratio: rejection, parse_failures: parseFail, adapter_health: adapterHealth } });
  }

  // partition pressure
  if (shadowMem > 0 && prodMem / Math.max(1, shadowMem) < 0.5) {
    log({ stage: 'SHADOW_PARTITION_PRESSURE', message: 'Shadow partition pressure detected', data: { production_memory: prodMem, shadow_memory: shadowMem } });
  }

  // stability warning: dedupe contamination or retention prune spikes
  const contamination = (accum.counters['dedupe_contamination_attempts'] || 0);
  const pruneRate = (accum.gauges.retention_prune_rate as number) || 0;
  if (contamination > 10 || pruneRate > 100) {
    log({ stage: 'SHADOW_STABILITY_WARNING', message: 'Shadow stability issue', data: { contamination, retention_prune_rate: pruneRate } });
  }
  // reset
  accum.counters = {};
  accum.gauges = {};
  accum.samples = 0;
}

export default { recordMetric, setGauge, sample, flushAndLog };
