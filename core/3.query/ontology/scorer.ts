import { ontologyLoader } from "./loader";
import { classifyIntent, QueryIntent } from "./intent-classifier";

export interface OntologyScoreResult {
  bonus: number;
  matchedConcepts: string[];
  matchedSessions: string[];
  narrativeState?: string;
}

export function calculateOntologyBonus(
  chunkId: string,
  queries: string[]
): OntologyScoreResult {
  const annotation = ontologyLoader.getAnnotation(chunkId);
  if (!annotation) {
    return { bonus: 0, matchedConcepts: [], matchedSessions: [] };
  }

  let bonus = 0;
  const matchedConcepts: string[] = [];
  const matchedSessions: string[] = [];

  // 0. Narrative Continuity Bonus (New for Phase 3)
  const narrativeBonus = calculateNarrativeBonus(annotation, queries);
  bonus += narrativeBonus;

  // 1. Concept Matching (Highest Weight)
  const seenCanonicals = new Set<string>();
  for (const query of queries) {
    const queryCanonical = ontologyLoader.getCanonical(query);
    if (!queryCanonical) continue;

    if (seenCanonicals.has(queryCanonical)) continue;

    for (const concept of annotation.concepts) {
      if (concept.canonical === queryCanonical) {
        // High confidence match
        bonus += 0.15 * concept.confidence;
        matchedConcepts.push(concept.canonical);
        seenCanonicals.add(queryCanonical);
      }
    }
  }

  // 2. Intent-Based Boosting (Session & Time)
  const queryIntents = queries.map(q => classifyIntent(q));
  
  const hasSessionIntent = queryIntents.some(i => i.intent === QueryIntent.SESSION);
  const hasTimeIntent = queryIntents.some(i => i.intent === QueryIntent.TIME);

  if (hasSessionIntent) {
    for (const query of queries) {
      const qLower = query.toLowerCase();
      for (const tag of annotation.session_tags) {
        if (qLower.includes(tag.toLowerCase())) {
          bonus += 0.05;
          matchedSessions.push(tag);
        }
      }
    }
  }

  if (hasTimeIntent) {
    for (const query of queries) {
      const qLower = query.toLowerCase();
      for (const tag of annotation.temporal_tags) {
        if (qLower.includes(tag.toLowerCase())) {
          bonus += 0.03;
        }
      }
    }
  }

  // 3. Narrative Roles (Low Weight, Informational)
  for (const query of queries) {
    const qLower = query.toLowerCase();
    for (const concept of annotation.concepts) {
      if (concept.narrative_roles) {
        for (const role of concept.narrative_roles) {
          if (qLower.includes(role.toLowerCase().replace(/_/g, " "))) {
            bonus += 0.01;
          }
        }
      }
    }
  }

  // Cap the total ontology bonus to ensure it doesn't overwhelm vector/lexical
  return {
    bonus: Math.min(bonus, 0.30), 
    matchedConcepts: [...new Set(matchedConcepts)],
    matchedSessions: [...new Set(matchedSessions)],
    narrativeState: annotation.narrative_metadata?.state?.value
  };
}

/**
 * Calculates a small bonus for narrative continuity.
 * Capped at 0.05 to ensure soft-bias as per Phase 3 requirements.
 */
function calculateNarrativeBonus(annotation: any, queries: string[]): number {
  if (!annotation.narrative_metadata || !annotation.narrative_metadata.links) return 0;

  let narrativeBonus = 0;
  const qLower = queries.join(" ").toLowerCase();

  // 1. State Alignment (e.g., query asks for "reversal" and chunk is in REVERSAL state)
  const state = annotation.narrative_metadata.state;
  if (state && qLower.includes(state.value.toLowerCase())) {
    narrativeBonus += 0.02 * state.confidence;
  }

  // 2. Link Consistency (Soft bias for chunks connected to relevant neighbors)
  for (const link of annotation.narrative_metadata.links) {
    if (link.confidence < 0.6) continue; 

    if (qLower.includes("after") || qLower.includes("following") || qLower.includes("then")) {
        if (link.type === "TEMPORAL_PREV" || link.type === "NARRATIVE_PREDECESSOR") {
            narrativeBonus += 0.01 * link.confidence;
        }
    }
    
    if (qLower.includes("before") || qLower.includes("prior to") || qLower.includes("leads to")) {
        if (link.type === "TEMPORAL_NEXT" || link.type === "NARRATIVE_SUCCESSOR") {
            narrativeBonus += 0.01 * link.confidence;
        }
    }
  }

  return Math.min(narrativeBonus, 0.05);
}
