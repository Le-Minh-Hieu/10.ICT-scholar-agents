import fs from "fs";
import path from "path";
import { 
  ChunkAnnotation, 
  CandidateRegistry, 
  CandidateEntry, 
  FORBIDDEN_MERGES,
  MasterRegistryEntry 
} from "../../shared/knowledge/ontology-types";

const ANNOTATIONS_DIR = path.join(process.cwd(), "data/ontology/annotations");
const CANDIDATE_REGISTRY_PATH = path.join(process.cwd(), "data/ontology/candidate_registry.json");
const MASTER_REGISTRY_PATH = path.join(process.cwd(), "data/ontology/master_registry.json");

export class OntologyEvolver {
  private coOccurrence: Map<string, Map<string, number>> = new Map();
  private termFrequency: Map<string, number> = new Map();
  private conceptToTerms: Map<string, Set<string>> = new Map();

  /**
   * Scans all annotations to build co-occurrence and frequency statistics.
   */
  public async analyzeAnnotations() {
    console.log("[EVOLVER] Analyzing annotations...");
    if (!fs.existsSync(ANNOTATIONS_DIR)) return;

    const files = fs.readdirSync(ANNOTATIONS_DIR).filter(f => f.endsWith(".annotations.json"));
    
    for (const file of files) {
      const annotations: ChunkAnnotation[] = JSON.parse(fs.readFileSync(path.join(ANNOTATIONS_DIR, file), "utf-8"));
      
      for (const ann of annotations) {
        const canonicals = ann.concepts.map(c => c.canonical);
        const surfaceTerms = ann.concepts.flatMap(c => c.surface_terms.map(st => st.toLowerCase()));

        // 1. Track Term Frequency & Concept Mapping
        ann.concepts.forEach(c => {
          if (!this.conceptToTerms.has(c.canonical)) {
            this.conceptToTerms.set(c.canonical, new Set());
          }
          c.surface_terms.forEach(st => {
            const lowTerm = st.toLowerCase();
            this.conceptToTerms.get(c.canonical)!.add(lowTerm);
            this.termFrequency.set(lowTerm, (this.termFrequency.get(lowTerm) || 0) + 1);
          });
        });

        // 2. Build Co-occurrence Matrix (Concept <-> Term)
        for (const canonical of canonicals) {
          if (!this.coOccurrence.has(canonical)) {
            this.coOccurrence.set(canonical, new Map());
          }
          const stats = this.coOccurrence.get(canonical)!;
          
          for (const term of surfaceTerms) {
            stats.set(term, (stats.get(term) || 0) + 1);
          }
        }
      }
    }
  }

  /**
   * Identifies candidate aliases and concepts based on co-occurrence and frequency.
   */
  public discoverCandidates(): CandidateEntry[] {
    const candidates: CandidateEntry[] = [];
    const masterRegistry: MasterRegistryEntry[] = JSON.parse(fs.readFileSync(MASTER_REGISTRY_PATH, "utf-8"));
    const masterCanonicalSet = new Set(masterRegistry.map(m => m.canonical));

    // Discovery 1: Surface terms frequently co-occurring with a concept but not in registry
    this.coOccurrence.forEach((terms, canonical) => {
      const registryEntry = masterRegistry.find(m => m.canonical === canonical);
      if (!registryEntry) return;

      const registeredTerms = new Set(registryEntry.surface_terms.map(t => t.toLowerCase()));

      terms.forEach((count, term) => {
        // Heuristic: If term appears with concept > 5 times AND > 30% of concept's total appearances
        const conceptTotal = Array.from(this.coOccurrence.get(canonical)!.values()).reduce((a, b) => a + b, 0);
        const ratio = count / conceptTotal;

        if (count > 5 && ratio > 0.3 && !registeredTerms.has(term) && !masterCanonicalSet.has(term.toUpperCase())) {
            
          // Check for forbidden merges (if the term itself is actually another canonical concept)
          const isForbidden = FORBIDDEN_MERGES.some(([c1, c2]) => 
            (c1 === canonical && c2 === term.toUpperCase()) || 
            (c2 === canonical && c1 === term.toUpperCase())
          );

          if (!isForbidden) {
            candidates.push({
              id: `alias_${canonical}_${term.replace(/\s+/g, "_")}`,
              type: "NEW_ALIAS",
              target_canonical: canonical,
              suggested_surface_terms: [term],
              confidence: ratio,
              reasoning: `Term '${term}' co-occurs with ${canonical} in ${(ratio * 100).toFixed(1)}% of instances (${count} times).`,
              status: "PENDING"
            });
          } else {
            console.warn(`[EVOLVER] Forbidden merge blocked: ${canonical} <-> ${term.toUpperCase()}`);
          }
        }
      });
    });

    return candidates;
  }

  /**
   * Saves candidates to the candidate registry.
   */
  public saveCandidates(candidates: CandidateEntry[]) {
    const registry: CandidateRegistry = {
      candidates,
      last_generated: new Date().toISOString()
    };
    fs.writeFileSync(CANDIDATE_REGISTRY_PATH, JSON.stringify(registry, null, 2));
    console.log(`[EVOLVER] Generated ${candidates.length} candidates.`);
  }
}

// CLI trigger
if (process.argv[2] === "mine") {
  const evolver = new OntologyEvolver();
  evolver.analyzeAnnotations().then(() => {
    const candidates = evolver.discoverCandidates();
    evolver.saveCandidates(candidates);
  });
}
