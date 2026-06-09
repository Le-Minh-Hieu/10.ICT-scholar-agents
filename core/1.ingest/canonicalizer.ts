import fs from "fs";
import path from "path";
import { Concept, MasterRegistryEntry } from "../../shared/knowledge/ontology-types";

const REGISTRY_PATH = path.join(process.cwd(), "data/ontology/master_registry.json");
let masterRegistry: MasterRegistryEntry[] = [];

function loadMasterRegistry() {
  if (fs.existsSync(REGISTRY_PATH)) {
    masterRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
  } else {
    console.warn("Master ontology registry not found. Starting with empty registry.");
  }
}

loadMasterRegistry(); // Load on startup

export function canonicalizeConcept(concept: Concept): Concept {
  let canonicalizedConcept = { ...concept };

  for (const entry of masterRegistry) {
    for (const surfaceTerm of entry.surface_terms) {
      if (concept.surface_terms.some(st => st.toLowerCase() === surfaceTerm.toLowerCase())) {
        canonicalizedConcept.canonical = entry.canonical;
        // Ensure all recognized surface terms are included
        canonicalizedConcept.surface_terms = [...new Set([...canonicalizedConcept.surface_terms, ...entry.surface_terms])];
        return canonicalizedConcept; // Return after first match to avoid over-canonicalization
      }
    }
  }
  return canonicalizedConcept;
}

export function addOrUpdateRegistryEntry(newEntry: Partial<MasterRegistryEntry> & { canonical: string }) {
  const existingIndex = masterRegistry.findIndex(e => e.canonical === newEntry.canonical);
  const now = new Date().toISOString();

  if (existingIndex > -1) {
    // Merge new surface terms into existing entry
    const existingEntry = masterRegistry[existingIndex];
    if (newEntry.surface_terms) {
      existingEntry.surface_terms = [...new Set([...existingEntry.surface_terms, ...newEntry.surface_terms])];
    }
    existingEntry.last_updated = now;
    if (newEntry.audit_log) {
      existingEntry.audit_log.push(...newEntry.audit_log);
    } else {
      existingEntry.audit_log.push({
        timestamp: now,
        action: "ALIAS_ADDED",
        details: `Updated via canonicalizer. New terms: ${newEntry.surface_terms?.join(", ")}`,
        author: "SYSTEM"
      });
    }
    masterRegistry[existingIndex] = existingEntry;
  } else {
    const entry: MasterRegistryEntry = {
      canonical: newEntry.canonical,
      surface_terms: newEntry.surface_terms || [],
      version: "1.0.0",
      last_updated: now,
      audit_log: newEntry.audit_log || [{
        timestamp: now,
        action: "CREATED",
        details: "Initial entry created via canonicalizer",
        author: "SYSTEM"
      }]
    };
    masterRegistry.push(entry);
  }
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(masterRegistry, null, 2));
}
