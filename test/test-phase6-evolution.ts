import { OntologyEvolver } from "../core/1.ingest/ontology-evolver";
import { runEvaluation } from "../core/5.eval/runner";
import { OntologyGovernance } from "../core/5.eval/ontology-governance";
import fs from "fs";
import path from "path";

async function testEvolution() {
  console.log("=== PHASE 6: ADAPTIVE ONTOLOGY EVOLUTION TEST ===\n");

  const evolver = new OntologyEvolver();

  // 1. Mine Annotations
  console.log("Step 1: Mining Annotations...");
  await evolver.analyzeAnnotations();
  const candidates = evolver.discoverCandidates();
  evolver.saveCandidates(candidates);

  if (candidates.length === 0) {
    console.log("No candidates discovered. Adding a mock candidate for testing...");
    const mockCandidate = {
      id: "alias_LIQUIDITY_SWEEP_stop_hunt",
      type: "NEW_ALIAS" as const,
      target_canonical: "LIQUIDITY_SWEEP",
      suggested_surface_terms: ["stop hunt"],
      confidence: 0.9,
      reasoning: "Mock candidate for test flow.",
      status: "PENDING" as const
    };
    evolver.saveCandidates([mockCandidate]);
  }

  // 2. Run Stable Evaluation
  console.log("\nStep 2: Running Stable Evaluation...");
  await runEvaluation(false);
  const reports = fs.readdirSync(path.join(process.cwd(), "data/eval/reports")).filter(f => f.startsWith("report_") && f.endsWith(".json")).sort().reverse();
  const stableReport = path.join(process.cwd(), "data/eval/reports", reports[0]);

  // 3. Run Candidate Evaluation
  console.log("\nStep 3: Running Candidate Evaluation (Sandboxed)...");
  await runEvaluation(true);
  const reportsAfter = fs.readdirSync(path.join(process.cwd(), "data/eval/reports")).filter(f => f.startsWith("report_") && f.endsWith(".json")).sort().reverse();
  const candidateReport = path.join(process.cwd(), "data/eval/reports", reportsAfter[0]);

  // 4. Compare and Score
  console.log("\nStep 4: Comparing Reports & Scoring Candidates...");
  OntologyGovernance.compareAndScoreCandidates(stableReport, candidateReport);

  // 5. List Candidates
  console.log("\nStep 5: Listing Candidates...");
  OntologyGovernance.listCandidates();

  // 6. Promotion (HITL simulation)
  const candidateRegistry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/ontology/candidate_registry.json"), "utf-8"));
  if (candidateRegistry.candidates.length > 0) {
    const firstId = candidateRegistry.candidates[0].id;
    console.log(`\nStep 6: Promoting Candidate ${firstId}...`);
    OntologyGovernance.promoteCandidate(firstId, "TEST_RUNNER");
  }

  console.log("\n=== PHASE 6 TEST COMPLETE ===");
}

testEvolution().catch(console.error);
