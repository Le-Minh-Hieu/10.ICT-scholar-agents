import * as fs from "fs";
import * as path from "path";
import { BenchmarkQuery } from "./types";

const BENCHMARK_PATH = path.join(process.cwd(), "data/eval/benchmarks/hierarchical-benchmarks.json");

/**
 * CLI Tool to update hierarchical benchmarks based on human review.
 */
export function markAsStrategicallyValuable(queryId: string, chunkId: string) {
  const benchmarks: BenchmarkQuery[] = JSON.parse(fs.readFileSync(BENCHMARK_PATH, "utf-8"));
  
  const benchmark = benchmarks.find(b => b.id === queryId);
  if (!benchmark) {
    console.error(`Benchmark ${queryId} not found.`);
    return;
  }

  if (!benchmark.expected_chunk_ids) {
    benchmark.expected_chunk_ids = [];
  }

  if (!benchmark.expected_chunk_ids.includes(chunkId)) {
    benchmark.expected_chunk_ids.push(chunkId);
    console.log(`✅ Added chunk ${chunkId} as an expected target for ${queryId}.`);
  }

  fs.writeFileSync(BENCHMARK_PATH, JSON.stringify(benchmarks, null, 2));
}

// Example usage via command line arguments
if (process.argv[2] === "add-target") {
  const qId = process.argv[3];
  const cId = process.argv[4];
  if (qId && cId) {
    markAsStrategicallyValuable(qId, cId);
  } else {
    console.log("Usage: ts-node core/5.eval/human-feedback.ts add-target <queryId> <chunkId>");
  }
}
