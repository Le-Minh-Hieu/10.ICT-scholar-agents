import fs from "fs";
import path from "path";
import { CandidateRegistry, CandidateEntry, MasterRegistryEntry, AuditEntry } from "../../shared/knowledge/ontology-types";
import { EvaluationReport } from "./types";

const REPORT_DIR = path.join(process.cwd(), "data/eval/reports");
const CANDIDATE_REGISTRY_PATH = path.join(process.cwd(), "data/ontology/candidate_registry.json");
const MASTER_REGISTRY_PATH = path.join(process.cwd(), "data/ontology/master_registry.json");

export class OntologyGovernance {

  /**
   * Compares two evaluation reports (Stable vs Candidate) and updates candidate metadata.
   */
  public static compareAndScoreCandidates(stableReportPath: string, candidateReportPath: string) {
    const stable: EvaluationReport = JSON.parse(fs.readFileSync(stableReportPath, "utf-8"));
    const candidate: EvaluationReport = JSON.parse(fs.readFileSync(candidateReportPath, "utf-8"));
    const candidateRegistry: CandidateRegistry = JSON.parse(fs.readFileSync(CANDIDATE_REGISTRY_PATH, "utf-8"));

    const precisionDelta = candidate.summary.precision_at_5 - stable.summary.precision_at_5;
    const ndcgDelta = candidate.summary.ndcg_at_5 - stable.summary.ndcg_at_5;

    console.log(`[GOVERNANCE] Overall Precision Delta: ${(precisionDelta * 100).toFixed(2)}%`);
    console.log(`[GOVERNANCE] Overall nDCG Delta: ${ndcgDelta.toFixed(3)}`);

    // Per-candidate impact is harder to isolate without individual runs, 
    // but we can look for queries where missing concepts were fixed.
    candidateRegistry.candidates.forEach(can => {
        if (can.status !== "PENDING") return;

        // Simple heuristic: If precision improved and this candidate's target canonical 
        // was a missing concept in stable but present in candidate results.
        can.eval_delta = {
            precision_impact: precisionDelta, // Simplified global impact
            ndcg_impact: ndcgDelta
        };
    });

    fs.writeFileSync(CANDIDATE_REGISTRY_PATH, JSON.stringify(candidateRegistry, null, 2));
  }

  /**
   * Promotes an approved candidate to the master registry.
   */
  public static promoteCandidate(candidateId: string, author: string) {
    const candidateRegistry: CandidateRegistry = JSON.parse(fs.readFileSync(CANDIDATE_REGISTRY_PATH, "utf-8"));
    const masterRegistry: MasterRegistryEntry[] = JSON.parse(fs.readFileSync(MASTER_REGISTRY_PATH, "utf-8"));

    const index = candidateRegistry.candidates.findIndex(c => c.id === candidateId);
    if (index === -1) {
      console.error(`Candidate ${candidateId} not found.`);
      return;
    }

    const candidate = candidateRegistry.candidates[index];
    const now = new Date().toISOString();

    const masterIndex = masterRegistry.findIndex(m => m.canonical === candidate.target_canonical);
    const audit: AuditEntry = {
      timestamp: now,
      action: "PROMOTED",
      details: `Promoted candidate ${candidate.id}. Added terms: ${candidate.suggested_surface_terms.join(", ")}. Precision impact: ${candidate.eval_delta?.precision_impact.toFixed(3)}`,
      author
    };

    if (masterIndex > -1) {
      const entry = masterRegistry[masterIndex];
      entry.surface_terms = [...new Set([...entry.surface_terms, ...candidate.suggested_surface_terms])];
      entry.last_updated = now;
      if (!entry.audit_log) entry.audit_log = [];
      if (!entry.version) entry.version = "1.0.0";
      entry.audit_log.push(audit);
      masterRegistry[masterIndex] = entry;
    } else {
      masterRegistry.push({
        canonical: candidate.target_canonical,
        surface_terms: candidate.suggested_surface_terms,
        version: "1.1.0",
        last_updated: now,
        audit_log: [audit]
      });
    }

    candidate.status = "APPROVED";
    fs.writeFileSync(MASTER_REGISTRY_PATH, JSON.stringify(masterRegistry, null, 2));
    fs.writeFileSync(CANDIDATE_REGISTRY_PATH, JSON.stringify(candidateRegistry, null, 2));

    console.log(`✅ Promoted ${candidateId} to Master Registry.`);
  }

  public static listCandidates() {
    const registry: CandidateRegistry = JSON.parse(fs.readFileSync(CANDIDATE_REGISTRY_PATH, "utf-8"));
    console.log("\n--- PENDING ONTOLOGY CANDIDATES ---");
    registry.candidates.filter(c => c.status === "PENDING").forEach(c => {
      console.log(`ID: ${c.id}`);
      console.log(`Type: ${c.type}`);
      console.log(`Target: ${c.target_canonical}`);
      console.log(`Terms: ${c.suggested_surface_terms.join(", ")}`);
      console.log(`Reason: ${c.reasoning}`);
      if (c.eval_delta) {
        console.log(`Impact: P@5 Delta: ${c.eval_delta.precision_impact.toFixed(3)}`);
      }
      console.log("-----------------------------------");
    });
  }
}

// CLI
if (process.argv[2] === "list") {
  OntologyGovernance.listCandidates();
} else if (process.argv[2] === "compare") {
  const s = process.argv[3];
  const c = process.argv[4];
  if (s && c) OntologyGovernance.compareAndScoreCandidates(s, c);
} else if (process.argv[2] === "promote") {
  const id = process.argv[3];
  const author = process.argv[4] || "HUMAN_REVIEWER";
  if (id) OntologyGovernance.promoteCandidate(id, author);
}
