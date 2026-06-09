
import fs from "fs";
import path from "path";
import { ChunkAnnotation, ProbabilisticLink, NarrativeState } from "../../shared/knowledge/ontology-types.js";

const ANNOTATIONS_DIR = path.join(process.cwd(), "data/ontology/annotations");

/**
 * Heuristic rules for ICT narrative transitions.
 * Defines likely next states from a given state.
 */
const TRANSITION_RULES: Record<NarrativeState, NarrativeState[]> = {
  "ACCUMULATION": ["MANIPULATION", "EXPANSION", "CONSOLIDATION"],
  "MANIPULATION": ["EXPANSION", "REVERSAL"],
  "EXPANSION": ["REBALANCE", "CONTINUATION", "REVERSAL", "CONSOLIDATION"],
  "REBALANCE": ["CONTINUATION", "EXPANSION"],
  "CONTINUATION": ["EXPANSION", "REBALANCE", "REVERSAL"],
  "REVERSAL": ["EXPANSION", "REBALANCE", "CONSOLIDATION"],
  "CONSOLIDATION": ["ACCUMULATION", "MANIPULATION"],
  "INTERMARKET_DIVERGENCE": ["REVERSAL", "MANIPULATION", "EXPANSION"],
  "SMT_HINT": ["REVERSAL", "MANIPULATION", "EXPANSION"]
};

function calculateLinkConfidence(
  current: ChunkAnnotation,
  target: ChunkAnnotation,
  linkType: ProbabilisticLink["type"]
): number {
  if (linkType === "TEMPORAL_NEXT" || linkType === "TEMPORAL_PREV") {
    // High confidence for direct temporal adjacency in the same source file
    return current.source_context.source_file === target.source_context.source_file ? 0.95 : 0.4;
  }

  if (linkType === "NARRATIVE_SUCCESSOR") {
    const currentState = current.narrative_metadata?.state?.value;
    const targetState = target.narrative_metadata?.state?.value;

    if (!currentState || !targetState) return 0.3;

    // Check if target state is a logical progression from current state
    const allowedTransitions = TRANSITION_RULES[currentState];
    if (allowedTransitions?.includes(targetState)) {
      return 0.75; // Logical ICT progression
    }

    if (currentState === targetState) {
      return 0.6; // Same state continuation
    }
  }

  return 0.2; // Low default confidence
}

async function linkNarratives() {
  const files = fs.readdirSync(ANNOTATIONS_DIR).filter(f => f.endsWith(".annotations.json"));
  
  // Load all annotations into a flat array for cross-file linking if needed, 
  // but primarily focus on intra-file continuity.
  let allAnnotations: ChunkAnnotation[] = [];
  const fileMap = new Map<string, ChunkAnnotation[]>();

  for (const file of files) {
    const content: ChunkAnnotation[] = JSON.parse(fs.readFileSync(path.join(ANNOTATIONS_DIR, file), "utf-8"));
    allAnnotations.push(...content);
    fileMap.set(file, content);
  }

  // Sort by chunk_index to ensure global temporal ordering
  allAnnotations.sort((a, b) => a.source_context.chunk_index - b.source_context.chunk_index);

  console.log(`Linking ${allAnnotations.length} chunks...`);

  for (let i = 0; i < allAnnotations.length; i++) {
    const current = allAnnotations[i];
    if (!current.narrative_metadata) {
        current.narrative_metadata = { links: [] };
    }
    
    // Reset links to allow re-runs
    current.narrative_metadata.links = [];

    // 1. TEMPORAL LINKS (Immediate Neighbors)
    if (i > 0) {
      const prev = allAnnotations[i - 1];
      current.narrative_metadata.links.push({
        target_chunk_id: prev.chunk_id,
        type: "TEMPORAL_PREV",
        confidence: calculateLinkConfidence(current, prev, "TEMPORAL_PREV")
      });
    }

    if (i < allAnnotations.length - 1) {
      const next = allAnnotations[i + 1];
      current.narrative_metadata.links.push({
        target_chunk_id: next.chunk_id,
        type: "TEMPORAL_NEXT",
        confidence: calculateLinkConfidence(current, next, "TEMPORAL_NEXT")
      });
    }

    // 2. NARRATIVE LINKS (Look ahead a few chunks for logical flow)
    // Sometimes a narrative spans multiple chunks
    const lookAhead = 3;
    for (let j = 1; j <= lookAhead; j++) {
      if (i + j < allAnnotations.length) {
        const target = allAnnotations[i + j];
        const confidence = calculateLinkConfidence(current, target, "NARRATIVE_SUCCESSOR");
        
        if (confidence > 0.5) {
          current.narrative_metadata.links.push({
            target_chunk_id: target.chunk_id,
            type: "NARRATIVE_SUCCESSOR",
            confidence: confidence - (j * 0.05) // Slight penalty for distance
          });
        }
      }
    }
    
    // 3. SESSION CONTINUATION
    // (Future improvement: link end of London to start of NY)
  }

  // Save back to files
  for (const [file, annotations] of fileMap.entries()) {
    fs.writeFileSync(path.join(ANNOTATIONS_DIR, file), JSON.stringify(annotations, null, 2));
  }

  console.log("🎯 Narrative linking complete.");
}

linkNarratives();
