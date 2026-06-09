import * as fs from "fs";
import * as path from "path";
import { EvaluationReport } from "./types";

const REPORT_DIR = path.join(process.cwd(), "data/eval/reports");

export function runRegression() {
  const reports = fs.readdirSync(REPORT_DIR)
    .filter(f => f.startsWith("report_") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (reports.length < 2) {
    console.log("Not enough reports for regression analysis.");
    return;
  }

  const current: EvaluationReport = JSON.parse(fs.readFileSync(path.join(REPORT_DIR, reports[0]), "utf-8"));
  const previous: EvaluationReport = JSON.parse(fs.readFileSync(path.join(REPORT_DIR, reports[1]), "utf-8"));

  console.log("\n📉 REGRESSION ANALYSIS");
  console.log(`Comparing ${reports[0]} vs ${reports[1]}`);
  
  const pDelta = current.summary.precision_at_5 - previous.summary.precision_at_5;
  const nDelta = current.summary.ndcg_at_5 - previous.summary.ndcg_at_5;

  console.log(`- Precision@5: ${(pDelta * 100).toFixed(1)}% (${(current.summary.precision_at_5 * 100).toFixed(1)}% vs ${(previous.summary.precision_at_5 * 100).toFixed(1)}%)`);
  console.log(`- nDCG@5: ${nDelta.toFixed(3)} (${current.summary.ndcg_at_5.toFixed(3)} vs ${previous.summary.ndcg_at_5.toFixed(3)})`);

  if (pDelta < -0.05) {
    console.error("🚨 MAJOR REGRESSION DETECTED: Precision dropped by >5%!");
  } else if (pDelta > 0.05) {
    console.log("🚀 SIGNIFICANT IMPROVEMENT DETECTED!");
  } else {
    console.log("⚖️ Performance is stable.");
  }
}

if (require.main === module) {
  runRegression();
}
