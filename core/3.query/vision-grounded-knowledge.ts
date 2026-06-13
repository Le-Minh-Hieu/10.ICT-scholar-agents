import { KnowledgeMapEntry } from "./type/knowledge";
import { ontologyLoader } from "./ontology/loader";

export interface PipelineStep {
  name: string;
  concepts: string[];
}

export interface Pipeline {
  steps: PipelineStep[];
}

/**
 * Build vision grounded knowledge text from pipeline concepts + knowledge_map.
 * Uses agent fields: role, focus, signal, when_to_use, invalid_when (NO query_templates).
 */
export function buildVisionKnowledge(
  pipeline: Pipeline,
  stepName: string,
  knowledgeMap: KnowledgeMapEntry[]
): string {
  const step = pipeline.steps.find(s => s.name === stepName);
  if (!step) return "";

  const lines: string[] = [];
  lines.push("## VISION GROUNDED KNOWLEDGE");
  lines.push(`Step: ${stepName}`);
  lines.push(`You are analyzing LIVE charts. Below are the ICT concepts relevant to this analysis step, with their detection criteria and context.\n`);

  let matchedCount = 0;
  for (const concept of step.concepts) {
    const entry = knowledgeMap.find(k =>
      k.concept.toLowerCase().trim() === concept.toLowerCase().trim()
    );
    if (!entry?.agent) continue;
    matchedCount++;

    lines.push(`### ${entry.concept}`);
    lines.push(`- Type: ${entry.type}`);
    lines.push(`- Layer: ${entry.layer}`);
    lines.push(`- Role: ${entry.agent.role}`);
    if (entry.agent.focus?.length) {
      lines.push(`- Focus: ${entry.agent.focus.join(", ")}`);
    }
    if (entry.agent.signal) {
      lines.push(`- Signal: ${entry.agent.signal}`);
    }
    if (entry.agent.when_to_use) {
      lines.push(`- When to use: ${entry.agent.when_to_use}`);
    }
    if (entry.agent.invalid_when) {
      lines.push(`- Invalid when: ${entry.agent.invalid_when}`);
    }
    lines.push("");
  }

  lines.push(`--- End of vision grounded knowledge (${matchedCount} concepts matched)`);
  return lines.join("\n");
}

/**
 * Extract ICT concepts from vision summary using ontology surface term matching.
 * Lane 1: ontology-grounded concept detection.
 */
export function extractConceptsFromVision(visionSummary: string): string[] {
  if (!visionSummary) return [];
  return ontologyLoader.findConceptsInText(visionSummary);
}

/**
 * Extract raw observations from vision summary for direct query injection.
 * Lane 2: market-state observations without ontology mapping.
 */
export function extractVisionObservations(visionSummary: string): string[] {
  if (!visionSummary) return [];

  const observations: string[] = [];
  const lines = visionSummary.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match bullet points: "- ", "• ", or numbered "1. "
    const bulletMatch = trimmed.match(/^[-•]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);

    if (bulletMatch) {
      observations.push(bulletMatch[1].trim());
    } else if (numberedMatch) {
      observations.push(numberedMatch[1].trim());
    } else if (trimmed.length > 10) {
      // Fallback: include meaningful lines without bullet markers
      observations.push(trimmed);
    }
  }

  // Deduplicate
  return Array.from(new Set(observations));
}