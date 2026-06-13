import fs from "fs";
import path from "path";
import { retrieveRAG } from "../../retrieval-core.js";
import { buildGrounded } from "../../grounding";
import { attributionTracker } from "../../retrieval-attribution.js";

import * as ragFs from "fs";

function ragDebugEnabled(): boolean {
  return process.env.RAG_DEBUG_DUMP === "true";
}

function safeCaptureId(): string {
  if (!(global as any).currentCaptureId) {
    (global as any).currentCaptureId = Date.now().toString();
  }
  return ((global as any).currentCaptureId).toString();
}

function dumpRagArtifact(relativeFilePath: string, data: any, isText: boolean = false) {
  if (!ragDebugEnabled()) return;
  const captureId = safeCaptureId();
  const agentName = (relativeFilePath.split("/")[0] || "agent").toString();
  const outPath = path.join(process.cwd(), "data", "rag-debug", captureId, agentName, relativeFilePath.replace(`${agentName}/`, ""));
  const dir = path.dirname(outPath);
  if (!ragFs.existsSync(dir)) ragFs.mkdirSync(dir, { recursive: true });
  if (isText) {
    ragFs.writeFileSync(outPath, typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
  } else {
    ragFs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  }
}

function dumpRagDebug(agent: string, filename: string, data: any, isText: boolean = false) {
  if (!ragDebugEnabled()) return;
  const captureId = safeCaptureId();
  const outPath = path.join(process.cwd(), "data", "rag-debug", captureId, agent, filename);
  const dir = path.dirname(outPath);
  if (!ragFs.existsSync(dir)) ragFs.mkdirSync(dir, { recursive: true });
  if (isText) {
    ragFs.writeFileSync(outPath, typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
  } else {
    ragFs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  }
}

import { callLLM } from "../../../../shared/utils/llm-utils";
import { buildVisionKnowledge, extractConceptsFromVision } from "../../vision-grounded-knowledge";
import { visionFactExtractor } from "../../vision-signal-extractor";
import { Pipeline, PipelineStep } from "../../vision-grounded-knowledge";
import { verifyGrounding } from "../../../../shared/utils/grounding-verify";
import { log } from "../../../../shared/utils/logger.js";
import { buildPrompt } from "../../prompt-builder.js";
import { BaseDebugInfo } from "../../../../shared/contracts/common/base-agent";
import { StorageService } from "../../../../shared/services/storage-service.js";
import { loadPipeline, extractConcepts } from "../../pipeline-processor";
import { buildQueries } from "../../query-builder";
import { embedQueries } from "../../retrieval-core";
import { HierarchicalMemory } from "../../../../shared/knowledge/hierarchical-types";

// HELPERS
export function getMimeType(path: string | { type: 'image', mimeType: string, data: string }): string {
  if (typeof path === 'object' && path.type === 'image') {
    return path.mimeType;
  }
  if (typeof path === 'string') {
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    return "image/jpeg";
  }
  return "image/jpeg";
}

export function safeToBase64(path?: string | { type: 'image', mimeType: string, data: string } | null): { data: string | null; error?: string; size?: number } {
  if (!path) return { data: null, error: "Path is missing" };

  if (typeof path === 'object' && path.type === 'image') {
    return { data: path.data, size: path.data.length };
  }

  if (typeof path === 'string') {
    // If it's already base64 data, just return the data part
    if (path.startsWith("data:image")) {
      const data = path.split(",")[1];
      return { data, size: data.length };
    }

    if (!fs.existsSync(path)) return { data: null, error: "File not found" };
    const stats = fs.statSync(path);
    return { data: fs.readFileSync(path, "base64"), size: stats.size };
  }

  return { data: null, error: "Invalid input to safeToBase64" };
}

export function pushImage(parts: any[], path?: string | { type: 'image', mimeType: string, data: string } | null, imageName?: string, callId?: string) {
  const { data, error, size } = safeToBase64(path);

  // Mandatory IMAGE_TRACE
  log({
    stage: "IMAGE_TRACE", message: `Image Trace: ${imageName || 'unknown'}`, data: {
      agent: callId?.split('-')[0] || 'unknown',
      imageName,
      path: typeof path === 'string' ? path : 'object',
      hasPath: !!path,
      isBase64: typeof path === 'string' && path.startsWith("data:image"),
      size,
      status: data ? "SUCCESS" : "FAIL",
      error
    }, level: data ? "INFO" : "ERROR"
  });

  if (!data) {
    log({ stage: "IMAGE_INPUT_FAIL", message: `Mandatory image missing: ${imageName}`, data: { imageName, path, error }, level: "ERROR" });
    return;
  }

  parts.push({
    inlineData: {
      mimeType: getMimeType(path!),
      data,
    },
  });
}

export interface AgentConfig<TInput, TOutput> {
  agentName: string;
  pipelinePath: string;
  layer?: "htf" | "itf" | "ltf" | "time" | "master" | "confluence";
  step: string;
  role: string;
  task: string;
  constraints: string[];
  outputFormat: string;
  buildInputContext: (input: TInput) => string;
  pushImages?: (parts: any[], input: TInput, callId: string) => void;
  mapOutput?: (result: any, chunks: any[]) => TOutput;
  fallback: TOutput;
  useGroundingVerification?: boolean;
  schema: any; // ZodSchema
  /** Vision-first prompt: instruction for extracting market state from charts.
   *  If provided, agent runs vision extraction BEFORE RAG, using knowledge_map as grounded context.
   *  Vision summary then feeds into query expansion for market-state-aware RAG. */
  visionPrompt?: string;
}

function estimateTokens(value: any): number {
  try {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    return Math.ceil((raw?.length || 0) / 4);
  } catch {
    return 0;
  }
}

function truncateText(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function collectEvidenceRefs(output: any, chunks: any[]): string[] {
  const refs = new Set<string>();

  const candidates = [
    ...(Array.isArray(output?.references) ? output.references : []),
    ...(Array.isArray(output?._debug?.references) ? output._debug.references : []),
    ...(Array.isArray(chunks) ? chunks.slice(0, 8).map((chunk: any) => chunk?.chunk_id).filter(Boolean) : []),
  ];

  for (const ref of candidates) {
    refs.add(String(ref));
  }

  for (const fact of Array.isArray(output?.facts) ? output.facts : []) {
    for (const principle of Array.isArray(fact?.principles_applied) ? fact.principles_applied : []) {
      if (principle?.chunk_id) refs.add(String(principle.chunk_id));
    }
  }

  return Array.from(refs).slice(0, 10);
}

function collectKeyAnchors(output: any): string[] {
  const anchors = new Set<string>();

  const factAnchors = Array.isArray(output?.facts)
    ? output.facts.map((fact: any) => fact?.anchor).filter(Boolean)
    : [];
  const directAnchors = Array.isArray(output?.key_anchors)
    ? output.key_anchors
    : [];
  const listFields = ["targets", "sweeps", "inducement", "supporting_anchors", "contradicting_anchors"];

  for (const anchor of [...factAnchors, ...directAnchors]) {
    anchors.add(String(anchor));
  }

  for (const field of listFields) {
    if (Array.isArray(output?.[field])) {
      for (const item of output[field]) {
        anchors.add(String(item));
      }
    }
  }

  if (typeof output?.anchor === "string") {
    anchors.add(output.anchor);
  }

  return Array.from(anchors).slice(0, 8);
}

function deriveCompactOutput(output: any, chunks: any[], agentName: string) {
  const confidence =
    typeof output?.confidence === "number"
      ? output.confidence
      : typeof output?.confidence?.confidence === "number"
        ? output.confidence.confidence
        : 0;
  const reasoning = typeof output?.reasoning === "string" ? output.reasoning : "";
  const dominantFactors = Array.isArray(output?.dominant_factors)
    ? output.dominant_factors.slice(0, 6).map(String)
    : [];
  const keyAnchors = collectKeyAnchors(output);
  const evidenceRefs = collectEvidenceRefs(output, chunks);
  const internalConflict =
    Boolean(output?.opposing_evidence) ||
    reasoning.toLowerCase().includes("conflict") ||
    reasoning.toLowerCase().includes("however") ||
    reasoning.toLowerCase().includes("while");

  return {
    agent: agentName,
    directional_bias:
      output?.htf_bias ??
      output?.itf_bias ??
      output?.direction ??
      output?.entry_bias ??
      output?.structure_trend ??
      "unknown",
    probabilistic_state:
      output?.next_candle_bias ??
      output?.setup_type ??
      output?.pd_array_status ??
      output?.pd_array_state ??
      output?.structure_strength ??
      "unknown",
    confidence,
    continuation_confidence: confidence,
    retracement_risk:
      output?.setup_type === "pullback" ||
      String(output?.bias || "").includes("retracement") ||
      reasoning.toLowerCase().includes("retracement")
        ? "high"
        : "moderate",
    execution_risk:
      output?.execute === false && output?.confluence_score !== undefined
        ? "guarded"
        : "normal",
    macro_alignment:
      output?.macro_directional_alignment ??
      output?.directional_alignment ??
      (internalConflict ? "partial" : "aligned"),
    internal_conflict: internalConflict,
    ambiguity_level:
      confidence < 0.45 ? "high" : confidence < 0.7 ? "moderate" : "low",
    setup_type: output?.setup_type ?? null,
    trigger_state:
      typeof output?.execute === "boolean"
        ? { execute: output.execute, confluence_score: output?.confluence_score ?? null }
        : null,
    liquidity_context: {
      above: output?.liquidity?.above ?? null,
      below: output?.liquidity?.below ?? null,
      target_count: Array.isArray(output?.targets) ? output.targets.length : 0,
      sweep_count: Array.isArray(output?.sweeps) ? output.sweeps.length : 0,
    },
    pd_context: {
      zone: output?.pd_array_status ?? output?.pd_array_state ?? null,
      equilibrium: output?.equilibrium ?? null,
      range_high: output?.range_high ?? null,
      range_low: output?.range_low ?? null,
    },
    key_anchors: keyAnchors,
    dominant_factors: dominantFactors,
    evidence_refs: evidenceRefs,
    reasoning_summary: truncateText(reasoning, 420),
    derived_from: Object.keys(output || {}).filter((key) => !["_debug", "_raw", "compact_output"].includes(key)),
    metadata: {
      timestamp: new Date().toISOString(),
      freshness: "CURRENT",
    },
  };
}

export function sanitizeForOrchestration<T = any>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForOrchestration(item)) as T;
  }

  if (typeof value !== "object") {
    return value;
  }

  const obj = value as Record<string, any>;
  if (obj.compact_output && typeof obj.compact_output === "object") {
    return sanitizeForOrchestration(obj.compact_output) as T;
  }

  const sanitized: Record<string, any> = {};
  for (const [key, item] of Object.entries(obj)) {
    if ([
      "_debug",
      "_raw",
      "full_output",
      "full_output_snapshot",
      "hydration_context",
      "hydrationContext",
      "pmso_context",
      "parent_thesis",
      "relational_context",
      "scenario_context",
      "minimal_context",
    ].includes(key)) {
      continue;
    }
    sanitized[key] = sanitizeForOrchestration(item);
  }
  return sanitized as T;
}

