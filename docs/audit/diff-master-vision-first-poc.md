# Branch Difference Audit: Master vs. Vision-First-POC

This document details the code differences between the `master` baseline and the `vision-first-poc` branch, including the latest fixes for pinning the `currentCaptureId` context.

## Summary of Changes

| File Path | Description |
| --- | --- |
| [`core/3.query/agents/htf/htf-macro-agent.ts`](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/htf/htf-macro-agent.ts) | Integrates vision fact extraction, concepts extraction from vision summary, and 3-lane query merge support. |
| [`core/3.query/agents/shared/base-agent.ts`](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts) | Pins `global.currentCaptureId` when writing RAG and vision debug logs to ensure they go to a single directory. |
| [`core/3.query/ontology/loader.ts`](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/ontology/loader.ts) | Adjusted classification and mapping functions for ontology schemas. |
| [`core/3.query/orchestrators/master-orchestrator.ts`](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/orchestrators/master-orchestrator.ts) | Pin `global.currentCaptureId` at consolidated master orchestrator entry, and handle macro event tracking. |
| [`core/3.query/query-builder.ts`](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts) | Avoid folder splitting inside `buildQueries` by pinning `global.currentCaptureId`. |
| [`core/3.query/rag-orchestrator.ts`](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/rag-orchestrator.ts) | Orchestration updates for vision-first capabilities. |
| [`core/3.query/rerank.ts`](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/rerank.ts) | Pin `global.currentCaptureId` across all rerank log paths. |
| [`core/3.query/retrieval-core.ts`](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts) | Pin `global.currentCaptureId` in RAG and search tracing outputs. |
| [`core/4.output/run-system.ts`](file:///d:/10.%20ict-scholar-agents-V1/core/4.output/run-system.ts) | Added stable `captureId` injection/restoration wrapper block inside `runSystem`. |

---

## Detailed Code Diffs


### [htf-macro-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/htf/htf-macro-agent.ts)

**Path:** `core/3.query/agents/htf/htf-macro-agent.ts`

```diff
diff --git a/core/3.query/agents/htf/htf-macro-agent.ts b/core/3.query/agents/htf/htf-macro-agent.ts
index ec8e038..36f2659 100644
--- a/core/3.query/agents/htf/htf-macro-agent.ts
+++ b/core/3.query/agents/htf/htf-macro-agent.ts
@@ -57,6 +57,16 @@ export async function htfMacroAgent(input: HTFMacroInput, minimal_context: any):
       pushImage(parts, input.us20y?.d, "HTF-US20Y-D", callId);
     },
     useGroundingVerification: true,
+    visionPrompt: `Analyze ALL attached chart images for LIVE ICT macro observations.
+
+For each instrument (EURUSD, DXY, US10Y, US20Y), identify:
+
+1. **DXY Displacement Direction**: Is there a visible bearish/bullish displacement on the current candle? Note the displacement magnitude relative to prior candles.
+2. **Yield Direction**: Are yields rising or falling? Note any displacement or imbalance on US10Y/US20Y charts.
+3. **Correlated Asset Divergence**: Do DXY and US10Y move in the same direction? If DXY is bearish but US10Y is also falling (yields dropping), flag as divergence.
+4. **Order Blocks / FVG**: Note any visible order blocks or fair value gaps on daily or weekly timeframe, especially if they align with current price action.
+
+Output your observations as bullet points. Do NOT infer EURUSD directional bias. Just report raw chart observations.`,
     schema: htfMacroOutputSchema,
     mapOutput: (result) => {
       return {
```

---

### [base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts)

**Path:** `core/3.query/agents/shared/base-agent.ts`

```diff
diff --git a/core/3.query/agents/shared/base-agent.ts b/core/3.query/agents/shared/base-agent.ts
index 1bd5725..a88cc9d 100644
--- a/core/3.query/agents/shared/base-agent.ts
+++ b/core/3.query/agents/shared/base-agent.ts
@@ -2,6 +2,7 @@ import fs from "fs";
 import path from "path";
 import { retrieveRAG } from "../../retrieval-core.js";
 import { buildGrounded } from "../../grounding";
+import { attributionTracker } from "../../retrieval-attribution.js";
 
 import * as ragFs from "fs";
 
@@ -10,7 +11,10 @@ function ragDebugEnabled(): boolean {
 }
 
 function safeCaptureId(): string {
-  return ((global as any).currentCaptureId || Date.now().toString()).toString();
+  if (!(global as any).currentCaptureId) {
+    (global as any).currentCaptureId = Date.now().toString();
+  }
+  return ((global as any).currentCaptureId).toString();
 }
 
 function dumpRagArtifact(relativeFilePath: string, data: any, isText: boolean = false) {
@@ -41,6 +45,9 @@ function dumpRagDebug(agent: string, filename: string, data: any, isText: boolea
 }
 
 import { callLLM } from "../../../../shared/utils/llm-utils";
+import { buildVisionKnowledge, extractConceptsFromVision } from "../../vision-grounded-knowledge";
+import { visionFactExtractor } from "../../vision-signal-extractor";
+import { Pipeline, PipelineStep } from "../../vision-grounded-knowledge";
 import { verifyGrounding } from "../../../../shared/utils/grounding-verify";
 import { log } from "../../../../shared/utils/logger.js";
 import { buildPrompt } from "../../prompt-builder.js";
@@ -132,6 +139,10 @@ export interface AgentConfig<TInput, TOutput> {
   fallback: TOutput;
   useGroundingVerification?: boolean;
   schema: any; // ZodSchema
+  /** Vision-first prompt: instruction for extracting market state from charts.
+   *  If provided, agent runs vision extraction BEFORE RAG, using knowledge_map as grounded context.
+   *  Vision summary then feeds into query expansion for market-state-aware RAG. */
+  visionPrompt?: string;
 }
 
 function estimateTokens(value: any): number {
@@ -344,14 +355,103 @@ export async function runBaseAgent<TInput, TOutput>(
   const startTime = new Date().toISOString();
 
   try {
-    // 1. RAG
+    // 0. VISION-FIRST (if visionPrompt is set)
+    let visionSummary: string | null = null;
     const pipeline = loadPipeline(config.pipelinePath);
-    const concepts = extractConcepts(pipeline, config.step);
+    let concepts = extractConcepts(pipeline, config.step);
 
     const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
     const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));
 
-    const queries = buildQueries(concepts, knowledgeMap);
+    // Skip finalization if vision-first is enabled (queries will be merged with vision lanes)
+    let queries = buildQueries(
+      concepts,
+      knowledgeMap,
+      undefined,
+      undefined,
+      { skipFinalize: !!config.visionPrompt }
+    );
+
+    if (config.visionPrompt) {
+      // Build grounded knowledge for vision from pipeline concepts + knowledge_map
+      const visionGrounded = buildVisionKnowledge(pipeline, config.step, knowledgeMap);
+
+      // Call vision LLM with grounded context
+      const visionParts: any[] = [{ text: visionGrounded + "\n\n---\n\n" + config.visionPrompt }];
+      if (config.pushImages) {
+        config.pushImages(visionParts, input, callId);
+      }
+
+      dumpRagDebug(config.agentName, "00_VISION_INPUT.txt", visionGrounded + "\n\n---\n\n" + config.visionPrompt, true);
+
+      const visionResult = await callLLM(
+        visionGrounded + "\n\n---\n\n" + config.visionPrompt,
+        `${config.agentName}-vision`,
+        callId,
+        visionParts,
+        { returnTelemetry: false, responseType: "text" }
+      );
+      visionSummary = String(visionResult ?? "").trim();
+
+      dumpRagDebug(config.agentName, "00_VISION_SUMMARY.txt", visionSummary || "(empty)", true);
+
+      // 3-LANE VISION MERGE: Lane 0 (base) + Lane 1 (ontology concepts) + Lane 2 (raw observations)
+      if (visionSummary) {
+        const baseQueries = queries; // Lane 0: frozen baseline from pipeline concepts
+        
+        // Lane 1: Extract ontology concepts from vision summary
+        const visionConcepts = extractConceptsFromVision(visionSummary);
+        let visionConceptQueries = visionConcepts.length > 0 
+          ? buildQueries(visionConcepts, knowledgeMap)
+          : [];
+        
+        // Dedup Lane 1 against Lane 0 to avoid duplicate weight inflation
+        const normalizeQuery = (q: string) => q.toLowerCase().trim();
+        visionConceptQueries = visionConceptQueries.filter(vq => 
+          !baseQueries.some(bq => normalizeQuery(bq.query) === normalizeQuery(vq.query))
+        );
+        
+        // Lane 2: Extract vision facts from vision summary
+        const visionFacts = visionFactExtractor.extractFacts(visionSummary);
+        const visionFactQueries = visionFactExtractor.factsToQueries(visionFacts);
+        const visionObservationQueries = visionFactQueries.map((query: string) => ({
+          query,
+          weight: 0.9,
+          type: "anchor" as const
+        }));
+        
+        // Merge all 3 lanes at query level
+        const { finalizeWeightedQueries } = await import("../../query-builder");
+        queries = finalizeWeightedQueries(
+          [...baseQueries, ...visionConceptQueries, ...visionObservationQueries],
+          concepts[0] // mainConcept from pipeline
+        );
+        
+        // Dump vision artifacts
+        dumpRagDebug(config.agentName, "00_VISION_CONCEPTS.json", {
+          lane1_ontology_concepts: visionConcepts,
+          lane1_query_count: visionConceptQueries.length,
+        });
+        
+        dumpRagDebug(config.agentName, "00_VISION_SIGNALS.json", {
+          lane2_facts: visionFacts,
+          lane2_fact_queries: visionFactQueries,
+          lane2_query_count: visionObservationQueries.length,
+        });
+        
+        dumpRagDebug(config.agentName, "00_VISION_OBSERVATION_QUERIES.json", visionObservationQueries);
+        
+        dumpRagDebug(config.agentName, "00_MERGED_QUERIES.json", {
+          base_query_count: baseQueries.length,
+          vision_concept_query_count: visionConceptQueries.length,
+          vision_observation_query_count: visionObservationQueries.length,
+          final_merged_query_count: queries.length,
+          final_queries: queries,
+        });
+      }
+    }
+
+    // 1. RAG (using queries possibly expanded by vision)
 
     dumpRagDebug(config.agentName, "01_INPUT.json", {
       input,
@@ -386,6 +486,48 @@ export async function runBaseAgent<TInput, TOutput>(
 
     const conceptEmbeddings = await embedQueries(queries.map(q => q.query));
 
+    // Reset attribution tracker and register lane assignments for telemetry
+    attributionTracker.reset();
+    
+    // Register which queries belong to which lane (if vision-first was used)
+    if (config.visionPrompt && visionSummary) {
+      // Use unfinalized queries for lane registration (match what was used in merge)
+      const baseQueries = buildQueries(concepts, knowledgeMap, undefined, undefined, { skipFinalize: true });
+      const visionConcepts = extractConceptsFromVision(visionSummary);
+      const visionConceptQueries = visionConcepts.length > 0 
+        ? buildQueries(visionConcepts, knowledgeMap, undefined, undefined, { skipFinalize: true })
+        : [];
+      
+      // Extract fact queries for lane2 registration
+      const visionFacts = visionFactExtractor.extractFacts(visionSummary);
+      const visionFactQueries = visionFactExtractor.factsToQueries(visionFacts);
+      
+      const laneRegistrations: Array<{query: string, lane: "lane0" | "lane1" | "lane2"}> = [];
+      
+      // Register lane0 (base pipeline queries)
+      for (const q of baseQueries) {
+        laneRegistrations.push({ query: q.query, lane: "lane0" });
+      }
+      
+      // Register lane1 (vision ontology concepts)
+      for (const q of visionConceptQueries) {
+        laneRegistrations.push({ query: q.query, lane: "lane1" });
+      }
+      
+      // Register lane2 (vision facts)
+      for (const factQuery of visionFactQueries) {
+        laneRegistrations.push({ query: factQuery, lane: "lane2" });
+      }
+      
+      attributionTracker.registerLanes(laneRegistrations);
+    } else {
+      // No vision-first: all queries are lane0
+      const laneRegistrations = queries.map(q => ({ 
+        query: q.query, 
+        lane: "lane0" as const 
+      }));
+      attributionTracker.registerLanes(laneRegistrations);
+    }
 
     const memory: HierarchicalMemory = {
       theses: minimal_context?.parent_thesis
@@ -406,6 +548,7 @@ export async function runBaseAgent<TInput, TOutput>(
       scenarios: minimal_context?.scenario_context
     };
 
+    console.log("[TRACE] A-before-retrieveRAG", { agentName: config.agentName, queryCount: queries.length });
     const retrieved = await retrieveRAG({
       queries,
       conceptEmbeddings,
@@ -416,6 +559,7 @@ export async function runBaseAgent<TInput, TOutput>(
       scenarios: minimal_context?.scenario_context,
       pmso: minimal_context?.pmso_context
     });
+    console.log("[TRACE] B-after-retrieveRAG", { chunkCount: retrieved.chunks.length });
 
     dumpRagDebug(config.agentName, "04_SEARCH.json", {
       inputSymbol: Object.keys(input as any).find(k => k !== 'query' && typeof (input as any)[k] === 'object'),
@@ -432,6 +576,10 @@ export async function runBaseAgent<TInput, TOutput>(
     });
 
     const { chunks, expandedQueries, topKChunks } = retrieved;
+    
+    // Compute and dump retrieval attribution metrics
+    const attributionMetrics = attributionTracker.computeMetrics();
+    dumpRagDebug(config.agentName, "04_ATTRIBUTION.json", attributionMetrics);
 
 
 
@@ -465,6 +613,13 @@ export async function runBaseAgent<TInput, TOutput>(
     const groundedResult = buildGrounded(chunks, expandedQueries);
     const grounded = groundedResult.text;
 
+    // VISION-FIRST: inject vision summary as PRIMARY context before RAG context
+    let groundedWithVision = grounded;
+    if (visionSummary) {
+      groundedWithVision = `## LIVE MARKET OBSERVATIONS (VISION PRIMARY)\n${visionSummary}\n\n## HISTORICAL REFERENCE (RAG SECONDARY)\n${grounded}`;
+      dumpRagDebug(config.agentName, "06_GROUNDED_WITH_VISION.txt", groundedWithVision, true);
+    }
+
     dumpRagDebug(config.agentName, "06_GROUNDED.txt", grounded, true);
 
     // 06_GROUNDED_META.json (debug-only; derived from already-selected grounded chunks)
