
import { calculateOntologyBonus } from "../core/3.query/ontology/scorer";
import { ontologyLoader } from "../core/3.query/ontology/loader";
import { MetricsEngine } from "../core/5.eval/metrics";
import { ChunkAnnotation } from "../shared/knowledge/ontology-types";

// Mock Data
const mockAnnotations: Record<string, ChunkAnnotation> = {
  "chunk_1": {
    chunk_id: "chunk_1",
    concepts: [],
    session_tags: ["LONDON"],
    temporal_tags: [],
    source_context: { section_title: "Test", source_file: "test.json", chunk_index: 1 },
    narrative_metadata: {
      state: { value: "MANIPULATION", confidence: 0.9 },
      links: [
        { target_chunk_id: "chunk_2", type: "NARRATIVE_SUCCESSOR", confidence: 0.8 },
        { target_chunk_id: "chunk_2", type: "TEMPORAL_NEXT", confidence: 0.95 }
      ],
      flow: { direction: "BEARISH", intensity: 0.8 }
    }
  },
  "chunk_2": {
    chunk_id: "chunk_2",
    concepts: [],
    session_tags: ["LONDON"],
    temporal_tags: [],
    source_context: { section_title: "Test", source_file: "test.json", chunk_index: 2 },
    narrative_metadata: {
      state: { value: "EXPANSION", confidence: 0.9 },
      links: [
        { target_chunk_id: "chunk_1", type: "TEMPORAL_PREV", confidence: 0.95 }
      ],
      flow: { direction: "BEARISH", intensity: 0.9 }
    }
  }
};

// Mock the loader
(ontologyLoader as any).getAnnotation = (id: string) => mockAnnotations[id];

async function runTest() {
  console.log("🚀 Testing Phase 3 Narrative Layer...");

  // 1. Test Narrative Bonus
  const queries = ["NY reversal after London manipulation", "expansion following manipulation"];
  const result1 = calculateOntologyBonus("chunk_1", queries);
  const result2 = calculateOntologyBonus("chunk_2", queries);

  console.log("\n--- Bonus Calculation ---");
  console.log(`Chunk 1 (Manipulation) Bonus: ${result1.bonus.toFixed(4)}`);
  console.log(`Chunk 2 (Expansion) Bonus: ${result2.bonus.toFixed(4)}`);

  if (result1.bonus > 0 && result2.bonus > 0) {
    console.log("✅ Narrative bonus applied correctly.");
  } else {
    console.log("❌ Narrative bonus failed.");
  }

  // 2. Test Narrative Coherence Metric
  const retrievedChunks = [
    { chunk_id: "chunk_1", text: "..." },
    { chunk_id: "chunk_2", text: "..." }
  ];

  const coherence = MetricsEngine.calculateNarrativeCoherence(retrievedChunks as any);
  console.log("\n--- Coherence Metric ---");
  console.log(`Sequence [Manipulation -> Expansion] Coherence: ${coherence.toFixed(2)}`);

  if (coherence === 1.0) {
    console.log("✅ Narrative coherence metric working.");
  } else {
    console.log("❌ Narrative coherence metric failed.");
  }

  // 3. Test Contradiction Detection (Conceptual)
  const contradictoryChunks = [
    { chunk_id: "chunk_2", text: "..." },
    { chunk_id: "chunk_1", text: "..." }
  ];
  const coherence2 = MetricsEngine.calculateNarrativeCoherence(contradictoryChunks as any);
  console.log(`Sequence [Expansion -> Manipulation] Coherence: ${coherence2.toFixed(2)}`);
  
  if (coherence2 < 1.0) {
    console.log("✅ Contradiction detected (lower coherence for invalid transition).");
  }

  console.log("\n🎯 Phase 3 Narrative Layer Test Complete.");
}

runTest();
