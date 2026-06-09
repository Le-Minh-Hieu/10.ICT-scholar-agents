
import { KnowledgeMapEntry } from "../../core/3.query/type/knowledge";
import { ontologyLoader } from "./ontology/loader";
import { classifyIntent, QueryIntent } from "./ontology/intent-classifier";
import { RelationalContext } from "../../shared/knowledge/relational-types";
import { ScenarioMemory } from "../../shared/knowledge/scenario-types";
import fs from "fs";


export interface WeightedQuery {
  query: string;
  weight: number;
  type: "anchor" | "canonical" | "alias" | "context";
}

// =======================
// VALIDATION
// =======================

export function isValidQuery(q: string): boolean {
  const normalized = q.toLowerCase();

  const educationalWords = ["study", "learning", "how to", "basics", "mentorship", "education"];
  if (educationalWords.some(w => normalized.includes(w))) return false;

  const genericWords = ["tips", "advice", "best practices", "beginner", "generic"];
  if (genericWords.some(w => normalized.includes(w))) return false;

  if (q.length < 3) return false;

  return true;
}

// =======================
// QUERY BUILDER
// =======================

export function buildQueries(
  concepts: string[],
  knowledgeMap: KnowledgeMapEntry[],
  relational?: RelationalContext,
  scenarios?: ScenarioMemory
): WeightedQuery[] {
  const expanded: WeightedQuery[] = [];
  const mainConcept = concepts[0];

  const debugEnabled = process.env.RAG_DEBUG_DUMP === "true";
  const captureId = (global as any).currentCaptureId || Date.now().toString();
  const debugBaseDir = "data/rag-debug";
  const agentName = (process.env.RAG_DEBUG_AGENT_NAME || "RAG").toString();

  const dumpDir = debugEnabled
    ? `${debugBaseDir}/${captureId}/${agentName}`
    : "";

  const ensureDir = (p: string) => {
    if (!debugEnabled) return;
    try {
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });


    } catch {
      // ignore
    }
  };

  ensureDir(dumpDir);

  const conceptsBefore = [...concepts];

  const knowledgeMapTemplatesUsed: any[] = [];
  const ontologyExpansions: any[] = [];
  const scenarioExpansions: any[] = [];
  const relationalExpansions: any[] = [];

  const anchorQuery = mainConcept
    ? {
        query: mainConcept,
        weight: 1.0,
        type: "anchor" as const,
      }
    : null;

  for (const concept of concepts) {


    if (!isValidQuery(concept)) continue;

    const intent = classifyIntent(concept);
    const isAnchor = concept === mainConcept;

    // 1. Anchor Query (Weight 1.0)
    expanded.push({
      query: concept,
      weight: isAnchor ? 1.0 : 0.8,
      type: "anchor"
    });

    // 2. Ontology Expansion (Canonical & Aliases)
    const canonical = ontologyLoader.getCanonical(concept);
    if (canonical) {
      if (canonical.toLowerCase() !== concept.toLowerCase()) {
        expanded.push({
          query: canonical,
          weight: 0.7,
          type: "canonical"
        });

        ontologyExpansions.push({
          source_concept: concept,
          canonical,
          generated_query: canonical,
          kind: "canonical",
          weight: 0.7,
        });
      }

      const registryEntry = ontologyLoader.getRegistryEntry(canonical);
      if (registryEntry) {
      for (const term of registryEntry.surface_terms) {
          if (term.toLowerCase() !== concept.toLowerCase() && term.toLowerCase() !== canonical.toLowerCase()) {
            expanded.push({
              query: term,
              weight: 0.4,
              type: "alias"
            });

            ontologyExpansions.push({
              source_concept: concept,
              canonical,
              alias: term,
              generated_query: term,
              kind: "alias",
              weight: 0.4,
            });
          }
        }
      }
    }

    // 3. Knowledge Map Templates (Contextual)
    const normalizedConcept = concept.toLowerCase().trim();
    const kmEntry = knowledgeMap.find(e => {
      const eConcept = e.concept.toLowerCase().trim();
      return (
        eConcept === normalizedConcept ||
        eConcept.includes(normalizedConcept) ||
        normalizedConcept.includes(eConcept)
      );
    });

    if (kmEntry) {
      const templates = kmEntry.agent.query_templates
        .filter(isValidQuery)
        .filter(t => {
          const lower = t.toLowerCase();
          return (
            !lower.includes("when") &&
            !lower.includes("explain") &&
            !lower.includes("retrieve")
          );
        });

      for (const t of templates) {
        expanded.push({
          query: t,
          weight: 0.5,
          type: "context"
        });

        knowledgeMapTemplatesUsed.push({
          concept,
          template: t,
          generated_query: t,
        });
      }
    }

    // 4. Intent-based Temporal/Session expansion
    if (intent.intent === QueryIntent.TIME || intent.intent === QueryIntent.SESSION) {
      if (concept.toLowerCase().includes("silver bullet")) {
        expanded.push({ query: "10am to 11am New York time", weight: 0.25, type: "context" });
        expanded.push({ query: "fvg", weight: 0.25, type: "context" });
      }
    }
  }

  // 5. Anti-Tunnel-Vision Scenario Expansion (Phase 7)
  if (scenarios && scenarios.active_scenarios.length > 0) {
    for (const scenario of scenarios.active_scenarios) {
      if (scenario.confidence > 0.6) {
        const opposingTerms: Record<string, string> = {
          "CONTINUATION": "REVERSAL",
          "REVERSAL": "CONTINUATION",
          "RETRACEMENT": "EXPANSION",
          "LIQUIDITY_SWEEP": "FAILED_DISPLACEMENT"
        };

        const opposingType = opposingTerms[scenario.type] || "REVERSAL";
        const asset = mainConcept.split(" ")[0] || ""; // Extract asset from main concept

        expanded.push({
          query: `Evidence of ${asset} ${opposingType.toLowerCase()} to challenge the current ${scenario.type.toLowerCase()} scenario`,
          weight: 0.45,
          type: "context"
        });

        scenarioExpansions.push({
          scenario_type: scenario.type,
          confidence: scenario.confidence,
          generated_query: `Evidence of ${asset} ${opposingType.toLowerCase()} to challenge the current ${scenario.type.toLowerCase()} scenario`,
        });

        if (scenario.contradicting_anchors.length > 0) {
          expanded.push({
            query: `contradictory ICT levels: ${scenario.contradicting_anchors.join(", ")}`,
            weight: 0.4,
            type: "context"
          });
        }
      }
    }
  }

  // 6. Context-Gated Relational Expansion
  if (relational) {
    const isReversalContext = concepts.some(c => {
      const lower = c.toLowerCase();
      return lower.includes("reversal") || lower.includes("divergence") || lower.includes("smt") || lower.includes("turn");
    });

    if (isReversalContext) {
      for (const influence of relational.external_influences) {
        if (influence.confidence > 0.7) {
          expanded.push({
            query: `${influence.source_asset} ${influence.direction} ICT concepts`,
            weight: 0.3,
            type: "context"
          });

          relationalExpansions.push({
            relationship_type: "external_influence",
            confidence: influence.confidence,
            generated_query: `${influence.source_asset} ${influence.direction} ICT concepts`,
          });
        }
      }

      for (const smt of relational.smt_hints) {
        if (smt.confidence > 0.8) {
          expanded.push({
            query: `ICT SMT divergence ${smt.type} ${smt.assets.join(" ")}`,
            weight: 0.35,
            type: "context"
          });
        }
      }
    }
  }

  const finalQueries = finalizeWeightedQueries(expanded, mainConcept);

  if (debugEnabled) {
    const payload = {
      concepts_before_processing: conceptsBefore,
      concepts_after_processing: [...new Set(concepts)].filter(Boolean),
      anchor_query: anchorQuery,
      knowledgeMapTemplatesUsed,
      ontologyExpansions,
      scenarioExpansions,
      relationalExpansions,
      pre_final_queries_count: expanded.length,
      final_query_count: finalQueries.length,
      final_weighted_queries: finalQueries,
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // fs already imported via ESM; keep debug-only directory creation safe

    if (fs && dumpDir) {
      fs.writeFileSync(`${dumpDir}/02_QUERY_BUILD.json`, JSON.stringify(payload, null, 2), "utf8");
    }
  }

  return finalQueries;
}

// =======================
// POST PROCESS
// =======================

function finalizeWeightedQueries(queries: WeightedQuery[], mainConcept: string): WeightedQuery[] {
  const MAX_QUERY = 15;

  const uniqueMap = new Map<string, WeightedQuery>();
  for (const q of queries) {
    if (!isValidQuery(q.query)) continue;
    
    const lower = q.query.toLowerCase();
    if (lower.includes("when") || lower.includes("explain") || lower.includes("retrieve") || q.query.length > 80) {
      continue;
    }

    const existing = uniqueMap.get(q.query);
    if (!existing || q.weight > existing.weight) {
      uniqueMap.set(q.query, q);
    }
  }

  const result = Array.from(uniqueMap.values());
  result.sort((a, b) => b.weight - a.weight);

  return result.slice(0, MAX_QUERY);
}
