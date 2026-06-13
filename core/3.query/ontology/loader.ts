import * as fs from "fs";
import * as path from "path";
import { ChunkAnnotation, MasterRegistryEntry, CandidateRegistry } from "../../../shared/knowledge/ontology-types";

const ANNOTATIONS_DIR = path.join(process.cwd(), "data/ontology/annotations");
const MASTER_REGISTRY_PATH = path.join(process.cwd(), "data/ontology/master_registry.json");
const CANDIDATE_REGISTRY_PATH = path.join(process.cwd(), "data/ontology/candidate_registry.json");

class OntologyLoader {
  private annotations: Map<string, ChunkAnnotation> = new Map();
  private conceptToChunks: Map<string, string[]> = new Map();
  private registry: MasterRegistryEntry[] = [];
  private surfaceToCanonical: Map<string, string> = new Map();
  private candidateOverlay: Map<string, string> = new Map();
  private isLoaded: boolean = false;
  private isCandidateMode: boolean = false;

  constructor() {}

  public async load(candidateMode: boolean = false) {
    if (this.isLoaded && this.isCandidateMode === candidateMode) return;
    this.isCandidateMode = candidateMode;
    this.surfaceToCanonical.clear();
    this.candidateOverlay.clear();

    // 1. Load Master Registry
    if (fs.existsSync(MASTER_REGISTRY_PATH)) {
      this.registry = JSON.parse(fs.readFileSync(MASTER_REGISTRY_PATH, "utf-8"));
      for (const entry of this.registry) {
        for (const term of entry.surface_terms) {
          this.surfaceToCanonical.set(term.toLowerCase(), entry.canonical);
        }
        // Also map canonical to itself
        this.surfaceToCanonical.set(entry.canonical.toLowerCase(), entry.canonical);
      }
    }

    // 2. Load Candidate Overlay if in candidate mode
    if (candidateMode && fs.existsSync(CANDIDATE_REGISTRY_PATH)) {
      const candidateRegistry: CandidateRegistry = JSON.parse(fs.readFileSync(CANDIDATE_REGISTRY_PATH, "utf-8"));
      for (const candidate of candidateRegistry.candidates) {
        if (candidate.status === "PENDING") {
          for (const term of candidate.suggested_surface_terms) {
            this.candidateOverlay.set(term.toLowerCase(), candidate.target_canonical);
          }
        }
      }
      console.log(`[ONTOLOGY] Candidate mode ACTIVE. Loaded ${this.candidateOverlay.size} candidate mappings.`);
    }

    // 2. Load All Annotations
    if (fs.existsSync(ANNOTATIONS_DIR)) {
      const files = fs.readdirSync(ANNOTATIONS_DIR).filter(f => f.endsWith(".annotations.json"));
      for (const file of files) {
        try {
          const content: ChunkAnnotation[] = JSON.parse(fs.readFileSync(path.join(ANNOTATIONS_DIR, file), "utf-8"));
          for (const ann of content) {
            this.annotations.set(ann.chunk_id, ann);
            
            // Index by concept
            for (const concept of ann.concepts) {
              const canonical = concept.canonical;
              if (!this.conceptToChunks.has(canonical)) {
                this.conceptToChunks.set(canonical, []);
              }
              this.conceptToChunks.get(canonical)!.push(ann.chunk_id);
            }
          }
        } catch (err) {
          console.error(`Error loading annotation file ${file}:`, err);
        }
      }
    }

    this.isLoaded = true;
    console.log(`[ONTOLOGY] Loaded ${this.annotations.size} chunk annotations and ${this.registry.length} master concepts.`);
  }

  public getAnnotation(chunkId: string): ChunkAnnotation | undefined {
    return this.annotations.get(chunkId);
  }

  public getChunksByConcept(canonical: string): string[] {
    return this.conceptToChunks.get(canonical) || [];
  }

  public getCanonical(term: string): string | undefined {
    const termLower = term.toLowerCase();
    // Candidate overlay takes precedence in candidate mode
    if (this.isCandidateMode && this.candidateOverlay.has(termLower)) {
      return this.candidateOverlay.get(termLower);
    }
    return this.surfaceToCanonical.get(termLower);
  }

  public getRegistryEntry(canonical: string): MasterRegistryEntry | undefined {
    return this.registry.find(r => r.canonical === canonical);
  }

  public getAllCanonicalConcepts(): string[] {
    return this.registry.map(r => r.canonical);
  }

  public refresh() {
    this.isLoaded = false;
    this.annotations.clear();
    this.conceptToChunks.clear();
    this.surfaceToCanonical.clear();
    return this.load();
  }

  /**
   * Find canonical concepts from free-text by matching against surface terms.
   * Used by vision-first to detect concepts in vision summaries.
   */
  public findConceptsInText(text: string): string[] {
    if (!text) return [];
    
    const textLower = text.toLowerCase();
    const found = new Set<string>();
    
    // Match each surface term against the text (word boundary aware)
    for (const [surfaceTerm, canonical] of this.surfaceToCanonical.entries()) {
      // Create word boundary pattern: \b term \b
      const pattern = new RegExp(`\\b${surfaceTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(textLower)) {
        found.add(canonical);
      }
    }
    
    return Array.from(found);
  }
}

export const ontologyLoader = new OntologyLoader();
// Trigger initial load
ontologyLoader.load();
