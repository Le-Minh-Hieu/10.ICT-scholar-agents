/**
 * Capture Readiness Simulation, Benchmark, and False Positive Audit
 */

import { performance } from 'perf_hooks';

// Helper to compute percentile
function getPercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// 1. Visual Hash Benchmark
function runHashBenchmark() {
  console.log("=== RUNNING VISUAL HASH BENCHMARK (FNV-1a vs Sum-based) ===");
  const width = 64;
  const height = 64;
  const size = width * height * 4;
  const imgData = new Uint8ClampedArray(size);
  
  // Fill with random dummy pixel data
  for (let i = 0; i < size; i++) {
    imgData[i] = Math.floor(Math.random() * 256);
  }

  const iterations = 10000;
  const oldTimes: number[] = [];
  const fnvTimes: number[] = [];

  // Old Sum-based Hash
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    let sum = 0;
    for (let j = 0; j < imgData.length; j += 4) {
      sum += imgData[j] + imgData[j+1] + imgData[j+2];
    }
    const t1 = performance.now();
    oldTimes.push(t1 - t0);
  }

  // FNV-1a 32-bit Hash
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    let hash = 0x811c9dc5;
    for (let j = 0; j < imgData.length; j++) {
      hash ^= imgData[j];
      hash = (hash * 0x01000193) | 0;
    }
    const fnvVal = hash >>> 0;
    const t1 = performance.now();
    fnvTimes.push(t1 - t0);
  }

  const oldAvg = oldTimes.reduce((a, b) => a + b, 0) / iterations;
  const fnvAvg = fnvTimes.reduce((a, b) => a + b, 0) / iterations;

  const oldP95 = getPercentile(oldTimes, 95);
  const fnvP95 = getPercentile(fnvTimes, 95);

  console.log(`Old Sum-based Hash:
  Average Execution Time: ${oldAvg.toFixed(6)} ms
  95th Percentile Time:   ${oldP95.toFixed(6)} ms`);

  console.log(`FNV-1a 32-bit Hash:
  Average Execution Time: ${fnvAvg.toFixed(6)} ms
  95th Percentile Time:   ${fnvP95.toFixed(6)} ms`);

  return {
    oldAvg, oldP95, fnvAvg, fnvP95
  };
}

// 2. Mock Readiness Auditing Function
interface MockTVDetails {
  mainSeriesLoading: boolean;
  isSymbolResolved: boolean;
  drawingsLoading: boolean;
  studiesLoading: boolean;
  drawingsCount: number;
  lastBarTime: number | null;
  seriesStateStable: boolean;
  error?: string;
}

function auditReadiness(
  tvDetails: MockTVDetails | null,
  mutationStable: boolean,
  seriesStable: boolean,
  visualStable: boolean
) {
  if (!tvDetails) {
    return { ready: false, failureStage: "BRIDGE_NOT_READY" };
  }
  if (tvDetails.error) {
    return { ready: false, failureStage: "BRIDGE_NOT_READY" };
  }
  if (tvDetails.mainSeriesLoading || !tvDetails.isSymbolResolved) {
    return { ready: false, failureStage: "BRIDGE_NOT_READY" };
  }
  if (tvDetails.drawingsLoading || tvDetails.studiesLoading) {
    return { ready: false, failureStage: "DRAWING_LAYER_NOT_READY" };
  }
  if (!mutationStable) {
    return { ready: false, failureStage: "MUTATION_TIMEOUT" };
  }
  if (!seriesStable) {
    return { ready: false, failureStage: "SERIES_STABILITY_TIMEOUT" };
  }
  if (!visualStable) {
    return { ready: false, failureStage: "VISUAL_STABILITY_TIMEOUT" };
  }
  return { ready: true };
}

function runFalsePositiveAudit() {
  console.log("\n=== RUNNING FALSE POSITIVE AUDIT ===");

  // Scenario A: Stable chart -> Expected: READY = true
  const stateA = auditReadiness(
    { mainSeriesLoading: false, isSymbolResolved: true, drawingsLoading: false, studiesLoading: false, drawingsCount: 15, lastBarTime: 1777142030000, seriesStateStable: true },
    true, true, true
  );
  console.log(`Scenario A (Stable Chart):
  Expected: READY = true, Actual: READY = ${stateA.ready} (${stateA.failureStage || "Success"})`);

  // Scenario B: Active drawing update -> Expected: READY = false (DRAWING_LAYER_NOT_READY)
  const stateB = auditReadiness(
    { mainSeriesLoading: false, isSymbolResolved: true, drawingsLoading: true, studiesLoading: false, drawingsCount: 16, lastBarTime: 1777142030000, seriesStateStable: true },
    true, true, true
  );
  console.log(`Scenario B (Active Drawing Update):
  Expected: READY = false (DRAWING_LAYER_NOT_READY), Actual: READY = ${stateB.ready} (${stateB.failureStage || "Success"})`);

  // Scenario C: Indicator still loading -> Expected: READY = false (BRIDGE_NOT_READY or DRAWING_LAYER_NOT_READY depending on detail)
  const stateC = auditReadiness(
    { mainSeriesLoading: false, isSymbolResolved: true, drawingsLoading: false, studiesLoading: true, drawingsCount: 15, lastBarTime: 1777142030000, seriesStateStable: true },
    true, true, true
  );
  console.log(`Scenario C (Indicator loading):
  Expected: READY = false (DRAWING_LAYER_NOT_READY), Actual: READY = ${stateC.ready} (${stateC.failureStage || "Success"})`);

  // Scenario D: TradingView switching timeframe -> Expected: READY = false (BRIDGE_NOT_READY due to mainSeriesLoading)
  const stateD = auditReadiness(
    { mainSeriesLoading: true, isSymbolResolved: true, drawingsLoading: false, studiesLoading: false, drawingsCount: 15, lastBarTime: null, seriesStateStable: false },
    true, true, true
  );
  console.log(`Scenario D (Switching Timeframe):
  Expected: READY = false (BRIDGE_NOT_READY), Actual: READY = ${stateD.ready} (${stateD.failureStage || "Success"})`);

  // Scenario E: High latency chart load -> Expected: READY eventually true (initially false, then true)
  const stateE1 = auditReadiness(
    { mainSeriesLoading: true, isSymbolResolved: false, drawingsLoading: false, studiesLoading: false, drawingsCount: 0, lastBarTime: null, seriesStateStable: false },
    false, false, false
  );
  const stateE2 = auditReadiness(
    { mainSeriesLoading: false, isSymbolResolved: true, drawingsLoading: false, studiesLoading: false, drawingsCount: 15, lastBarTime: 1777142030000, seriesStateStable: true },
    true, true, true
  );
  console.log(`Scenario E (High Latency Load):
  Initial check: Expected: READY = false, Actual: ${stateE1.ready} (${stateE1.failureStage})
  After load check: Expected: READY = true, Actual: ${stateE2.ready} (${stateE2.failureStage || "Success"})`);
}

// Run all
const bench = runHashBenchmark();
runFalsePositiveAudit();

export { bench };
