import * as fs from "fs";
import * as path from "path";
import { retrieveRAG } from "../3.query/retrieval-core";
import { buildQueries } from "../3.query/query-builder";
import { ontologyLoader } from "../3.query/ontology/loader";
import { BenchmarkQuery, RetrievalTrace, EvaluationReport } from "./types";
import { MetricsEngine } from "./metrics";
import { RerankAnalyzer } from "./rerank-analyzer";
import { DriftAnalyzer } from "./drift-analyzer";
import { FailureTag } from "./types";

const BENCHMARK_PATH = path.join(process.cwd(), "data/eval/benchmarks/hierarchical-benchmarks.json");
const REPORT_DIR = path.join(process.cwd(), "data/eval/reports");
const TRACE_DIR = path.join(process.cwd(), "data/eval/traces");

export async function runEvaluation(candidateMode: boolean = false) {
  console.log(`🚀 STARTING ${candidateMode ? "CANDIDATE" : "STABLE"} RETRIEVAL EVALUATION...`);
  
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

  await ontologyLoader.load(candidateMode);
  const benchmarks: BenchmarkQuery[] = JSON.parse(fs.readFileSync(BENCHMARK_PATH, "utf-8"));
  const knowledgeMap = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/knowledge_map.json"), "utf8"));

  const results: EvaluationReport["details"] = [];
  const driftAnalyzer = new DriftAnalyzer();
  let totalP5 = 0;
  let totalNDCG5 = 0;
  let totalRerankDelta = 0;

  for (const benchmark of benchmarks) {
    console.log(`\n[EVAL] Query: "${benchmark.query}" (${benchmark.category})`);
    
    // 1. Expand Queries
    const expanded = buildQueries([benchmark.query], knowledgeMap);
    
    // 2. Run Retrieval with Tracing
    const retrievalResult = await retrieveRAG({
      queries: expanded,
      conceptEmbeddings: [],
      agentName: "eval-runner",
      queryId: benchmark.id
    });

    // 3. Load the trace just saved by retrieval-core
    const traceFiles = fs.readdirSync(TRACE_DIR).filter(f => f.startsWith(benchmark.id));
    const latestTraceFile = traceFiles.sort().reverse()[0];
    const trace: RetrievalTrace = JSON.parse(fs.readFileSync(path.join(TRACE_DIR, latestTraceFile), "utf-8"));

    // 4. Calculate Metrics
    const p5 = MetricsEngine.calculatePrecisionAtK(retrievalResult.chunks, benchmark, 5);
    const ndcg5 = MetricsEngine.calculateNDCGAtK(retrievalResult.chunks, benchmark, 5);
    const rerankDelta = RerankAnalyzer.analyzeDelta(trace, benchmark);
    
    driftAnalyzer.processTrace(trace);

    const missingConcepts = (benchmark.requirements?.required_concepts || []).filter(rc => 
      !retrievalResult.chunks.slice(0, 5).some(chunk => {
        const ann = ontologyLoader.getAnnotation(chunk.chunk_id);
        return ann?.concepts.some(c => c.canonical === rc);
      })
    );

    // Forbidden Concept Check
    const forbiddenFound: string[] = [];
    if (benchmark.requirements?.forbidden_concepts) {
      retrievalResult.chunks.slice(0, 5).forEach(chunk => {
        const ann = ontologyLoader.getAnnotation(chunk.chunk_id);
        ann?.concepts.forEach(c => {
          if (benchmark.requirements?.forbidden_concepts?.includes(c.canonical)) {
            forbiddenFound.push(c.canonical);
          }
        });
      });
    }

    // Failure Tagging Logic
    const failureTags: FailureTag[] = [];
    if (missingConcepts.length > 0) {
      // Check if it's an alias miss (did expansion include the canonical?)
      const expandedLower = expanded.map(e => (typeof e === "string" ? e : e.query).toLowerCase());
      const aliasMiss = (benchmark.requirements?.required_concepts || []).some(rc => {
        const registry = ontologyLoader.getRegistryEntry(rc);
        return registry && !registry.surface_terms.some(st => expandedLower.includes(st.toLowerCase()));
      });
      if (aliasMiss) failureTags.push("ALIAS_MISS");
    }

    if (benchmark.requirements?.required_sessions) {
      const sessionAccuracy = MetricsEngine.calculateSessionAccuracy(retrievalResult.chunks, benchmark.requirements.required_sessions, 5);
      if (sessionAccuracy < 1.0) failureTags.push("SESSION_MISS");
    }

    if (forbiddenFound.length > 0) failureTags.push("DRIFT");
    if (rerankDelta.precision_delta < 0) failureTags.push("RERANK_FAIL");

    results.push({
      query_id: benchmark.id,
      passed: p5 >= 0.6 && forbiddenFound.length === 0, 
      metrics: {
        p5,
        ndcg5,
        concepts_matched: (benchmark.requirements?.required_concepts || []).filter(rc => !missingConcepts.includes(rc)),
        concepts_missing: missingConcepts,
        forbidden_found: [...new Set(forbiddenFound)],
        failure_tags: failureTags
      }
    });

    totalP5 += p5;
    totalNDCG5 += ndcg5;
    totalRerankDelta += rerankDelta.precision_delta;

    console.log(`   - Precision@5: ${p5.toFixed(2)}`);
    console.log(`   - nDCG@5: ${ndcg5.toFixed(2)}`);
    console.log(`   - Rerank Delta: ${rerankDelta.precision_delta.toFixed(2)}`);
  }

  // 5. Final Report Generation
  const report: EvaluationReport = {
    timestamp: new Date().toISOString(),
    summary: {
      precision_at_5: totalP5 / benchmarks.length,
      ndcg_at_5: totalNDCG5 / benchmarks.length,
      concept_alignment_rate: results.filter(r => r.metrics.concepts_missing.length === 0).length / benchmarks.length,
      session_accuracy: 0, // TODO
      rerank_delta: totalRerankDelta / benchmarks.length
    },
    details: results,
    drift_flags: driftAnalyzer.detectDrift().map(d => ({
      concept: d.concept,
      issue: "low_utility", // Simplified for now
      frequency: 0 // TODO
    }))
  };

  const reportFilename = `report_${Date.now()}.json`;
  fs.writeFileSync(path.join(REPORT_DIR, reportFilename), JSON.stringify(report, null, 2));
  
  generateMarkdownReport(report);
  
  console.log(`\n✅ EVALUATION COMPLETE. Report saved to ${REPORT_DIR}/${reportFilename}`);
}