@@ -487,7 +642,7 @@ export async function runBaseAgent<TInput, TOutput>(
     const prompt = buildPrompt({
       role: config.role,
       task: config.task,
-      groundedKnowledge: grounded,
+      groundedKnowledge: groundedWithVision,
       inputContext: config.buildInputContext(input),
       constraints: config.constraints,
       outputFormat: config.outputFormat,
@@ -589,7 +744,7 @@ export async function runBaseAgent<TInput, TOutput>(
       _debug: {
         expandedQueries,
         topKChunks,
-        grounded,
+        grounded: groundedWithVision,
         references: (rawResult as any)?.references,
         telemetry,
       },
```

---

### [loader.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/ontology/loader.ts)

**Path:** `core/3.query/ontology/loader.ts`

```diff
diff --git a/core/3.query/ontology/loader.ts b/core/3.query/ontology/loader.ts
index 5a2bf50..8b62b57 100644
--- a/core/3.query/ontology/loader.ts
+++ b/core/3.query/ontology/loader.ts
@@ -108,6 +108,28 @@ class OntologyLoader {
     this.surfaceToCanonical.clear();
     return this.load();
   }
+
+  /**
+   * Find canonical concepts from free-text by matching against surface terms.
+   * Used by vision-first to detect concepts in vision summaries.
+   */
+  public findConceptsInText(text: string): string[] {
+    if (!text) return [];
+    
+    const textLower = text.toLowerCase();
+    const found = new Set<string>();
+    
+    // Match each surface term against the text (word boundary aware)
+    for (const [surfaceTerm, canonical] of this.surfaceToCanonical.entries()) {
+      // Create word boundary pattern: \b term \b
+      const pattern = new RegExp(`\\b${surfaceTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
+      if (pattern.test(textLower)) {
+        found.add(canonical);
+      }
+    }
+    
+    return Array.from(found);
+  }
 }
 
 export const ontologyLoader = new OntologyLoader();
```

---

### [master-orchestrator.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/orchestrators/master-orchestrator.ts)

**Path:** `core/3.query/orchestrators/master-orchestrator.ts`

```diff
diff --git a/core/3.query/orchestrators/master-orchestrator.ts b/core/3.query/orchestrators/master-orchestrator.ts
index b8c4a06..7546eb9 100644
--- a/core/3.query/orchestrators/master-orchestrator.ts
+++ b/core/3.query/orchestrators/master-orchestrator.ts
@@ -995,13 +995,16 @@ const masterDecisionTool = [{
 export async function runMasterOrchestrator(
   input: any
 ): Promise<MasterOutput> {
-  const validatedInput = MasterOrchestratorInputSchema.parse(input);
-  log({ stage: "MASTER_ORCHESTRATOR", message: "Starting Consolidated Master Orchestrator", data: { input: validatedInput } });
-
-  const captureId = (global as any).currentCaptureId || Date.now().toString();
+  if (!(global as any).currentCaptureId) {
+    (global as any).currentCaptureId = Date.now().toString();
+  }
+  const captureId = (global as any).currentCaptureId;
   const date = (global as any).currentDate;
   const session = (global as any).currentSession;
 
+  const validatedInput = MasterOrchestratorInputSchema.parse(input);
+  log({ stage: "MASTER_ORCHESTRATOR", message: "Starting Consolidated Master Orchestrator", data: { input: validatedInput } });
+
   const facts = PMSOReconciler.extractFactsFromOutputs([validatedInput.htf, validatedInput.itf, validatedInput.ltf, validatedInput.time]);
   let temporalState =
     validatedInput.hydration_context
```

---

### [query-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts)

**Path:** `core/3.query/query-builder.ts`

```diff
diff --git a/core/3.query/query-builder.ts b/core/3.query/query-builder.ts
index 8057443..0e497d0 100644
--- a/core/3.query/query-builder.ts
+++ b/core/3.query/query-builder.ts
@@ -1,5 +1,4 @@
 
-import { KnowledgeMapEntry } from "../../core/3.query/type/knowledge";
 import { ontologyLoader } from "./ontology/loader";
 import { classifyIntent, QueryIntent } from "./ontology/intent-classifier";
 import { RelationalContext } from "../../shared/knowledge/relational-types";
@@ -37,15 +36,21 @@ export function isValidQuery(q: string): boolean {
 
 export function buildQueries(
   concepts: string[],
-  knowledgeMap: KnowledgeMapEntry[],
+  knowledgeMap?: KnowledgeMapEntry[],
   relational?: RelationalContext,
-  scenarios?: ScenarioMemory
+  scenarios?: ScenarioMemory,
+  options?: { skipFinalize?: boolean }
 ): WeightedQuery[] {
+  const ENABLE_KM_TEMPLATES = false;
+
   const expanded: WeightedQuery[] = [];
   const mainConcept = concepts[0];
 
   const debugEnabled = process.env.RAG_DEBUG_DUMP === "true";
-  const captureId = (global as any).currentCaptureId || Date.now().toString();
+  if (!(global as any).currentCaptureId) {
+    (global as any).currentCaptureId = Date.now().toString();
+  }
+  const captureId = (global as any).currentCaptureId;
   const debugBaseDir = "data/rag-debug";
   const agentName = (process.env.RAG_DEBUG_AGENT_NAME || "RAG").toString();
 
@@ -58,7 +63,6 @@ export function buildQueries(
     try {
       if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
 
-
     } catch {
       // ignore
     }
@@ -68,7 +72,6 @@ export function buildQueries(
 
   const conceptsBefore = [...concepts];
 
-  const knowledgeMapTemplatesUsed: any[] = [];
   const ontologyExpansions: any[] = [];
   const scenarioExpansions: any[] = [];
   const relationalExpansions: any[] = [];
@@ -81,9 +84,46 @@ export function buildQueries(
       }
     : null;
 
-  for (const concept of concepts) {
-
+  // DISABLED AFTER RUNTIME AUDIT
+  // Evidence:
+  // 100 template queries generated
+  // 0 template queries executed
+  // 0 chunk hits
+  // See template-query-effectiveness-audit.md
+  if (ENABLE_KM_TEMPLATES && knowledgeMap) {
+    for (const concept of concepts) {
+      const normalizedConcept = concept.toLowerCase().trim();
+      const kmEntry = knowledgeMap.find(e => {
+        const eConcept = e.concept.toLowerCase().trim();
+        return (
+          eConcept === normalizedConcept ||
+          eConcept.includes(normalizedConcept) ||
+          normalizedConcept.includes(eConcept)
+        );
+      });
+      if (kmEntry) {
+        const templates = kmEntry.agent.query_templates
+          .filter(isValidQuery)
+          .filter(t => {
+            const lower = t.toLowerCase();
+            return (
+              !lower.includes("when") &&
+              !lower.includes("explain") &&
+              !lower.includes("retrieve")
+            );
+          });
+        for (const t of templates) {
+          expanded.push({
+            query: t,
+            weight: 0.5,
+            type: "context"
+          });
+        }
+      }
+    }
+  }
 
+  for (const concept of concepts) {
     if (!isValidQuery(concept)) continue;
 
     const intent = classifyIntent(concept);
@@ -115,65 +155,27 @@ export function buildQueries(
         });
       }
 
-      const registryEntry = ontologyLoader.getRegistryEntry(canonical);
-      if (registryEntry) {
-      for (const term of registryEntry.surface_terms) {
-          if (term.toLowerCase() !== concept.toLowerCase() && term.toLowerCase() !== canonical.toLowerCase()) {
-            expanded.push({
-              query: term,
-              weight: 0.4,
-              type: "alias"
-            });
-
-            ontologyExpansions.push({
-              source_concept: concept,
-              canonical,
-              alias: term,
-              generated_query: term,
-              kind: "alias",
-              weight: 0.4,
-            });
-          }
-        }
-      }
-    }
-
-    // 3. Knowledge Map Templates (Contextual)
-    const normalizedConcept = concept.toLowerCase().trim();
-    const kmEntry = knowledgeMap.find(e => {
-      const eConcept = e.concept.toLowerCase().trim();
-      return (
-        eConcept === normalizedConcept ||
-        eConcept.includes(normalizedConcept) ||
-        normalizedConcept.includes(eConcept)
-      );
-    });
-
-    if (kmEntry) {
-      const templates = kmEntry.agent.query_templates
-        .filter(isValidQuery)
-        .filter(t => {
-          const lower = t.toLowerCase();
-          return (
-            !lower.includes("when") &&
-            !lower.includes("explain") &&
-            !lower.includes("retrieve")
-          );
-        });
-
-      for (const t of templates) {
-        expanded.push({
-          query: t,
-          weight: 0.5,
-          type: "context"
-        });
-
-        knowledgeMapTemplatesUsed.push({
-          concept,
-          template: t,
-          generated_query: t,
-        });
-      }
+      // DISABLED: Alias Expansion (proven zero runtime impact - weight 0.4 queries dropped by 15-query cap)
+      // const registryEntry = ontologyLoader.getRegistryEntry(canonical);
+      // if (registryEntry) {
+      //   for (const term of registryEntry.surface_terms) {
+      //     if (term.toLowerCase() !== concept.toLowerCase() && term.toLowerCase() !== canonical.toLowerCase()) {
+      //       expanded.push({
+      //         query: term,
+      //         weight: 0.4,
+      //         type: "alias"
+      //       });
+      //       ontologyExpansions.push({
+      //         source_concept: concept,
+      //         canonical,
+      //         alias: term,
+      //         generated_query: term,
+      //         kind: "alias",
+      //         weight: 0.4,
+      //       });
+      //     }
+      //   }
+      // }
     }
 
     // 4. Intent-based Temporal/Session expansion
@@ -258,21 +260,38 @@ export function buildQueries(
     }
   }
 
+  // Skip finalization if requested (used when queries will be merged with vision lanes)
+  if (options?.skipFinalize) {
+    if (debugEnabled && fs && dumpDir) {
+      const payload = {
+        concepts_before_processing: conceptsBefore,
+        concepts_after_processing: [...new Set(concepts)].filter(Boolean),
+        anchor_query: anchorQuery,
+        ontologyExpansions,
+        scenarioExpansions,
+        relationalExpansions,
+        pre_final_queries_count: expanded.length,
+        note: "Finalization skipped - queries will be merged with vision lanes",
+      };
+      fs.writeFileSync(`${dumpDir}/02_QUERY_BUILD.json`, JSON.stringify(payload, null, 2), "utf8");
+    }
+    return expanded; // Return unsliced queries for fair lane competition
+  }
+
   const finalQueries = finalizeWeightedQueries(expanded, mainConcept);
 
   if (debugEnabled) {
-    const payload = {
-      concepts_before_processing: conceptsBefore,
-      concepts_after_processing: [...new Set(concepts)].filter(Boolean),
-      anchor_query: anchorQuery,
-      knowledgeMapTemplatesUsed,
-      ontologyExpansions,
-      scenarioExpansions,
-      relationalExpansions,
-      pre_final_queries_count: expanded.length,
-      final_query_count: finalQueries.length,
-      final_weighted_queries: finalQueries,
-    };
+      const payload = {
+        concepts_before_processing: conceptsBefore,
+        concepts_after_processing: [...new Set(concepts)].filter(Boolean),
+        anchor_query: anchorQuery,
+        ontologyExpansions,
+        scenarioExpansions,
+        relationalExpansions,
+        pre_final_queries_count: expanded.length,
+        final_query_count: finalQueries.length,
+        final_weighted_queries: finalQueries,
+      };
 
     // eslint-disable-next-line @typescript-eslint/no-var-requires
     // fs already imported via ESM; keep debug-only directory creation safe
@@ -289,7 +308,7 @@ export function buildQueries(
 // POST PROCESS
 // =======================
 
-function finalizeWeightedQueries(queries: WeightedQuery[], mainConcept: string): WeightedQuery[] {
+export function finalizeWeightedQueries(queries: WeightedQuery[], mainConcept: string): WeightedQuery[] {
   const MAX_QUERY = 15;
 
   const uniqueMap = new Map<string, WeightedQuery>();
```

---

### [rag-orchestrator.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/rag-orchestrator.ts)

**Path:** `core/3.query/rag-orchestrator.ts`

```diff
diff --git a/core/3.query/rag-orchestrator.ts b/core/3.query/rag-orchestrator.ts
index 0a3f04b..fe05ebf 100644
--- a/core/3.query/rag-orchestrator.ts
+++ b/core/3.query/rag-orchestrator.ts
@@ -14,7 +14,8 @@ export async function runRAG(pipelinePath: string, step?: string) {
     const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
     const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));
 
-    const queries = buildQueries(concepts, knowledgeMap);
+    const weightedQueries = buildQueries(concepts, knowledgeMap);
+    const queries = weightedQueries.map(q => q.query);
     const conceptEmbeddings = await embedQueries(queries);
 
     return retrieveRAG({
```

---

### [rerank.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/rerank.ts)

**Path:** `core/3.query/rerank.ts`

```diff
diff --git a/core/3.query/rerank.ts b/core/3.query/rerank.ts
index af8ec58..a416048 100644
--- a/core/3.query/rerank.ts
+++ b/core/3.query/rerank.ts
@@ -66,7 +66,10 @@ export async function rerank(
 ): Promise<Chunk[]> {
   if (process.env.RAG_DEBUG_DUMP === "true") {
     try {
-      const captureId = (global as any).currentCaptureId || Date.now().toString();
+      if (!(global as any).currentCaptureId) {
+        (global as any).currentCaptureId = Date.now().toString();
+      }
+      const captureId = (global as any).currentCaptureId;
       const agentName = "rerank";
       const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
       if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
@@ -96,7 +99,10 @@ export async function rerank(
   if (chunks.length <= 3) {
     if (process.env.RAG_DEBUG_DUMP === "true") {
       try {
-        const captureId = (global as any).currentCaptureId || Date.now().toString();
+        if (!(global as any).currentCaptureId) {
+          (global as any).currentCaptureId = Date.now().toString();
+        }
+        const captureId = (global as any).currentCaptureId;
         const agentName = "rerank";
         const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
         if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
@@ -128,7 +134,10 @@ export async function rerank(
 
       if (process.env.RAG_DEBUG_DUMP === "true") {
         try {
-          const captureId = (global as any).currentCaptureId || Date.now().toString();
+          if (!(global as any).currentCaptureId) {
+            (global as any).currentCaptureId = Date.now().toString();
+          }
+          const captureId = (global as any).currentCaptureId;
           const agentName = "rerank";
           const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
           if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
@@ -238,7 +247,10 @@ ${context}
 
   if (process.env.RAG_DEBUG_DUMP === "true") {
     try {
-      const captureId = (global as any).currentCaptureId || Date.now().toString();
+      if (!(global as any).currentCaptureId) {
+        (global as any).currentCaptureId = Date.now().toString();
+      }
+      const captureId = (global as any).currentCaptureId;
       const agentName = "rerank";
       const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
       if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
```

---

### [retrieval-core.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts)

**Path:** `core/3.query/retrieval-core.ts`

```diff
diff --git a/core/3.query/retrieval-core.ts b/core/3.query/retrieval-core.ts
index 1cd6973..12e59bc 100644
--- a/core/3.query/retrieval-core.ts
+++ b/core/3.query/retrieval-core.ts
@@ -76,6 +76,7 @@ import { ChunkAnnotation } from "../../shared/knowledge/ontology-types";
 import { ScenarioMemory } from "../../shared/knowledge/scenario-types";
 import { RelationalContext } from "../../shared/knowledge/relational-types";
 import { PMSO } from "../../shared/contracts/pmso";
+import { attributionTracker } from "./retrieval-attribution.js";
 
 // =======================
 // TYPES
@@ -695,12 +696,20 @@ function topKSimilar(queryVec: number[], vectors: ChunkVector[], topK: number):
   return heap.getResults();
 }
 
-async function vectorSearch(queryEmbeddings: number[][], weights: number[], symbol?: string): Promise<Chunk[]> {
+async function vectorSearch(
+  queryEmbeddings: number[][], 
+  weights: number[], 
+  queries: string[],
+  symbol?: string
+): Promise<Chunk[]> {
   const vectors = loadVectors(symbol);
   const allScored = new Map<string, Chunk>();
+  
   for (let i = 0; i < queryEmbeddings.length; i++) {
     const topK = i === 0 ? 40 : 25;
     const top = topKSimilar(queryEmbeddings[i], vectors, topK);
+    const chunkIds: string[] = [];
+    
     for (const res of top) {
       const weight = weights[i] || 0.7;
       const weightedScore = (res.score || 0) * weight;
@@ -708,6 +717,12 @@ async function vectorSearch(queryEmbeddings: number[][], weights: number[], symb
       if (!existing || weightedScore > (existing.score || 0)) {
         allScored.set(res.chunk_id, { ...res, score: weightedScore });
       }
+      chunkIds.push(res.chunk_id);
+    }
+    
+    // Track attribution: this query retrieved these chunks
+    if (queries[i]) {
+      attributionTracker.trackQueryChunks(queries[i], chunkIds);
     }
   }
   return Array.from(allScored.values());
@@ -717,11 +732,14 @@ function keywordSearch(queries: string[], weights: number[], symbol?: string): C
   const index = getBM25(symbol);
   const k1 = 1.2, b = 0.75;
   const allResults = new Map<string, Chunk>();
+  
   for (let i = 0; i < queries.length; i++) {
     const qTokens = tokenize(queries[i]);
     const docFreqs = new Map<string, number>();
     qTokens.forEach(t => docFreqs.set(t, index.docs.filter(doc => doc.tokens.includes(t)).length));
     const heap = new MinHeap(20);
+    const chunkIds: string[] = [];
+    
     for (const doc of index.docs) {
       let score = 0;
       qTokens.forEach(t => {
@@ -730,11 +748,22 @@ function keywordSearch(queries: string[], weights: number[], symbol?: string): C
         const f_q = doc.tokens.filter(tok => tok === t).length;
         score += (idf * (f_q * (k1 + 1))) / (f_q + k1 * (1 - b + b * (doc.tokens.length / index.avgdl)));
       });
-      if (score > 0) heap.push(score * (weights[i] || 1.0), { chunk_id: doc.chunk_id, text: doc.text });
+      if (score > 0) {
+        heap.push(score * (weights[i] || 1.0), { chunk_id: doc.chunk_id, text: doc.text });
+      }
     }
+    
     for (const res of heap.getResults()) {
       const existing = allResults.get(res.chunk_id);
-      if (!existing || (res.score || 0) > (existing.score || 0)) allResults.set(res.chunk_id, res);
+      if (!existing || (res.score || 0) > (existing.score || 0)) {
+        allResults.set(res.chunk_id, res);
+      }
+      chunkIds.push(res.chunk_id);
+    }
+    
+    // Track attribution: this query retrieved these chunks
+    if (queries[i]) {
+      attributionTracker.trackQueryChunks(queries[i], chunkIds);
     }
   }
   return Array.from(allResults.values());
@@ -755,6 +784,7 @@ export async function retrieveRAG(input: {
   relational?: RelationalContext;
   scenarios?: ScenarioMemory;
 }): Promise<{ chunks: Chunk[]; expandedQueries: string[]; topKChunks: number }> {
+  console.log("[TRACE] R1-enter", { queryCount: input.queries.length, agent: input.agentName });
   const rawQueries = input.queries;
   const originalQuery = typeof rawQueries[0] === "string" ? rawQueries[0] : rawQueries[0].query;
   if (input.queryId) retrievalTracer.startTrace(input.queryId, originalQuery);
@@ -766,14 +796,20 @@ export async function retrieveRAG(input: {
   const queriesOnly = weightedQueries.map(wq => wq.query);
   const weightsOnly = weightedQueries.map(wq => wq.weight);
   const queryEmbeddings = await embedQueries(queriesOnly);
+  console.log("[TRACE] R2-after-embed", { embeddingCount: queryEmbeddings.length });
+
   retrievalTracer.logExpandedQueries(queriesOnly);
 
-  const vectorResults = await vectorSearch(queryEmbeddings, weightsOnly, input.symbol);
+  const vectorResults = await vectorSearch(queryEmbeddings, weightsOnly, queriesOnly, input.symbol);
   const bm25Results = keywordSearch(queriesOnly, weightsOnly, input.symbol);
+  console.log("[TRACE] R3-after-search", { vectorCount: vectorResults.length, bm25Count: bm25Results.length });
 
   if (process.env.RAG_DEBUG_DUMP === "true") {
     try {
-      const captureId = (global as any).currentCaptureId || Date.now().toString();
+      if (!(global as any).currentCaptureId) {
+        (global as any).currentCaptureId = Date.now().toString();
+      }
+      const captureId = (global as any).currentCaptureId;
       const agentName = input.agentName || "RAG";
       const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
       if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
@@ -842,7 +878,10 @@ export async function retrieveRAG(input: {
 
   if (process.env.RAG_DEBUG_DUMP === "true") {
     try {
-      const captureId = (global as any).currentCaptureId || Date.now().toString();
+      if (!(global as any).currentCaptureId) {
+        (global as any).currentCaptureId = Date.now().toString();
+      }
+      const captureId = (global as any).currentCaptureId;
       const agentName = input.agentName || "RAG";
       const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
       if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
@@ -897,7 +936,10 @@ export async function retrieveRAG(input: {
 
     if (process.env.RAG_DEBUG_DUMP === "true") {
       try {
-        const captureId = (global as any).currentCaptureId || Date.now().toString();
+        if (!(global as any).currentCaptureId) {
+          (global as any).currentCaptureId = Date.now().toString();
+        }
+        const captureId = (global as any).currentCaptureId;
         const agentName = input.agentName || "RAG";
         const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
       if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
@@ -924,6 +966,7 @@ export async function retrieveRAG(input: {
 
     final = await rerank(rerankQuery, topCandidates as any, parentThesis, input.relational);
   }
+  console.log("[TRACE] R4-after-rerank", { candidateCount: topCandidates.length, finalCount: final.length });
   console.log(
     "[RETRIEVAL_CORE_WEEKLY_STAGE]",
     JSON.stringify({
@@ -936,7 +979,10 @@ export async function retrieveRAG(input: {
 
   if (process.env.RAG_DEBUG_DUMP === "true") {
     try {
-      const captureId = (global as any).currentCaptureId || Date.now().toString();
+      if (!(global as any).currentCaptureId) {
+        (global as any).currentCaptureId = Date.now().toString();
+      }
+      const captureId = (global as any).currentCaptureId;
       const agentName = input.agentName || "RAG";
       const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
       if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
```

---

### [run-system.ts](file:///d:/10.%20ict-scholar-agents-V1/core/4.output/run-system.ts)

**Path:** `core/4.output/run-system.ts`

```diff
diff --git a/core/4.output/run-system.ts b/core/4.output/run-system.ts
index 45c1002..04da49f 100644
--- a/core/4.output/run-system.ts
+++ b/core/4.output/run-system.ts
@@ -25,6 +25,22 @@ import type { MacroReleaseEvent } from "../../types/macro";
 import getLatestMacroHydration, { getLatestDailyHydration } from "../news/cognition/macro-context-hydrator.js";
 
 export async function runSystem(input: any, options?: { debug?: boolean; capturePath?: string }): Promise<SystemResult> {
+  // Pin a stable captureId for the entire run so all rag-debug dumps go into ONE folder.
+  // If runAnalysis already set it from metadata.json, keep that value; otherwise mint one now.
+  const _previousCaptureId = (global as any).currentCaptureId;
+  if (!(global as any).currentCaptureId) {
+    (global as any).currentCaptureId = `run-${Date.now()}`;
+  }
+
+  try {
+    return await _runSystemInner(input, options);
+  } finally {
+    // Restore previous value (or clear) so a long-lived server doesn't leak IDs across runs.
+    (global as any).currentCaptureId = _previousCaptureId;
+  }
+}
+
+async function _runSystemInner(input: any, options?: { debug?: boolean; capturePath?: string }): Promise<SystemResult> {
   // Do not invalidate retrieval cache on every run; preserves historical retrievals
   // invalidateRetrievalCache();
 

```

---