/**
 * Standard Agent Orchestrator
 * Handles RAG -> Grounding -> Prompting -> LLM -> Response Parsing -> Validation
 */
export async function runBaseAgent<TInput, TOutput>(
  input: TInput,
  config: AgentConfig<TInput, TOutput>,
  minimal_context: any
): Promise<TOutput & { _debug?: BaseDebugInfo }> {
  const callId = `${config.agentName}-${Date.now()}`;
  log({
    stage: "BOUNDARY_TRACE", message: `Starting agent: ${config.agentName}`, data: {
      stage: `Agent:${config.agentName}`,
      step: config.step,
      callId,
      input: input // Logger will sanitize/truncate
    }
  });

  const startTime = new Date().toISOString();

  try {
    let unfinalizedBaseQueries: any[] = [];
    let unfinalizedVisionConceptQueries: any[] = [];
    let visionFactQueries: string[] = [];

    // 0. VISION-FIRST (if visionPrompt is set)
    let visionSummary: string | null = null;
    const pipeline = loadPipeline(config.pipelinePath);
    let concepts = extractConcepts(pipeline, config.step);

    const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
    const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));

    // Skip finalization if vision-first is enabled (queries will be merged with vision lanes)
    let queries = buildQueries(
      concepts,
      knowledgeMap,
      undefined,
      undefined,
      { skipFinalize: !!config.visionPrompt }
    );

    if (config.visionPrompt) {
      unfinalizedBaseQueries = queries;

      // Build grounded knowledge for vision from pipeline concepts + knowledge_map
      const visionGrounded = buildVisionKnowledge(pipeline, config.step, knowledgeMap);

      // Call vision LLM with grounded context
      const visionParts: any[] = [{ text: visionGrounded + "\n\n---\n\n" + config.visionPrompt }];
      if (config.pushImages) {
        config.pushImages(visionParts, input, callId);
      }

      dumpRagDebug(config.agentName, "00_VISION_INPUT.txt", visionGrounded + "\n\n---\n\n" + config.visionPrompt, true);

      const visionResult = await callLLM(
        visionGrounded + "\n\n---\n\n" + config.visionPrompt,
        `${config.agentName}-vision`,
        callId,
        visionParts,
        { returnTelemetry: false, responseType: "text" }
      );
      visionSummary = String(visionResult ?? "").trim();

      dumpRagDebug(config.agentName, "00_VISION_SUMMARY.txt", visionSummary || "(empty)", true);

      // 3-LANE VISION MERGE: Lane 0 (base) + Lane 1 (ontology concepts) + Lane 2 (raw observations)
      if (visionSummary) {
        const baseQueries = queries; // Lane 0: frozen baseline from pipeline concepts
        
        // Lane 1: Extract ontology concepts from vision summary
        const visionConcepts = extractConceptsFromVision(visionSummary);
        unfinalizedVisionConceptQueries = visionConcepts.length > 0 
          ? buildQueries(visionConcepts, knowledgeMap, undefined, undefined, { skipFinalize: true })
          : [];
        
        // Dedup Lane 1 against Lane 0 to avoid duplicate weight inflation
        const normalizeQuery = (q: string) => q.toLowerCase().trim();
        const dedupedVisionConceptQueries = unfinalizedVisionConceptQueries.filter(vq => 
          !baseQueries.some(bq => normalizeQuery(bq.query) === normalizeQuery(vq.query))
        );
        
        // Lane 2: Extract vision facts from vision summary
        const visionFacts = visionFactExtractor.extractFacts(visionSummary);
        visionFactQueries = visionFactExtractor.factsToQueries(visionFacts);
        const visionObservationQueries = visionFactQueries.map((query: string) => ({
          query,
          weight: 0.9,
          type: "anchor" as const
        }));
        
        // Merge all 3 lanes at query level
        const { finalizeWeightedQueries } = await import("../../query-builder");
        queries = finalizeWeightedQueries(
          [...baseQueries, ...dedupedVisionConceptQueries, ...visionObservationQueries],
          concepts[0] // mainConcept from pipeline
        );
        
        // Dump vision artifacts
        dumpRagDebug(config.agentName, "00_VISION_CONCEPTS.json", {
          lane1_ontology_concepts: visionConcepts,
          lane1_query_count: unfinalizedVisionConceptQueries.length,
        });
        
        dumpRagDebug(config.agentName, "00_VISION_SIGNALS.json", {
          lane2_facts: visionFacts,
          lane2_fact_queries: visionFactQueries,
          lane2_query_count: visionObservationQueries.length,
        });
        
        dumpRagDebug(config.agentName, "00_VISION_OBSERVATION_QUERIES.json", visionObservationQueries);
        
        dumpRagDebug(config.agentName, "00_MERGED_QUERIES.json", {
          base_query_count: baseQueries.length,
          vision_concept_query_count: unfinalizedVisionConceptQueries.length,
          vision_observation_query_count: visionObservationQueries.length,
          final_merged_query_count: queries.length,
          final_queries: queries,
        });
      }
    }

    // 1. RAG (using queries possibly expanded by vision)

    dumpRagDebug(config.agentName, "01_INPUT.json", {
      input,
      agent: config.agentName,
      layer: config.layer,
      step: config.step,
      pipelinePath: config.pipelinePath,
      pipeline: {
        path: config.pipelinePath,
        step: config.step,
        extractedConceptsCount: concepts.length
      },
      minimal_context: {
        parent_thesis: minimal_context?.parent_thesis ?? null,
        relational_context: minimal_context?.relational_context ?? null,
        scenario_context: minimal_context?.scenario_context ?? null,
        pmso_context: minimal_context?.pmso_context ?? null,
      },
      pmso_context_present: !!minimal_context?.pmso_context
    });

    dumpRagDebug(config.agentName, "02_QUERY_BUILD.json", {
      concepts,
      mainConcept: concepts[0] ?? null,
      knowledgeMapLoadedCount: Array.isArray(knowledgeMap) ? knowledgeMap.length : null
    });

    dumpRagDebug(config.agentName, "03_EXPANDED.json", {
      expandedQueries: queries,
      expandedQueriesCount: Array.isArray(queries) ? queries.length : 0
    });

    const conceptEmbeddings = await embedQueries(queries.map(q => q.query));

    // Reset attribution tracker and register lane assignments for telemetry
    attributionTracker.reset();
    
    // Register which queries belong to which lane (if vision-first was used)
    if (config.visionPrompt && visionSummary) {
      const laneRegistrations: Array<{query: string, lane: "lane0" | "lane1" | "lane2"}> = [];
      
      // Register lane0 (base pipeline queries)
      for (const q of unfinalizedBaseQueries) {
        laneRegistrations.push({ query: q.query, lane: "lane0" });
      }
      
      // Register lane1 (vision ontology concepts)
      for (const q of unfinalizedVisionConceptQueries) {
        laneRegistrations.push({ query: q.query, lane: "lane1" });
      }
      
      // Register lane2 (vision facts)
      for (const factQuery of visionFactQueries) {
        laneRegistrations.push({ query: factQuery, lane: "lane2" });
      }
      
      attributionTracker.registerLanes(laneRegistrations);
    } else {
      // No vision-first: all queries are lane0
      const laneRegistrations = queries.map(q => ({ 
        query: q.query, 
        lane: "lane0" as const 
      }));
      attributionTracker.registerLanes(laneRegistrations);
    }

    const memory: HierarchicalMemory = {
      theses: minimal_context?.parent_thesis
        ? {
          [minimal_context.parent_thesis.timeframe]:
            minimal_context.parent_thesis
        }
        : {},

      active_context: "M15",

      parent_anchor: minimal_context?.parent_thesis
        ? minimal_context.parent_thesis.timeframe
        : undefined,

      relational: minimal_context?.relational_context,

      scenarios: minimal_context?.scenario_context
    };

    console.log("[TRACE] A-before-retrieveRAG", { agentName: config.agentName, queryCount: queries.length });
    const retrieved = await retrieveRAG({
      queries,
      conceptEmbeddings,
      agentName: config.agentName,
      memory,
      symbol: Object.keys(input as any).find(k => k !== 'query' && typeof (input as any)[k] === 'object'),
      relational: minimal_context?.relational_context,
      scenarios: minimal_context?.scenario_context,
      pmso: minimal_context?.pmso_context
    });
    console.log("[TRACE] B-after-retrieveRAG", { chunkCount: retrieved.chunks.length });

    dumpRagDebug(config.agentName, "04_SEARCH.json", {
      inputSymbol: Object.keys(input as any).find(k => k !== 'query' && typeof (input as any)[k] === 'object'),
      queries,
      expandedQueries: retrieved.expandedQueries,
      topKChunks: retrieved.topKChunks,
      chunks: retrieved.chunks
    });

    dumpRagDebug(config.agentName, "05_RERANK.json", {
      // retrieveRAG does reranking internally; we snapshot the final top list here.
      // For deeper rerank internals, hook would be needed in retrieval-core.ts and rerank.ts.
      postRerankChunks: retrieved.chunks
    });

    const { chunks, expandedQueries, topKChunks } = retrieved;
    
    // Compute and dump retrieval attribution metrics
    const attributionMetrics = attributionTracker.computeMetrics();
    dumpRagDebug(config.agentName, "04_ATTRIBUTION.json", attributionMetrics);



    log({
      stage: "LINEAGE", message: `RAG boundary for ${config.agentName}`, data: {
        stage: "RAG",
        input: { pipelinePath: config.pipelinePath, step: config.step },
        output: { chunkCount: chunks.length, topKChunks }
      }
    });

    if (!chunks.length) {
      if (config.layer) {
        StorageService.persistAnalysisOutput(
          config.layer,
          config.agentName,
          config.fallback,
          "NO_DATA",
          "RAG returned zero chunks",
          input
        );
      }

      return {
        ...config.fallback,
        _debug: { expandedQueries, topKChunks, grounded: "" },
      };
    }

    // 2. GROUNDED
    const groundedResult = buildGrounded(chunks, expandedQueries, config.agentName);
    const grounded = groundedResult.text;

    // VISION-FIRST: inject vision summary as PRIMARY context before RAG context
    let groundedWithVision = grounded;
    if (visionSummary) {
      groundedWithVision = `## LIVE MARKET OBSERVATIONS (VISION PRIMARY)\n${visionSummary}\n\n## HISTORICAL REFERENCE (RAG SECONDARY)\n${grounded}`;
      dumpRagDebug(config.agentName, "06_GROUNDED_WITH_VISION.txt", groundedWithVision, true);
    }

    dumpRagDebug(config.agentName, "06_GROUNDED.txt", grounded, true);

    // 06_GROUNDED_META.json (debug-only; derived from already-selected grounded chunks)
    dumpRagDebug(config.agentName, "06_GROUNDED_META.json", {
      selected_chunk_ids: groundedResult.meta?.selected_chunk_ids ?? [],
      grounded_chunk_count: groundedResult.meta?.grounded_chunk_count ?? groundedResult.chunks.length,
      grounded_token_estimate:
        groundedResult.meta?.grounded_token_estimate ?? Math.ceil((grounded?.length || 0) / 4),
    });

    log({
      stage: "LINEAGE", message: `Grounding boundary for ${config.agentName}`, data: {
        stage: "GROUNDING",
        input: { chunkCount: chunks.length },
        output: { groundedLength: grounded.length }
      }
    });

    // 3. PROMPT
    const prompt = buildPrompt({
      role: config.role,
      task: config.task,
      groundedKnowledge: groundedWithVision,
      inputContext: config.buildInputContext(input),
      constraints: config.constraints,
      outputFormat: config.outputFormat,
    }, { parent_thesis: minimal_context?.parent_thesis });

    // 7. PROMPT dump (debug only)
    dumpRagDebug(config.agentName, "07_PROMPT.txt", prompt, true);

    // 4. VISION/LLM
    const parts: any[] = [{ text: prompt }];


    if (config.pushImages) {
      config.pushImages(parts, input, callId);
    }

    log({ stage: "BASE_AGENT", message: `Calling LLM for agent: ${config.agentName}`, data: { callId } });
    const rawLlmResult = await callLLM(prompt, config.agentName, callId, parts, { schema: config.schema, returnTelemetry: true });
    const rawResult = rawLlmResult.data;
    const telemetry = rawLlmResult.telemetry;

    dumpRagDebug(config.agentName, "08_RESPONSE.json", {
      callId,
      llm: {
        agentName: config.agentName,
        schema: config.schema ? true : false,
      },
      prompt,
      response: rawResult,
      telemetry,
      promptLength: prompt?.length,
    });

    log({ stage: "BASE_AGENT", message: `LLM Response received for agent: ${config.agentName}`, data: { callId } });


    log({
      stage: "LINEAGE", message: `LLM boundary for ${config.agentName}`, data: {
        stage: "LLM",
        output: rawResult
      }
    });

    // 5. GROUNDING VERIFICATION (Optional)
    if (typeof rawResult === 'object' && rawResult !== null) {
      if (config.useGroundingVerification) {
        const verify = verifyGrounding(rawResult, chunks);
        (rawResult as any)._grounding_valid = verify.valid;
        if (!verify.valid) {
          (rawResult as any).reasoning = ((rawResult as any).reasoning || (rawResult as any).notes || "") + "\n[WARNING: ...]";
          if (!(rawResult as any)._debug) (rawResult as any)._debug = {};
          (rawResult as any)._debug.warnings = [`Grounding failed: ${verify.reason}`];
        }
      } else {
        (rawResult as any)._grounding_valid = true;
      }
    }

    dumpRagDebug(config.agentName, "09_SUMMARY.json", {
      agent: config.agentName,
      expandedQueries,
      topKChunks,
      groundedLength: grounded?.length,
      groundedChunkIds: (chunks || []).slice(0, 10).map((c: any) => c?.chunk_id),
      responseShape: rawResult && typeof rawResult === 'object' ? Object.keys(rawResult) : typeof rawResult,
    });


    // 6. MAPPING & VALIDATION (Per-agent hooks)
    const finalResult = config.mapOutput

      ? config.mapOutput(rawResult, chunks)
      : (rawResult as TOutput);

    const compactOutput =
      deriveCompactOutput(finalResult, chunks, config.agentName);

    if (config.layer) {
      StorageService.persistAnalysisOutput(
        config.layer,
        config.agentName,
        finalResult,
        "SUCCESS",
        null,
        input
      );
    }

    log({
      stage: "AGENT_STATUS", message: `Agent ${config.agentName} completed`, data: {
        agent: { name: config.agentName },
        status: "SUCCESS"
      }
    });

    return {
      ...finalResult,
      compact_output: compactOutput,
      _debug: {
        expandedQueries,
        topKChunks,
        grounded: groundedWithVision,
        references: (rawResult as any)?.references,
        telemetry,
      },
    };
  } catch (error) {


    log({
      stage: "AGENT_STATUS", message: `Agent ${config.agentName} failed`, data: {
        agent: { name: config.agentName },
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error)
      }, level: "ERROR"
    });

    console.error(`[${config.agentName}] Error:`, error);
    return {
      ...config.fallback,
      _debug: {
        expandedQueries: [],
        topKChunks: 0,
        grounded: "",
        warnings: [error instanceof Error ? error.message : String(error)]
      },
    };
  }
}