function generateMarkdownReport(report: EvaluationReport) {
  let md = `# 📊 ICT Retrieval Evaluation Report\n\n`;
  md += `**Timestamp:** ${report.timestamp}\n\n`;
  
  md += `## 📈 Summary Metrics\n`;
  md += `| Metric | Value |\n`;
  md += `| :--- | :--- |\n`;
  md += `| Precision@5 | **${(report.summary.precision_at_5 * 100).toFixed(1)}%** |\n`;
  md += `| nDCG@5 | **${report.summary.ndcg_at_5.toFixed(3)}** |\n`;
  md += `| Concept Alignment | **${(report.summary.concept_alignment_rate * 100).toFixed(1)}%** |\n`;
  md += `| Rerank Delta | **${(report.summary.rerank_delta > 0 ? "+" : "")}${(report.summary.rerank_delta * 100).toFixed(1)}%** |\n\n`;

  md += `## 🧐 Drift Detection Flags\n`;
  if (report.drift_flags.length === 0) {
    md += `*No significant drift detected.*\n\n`;
  } else {
    md += `| Concept | Issue |\n`;
    md += `| :--- | :--- |\n`;
    report.drift_flags.forEach(f => {
      md += `| \`${f.concept}\` | ${f.issue} |\n`;
    });
    md += `\n`;
  }

  md += `## 📝 Detailed Results\n`;
  md += `| Query ID | Passed | P@5 | nDCG@5 | Missing Concepts |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  report.details.forEach(d => {
    md += `| ${d.query_id} | ${d.passed ? "✅" : "❌"} | ${d.metrics.p5.toFixed(2)} | ${d.metrics.ndcg5.toFixed(2)} | ${d.metrics.concepts_missing.join(", ") || "-"} |\n`;
  });

  fs.writeFileSync(path.join(REPORT_DIR, `latest_report.md`), md);
}

if (process.argv[2] === "stable") {
  runEvaluation(false).catch(console.error);
} else if (process.argv[2] === "candidate") {
  runEvaluation(true).catch(console.error);
}
