import fs from "fs";
import { KnowledgeMapEntry } from "../../core/3.query/type/knowledge";

export type PipelineConcept = string | { concept: string; [key: string]: any };

export interface PipelineStep {
  name: string;
  concepts: PipelineConcept[];
}

export interface RetrievalResult {
  [key: string]: KnowledgeMapEntry[];
}

// =======================
// LOAD
// =======================

export function loadPipeline(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// =======================
// EXTRACT
// =======================

export function extractConcepts(pipeline: any, step?: string): string[] {
  let concepts: string[] = [];

  if (pipeline.steps && Array.isArray(pipeline.steps)) {
    if (step) {
      const targetStep = pipeline.steps.find((s: any) => s.name === step);
      if (targetStep && Array.isArray(targetStep.concepts)) return targetStep.concepts;
    }

    pipeline.steps.forEach((s: any) => {
      if (s.concept) concepts.push(s.concept);
      else if (Array.isArray(s.concepts)) concepts.push(...s.concepts);
    });
  } else {
    for (const key in pipeline) {
      if (Array.isArray(pipeline[key])) {
        pipeline[key].forEach((item: any) => {
          if (item.concept) concepts.push(item.concept);
          else if (typeof item === "string") concepts.push(item);
        });
      }
    }
  }

  return [...new Set(concepts)];
}

// =======================
// NORMALIZE
// =======================

export function getConceptString(c: PipelineConcept): string {
  return typeof c === "string" ? c : c.concept;
}

// =======================
// PROCESS
// =======================

export function processPipeline(
  pipelinePath: string,
  knowledgeMap: KnowledgeMapEntry[],
  layerName: string
): RetrievalResult {
  const pipeline = loadPipeline(pipelinePath);

  let steps: PipelineStep[] = [];

  if (pipeline.steps && Array.isArray(pipeline.steps)) {
    if (pipeline.steps.length > 0 && pipeline.steps[0].concept) {
      steps = [{ name: "default", concepts: pipeline.steps }];
    } else {
      steps = pipeline.steps;
    }
  } else {
    for (const [key, value] of Object.entries(pipeline)) {
      if (Array.isArray(value)) {
        steps.push({ name: key, concepts: value as any[] });
      }
    }
  }

  const filteredEntries = knowledgeMap.filter(e => {
    let layers = e.layer.split("|").map(l => l.trim());

    if (e.type === "timing") layers.push("TIME");

    if (
      ["behavior", "rule", "model", "delivery", "imbalance"].includes(e.type)
    ) {
      layers.push("CONFLUENCE");
    }

    return layers.includes(layerName);
  });

  const result: RetrievalResult = {};

  for (const step of steps) {
    result[step.name] = [];
    const seenConcepts = new Set<string>();

    for (const rawConcept of step.concepts) {
      const conceptStr = getConceptString(rawConcept);
      const normalized = conceptStr.toLowerCase().trim();

      let matched = filteredEntries.find(
        e => e.concept.toLowerCase().trim() === normalized
      );

      if (!matched) {
        matched = filteredEntries.find(e => {
          const ec = e.concept.toLowerCase().trim();
          return ec.includes(normalized) || normalized.includes(ec);
        });
      }

      if (matched) {
        if (!seenConcepts.has(matched.concept)) {
          seenConcepts.add(matched.concept);
          result[step.name].push(matched);
        }
      } else {
        result[step.name].push({
          cluster_id: "MISSING",
          concept: conceptStr,
          type: "MISSING",
          layer: layerName,
          agent: {
            role: "MISSING",
            query_templates: [],
            focus: [],
            signal: "MISSING",
            when_to_use: "MISSING",
            invalid_when: "MISSING"
          },
          size: 0
        });
      }
    }
  }

  return result;
}