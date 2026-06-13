

console.log("TS VERSION:", import.meta.url);
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";
import { log } from "../../shared/utils/logger.js";

// ==========================================
// RUNTIME AUTHENTICATION VALIDATION
// ==========================================
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function validateAuthConfig() {
  const hasGCProject = !!GOOGLE_CLOUD_PROJECT;
  const hasGCCreds = !!GOOGLE_APPLICATION_CREDENTIALS;
  const hasGeminiKey = !!GEMINI_API_KEY;

  if (hasGCProject && hasGCCreds) {
    if (!fs.existsSync(GOOGLE_APPLICATION_CREDENTIALS!)) {
      log({ stage: "AUTH", message: `CRITICAL: Credential file NOT FOUND at ${GOOGLE_APPLICATION_CREDENTIALS}`, data: {}, level: "WARN" });
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file missing: ${GOOGLE_APPLICATION_CREDENTIALS}`);
    }

    console.log("------------------------------------------");
    console.log("AUTH MODE: GOOGLE CLOUD ADC");
    console.log(`PROJECT: ${GOOGLE_CLOUD_PROJECT}`);
    console.log(`LOCATION: ${GOOGLE_CLOUD_LOCATION}`);
    console.log("------------------------------------------");

    if (hasGeminiKey) {
      log({ stage: "AUTH", message: "WARNING: GEMINI_API_KEY is set but system is prioritizing Google Cloud Auth flow.", data: {}, level: "WARN" });
    }
  } else {
    log({
      stage: "AUTH", message: "CRITICAL: Google Cloud Auth configuration is incomplete.", data: {
        GOOGLE_CLOUD_PROJECT: hasGCProject ? "PRESENT" : "MISSING",
        GOOGLE_APPLICATION_CREDENTIALS: hasGCCreds ? "PRESENT" : "MISSING"
      }, level: "WARN"
    });

    console.log("FALLBACK BEHAVIOR: Attempting to use GEMINI_API_KEY if available. Google Cloud features will be disabled.");

    if (!hasGeminiKey) {
      throw new Error("CRITICAL: No authentication method available. Provide GOOGLE_CLOUD_PROJECT + GOOGLE_APPLICATION_CREDENTIALS or GEMINI_API_KEY.");
    }
  }
}

// Perform validation on module load
validateAuthConfig();


// ==========================================
// OLD VERTEX AI FLOW (DEPRECATED SDK)
// RETAINED FOR ROLLBACK
// DO NOT DELETE YET
// ==========================================
// import { VertexAI } from "@google-cloud/vertexai";

// ==========================================
// NEW GOOGLE GENAI FLOW
// ==========================================
import { GoogleGenAI } from "@google/genai";
import { rerank } from "./rerank";
import { KnowledgeMapEntry } from "../../core/3.query/type/knowledge";
import { processPipeline } from "./pipeline-processor";
import { WeightedQuery } from "./query-builder";
import { calculateOntologyBonus } from "./ontology/scorer";
import { retrievalTracer } from "../5.eval/tracer";
import { HierarchicalMemory, TimeframeThesis } from "../../shared/knowledge/hierarchical-types";
import { ChunkAnnotation } from "../../shared/knowledge/ontology-types";
import { ScenarioMemory } from "../../shared/knowledge/scenario-types";
import { RelationalContext } from "../../shared/knowledge/relational-types";
import { PMSO } from "../../shared/contracts/pmso";
import { attributionTracker } from "./retrieval-attribution.js";

// =======================
// TYPES
// =======================

export type PipelineConcept = string | { concept: string;[key: string]: any };

export interface PipelineStep {
  name: string;
  concepts: PipelineConcept[];
}

export interface RetrievalResult {
  [key: string]: KnowledgeMapEntry[];
}

export type Chunk = {
  chunk_id: string;
  text: string;
  score?: number;
  embedding?: number[];
};

type ChunkVector = Chunk & {
  embedding: number[];
};

type BM25Doc = {
  chunk_id: string;
  text: string;
  tokens: string[];
};

type BM25Index = {
  docs: BM25Doc[];
  avgdl: number;
  N: number;
};

// =======================
// CONFIG & CACHE
// =======================

import { VECTOR_STORE_DIR, CHUNK_DIR } from "../../shared/config/data-paths.js";

const VECTOR_DIR = VECTOR_STORE_DIR;
// OLD AI STUDIO FLOW
// const EMBED_MODEL = "gemini-embedding-001";
const EMBED_MODEL = "text-embedding-004";
const GLOBAL_TOP_K = 50;

const VECTOR_CACHE: Map<string, ChunkVector[]> = new Map();
const BM25_INDEX: Map<string, BM25Index> = new Map();
const QUERY_EMBED_CACHE = new Map<string, number[]>();

export function invalidateRetrievalCache(symbol?: string) {
  if (symbol) {
    VECTOR_CACHE.delete(symbol);
    BM25_INDEX.delete(symbol);
    log({ stage: "CACHE_INVALIDATE", message: `Cache invalidated for symbol: ${symbol}` });
  } else {
    VECTOR_CACHE.clear();
    BM25_INDEX.clear();
    QUERY_EMBED_CACHE.clear();
    log({ stage: "CACHE_INVALIDATE", message: "Global retrieval cache invalidated" });
  }
}

validateVectorStore();

function validateVectorStore() {
  if (!fs.existsSync(VECTOR_STORE_DIR)) {
    throw new Error(`CRITICAL: VECTOR_STORE_DIR does not exist: ${VECTOR_STORE_DIR}. Please run the ingestion and embedding scripts.`);
  }
  const vectorFiles = fs.readdirSync(VECTOR_STORE_DIR).filter(f => f.endsWith(".vectors.json"));
  if (vectorFiles.length === 0) {
    throw new Error(`CRITICAL: No .vectors.json files found in VECTOR_STORE_DIR: ${VECTOR_STORE_DIR}. Please run the embedding script.`);
  }

  const vectors = loadVectors("_global");
  if (vectors.length === 0) {
    throw new Error(`CRITICAL: Vector store is empty. loadVectors("_global") returned 0 vectors from ${VECTOR_STORE_DIR}.`);
  }

  const firstVector = vectors[0];
  const dimension = firstVector.embedding.length;

  log({
    stage: "VECTOR_STORE", message: "Vector store loaded", data: {
      directory: process.env.VECTOR_STORE_DIR,
      vectorCount: vectors.length,
      dimension: dimension,
    }
  });

  if (dimension !== 768) {
    log({ stage: "VECTOR_INTEGRITY_FAILURE", message: "Invalid vector dimension detected", data: { expected: 768, got: dimension }, level: "ERROR" });
    throw new Error(`CRITICAL: Invalid vector dimension detected. Expected 768, got ${dimension}. Please ensure the correct vector store is configured and that the re-embedding process is complete.`);
  }
}



// =======================
// UTILS
// =======================

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return v;
  return v.map((val) => val / norm);
}

function dotProduct(a: number[], b: number[]): number {
  let product = 0;
  for (let i = 0; i < a.length; i++) {
    product += a[i] * b[i];
  }
  return product;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
}

class MinHeap {
  heap: { score: number; item: any }[] = [];
  constructor(private maxSize: number) { }

  push(score: number, item: any) {
    if (this.heap.length < this.maxSize) {
      this.heap.push({ score, item });
      this.bubbleUp(this.heap.length - 1);
    } else if (score > this.heap[0].score) {
      this.heap[0] = { score, item };
      this.bubbleDown(0);
    }
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].score <= this.heap[index].score) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number) {
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      if (left < this.heap.length && this.heap[left].score < this.heap[smallest].score) smallest = left;
      if (right < this.heap.length && this.heap[right].score < this.heap[smallest].score) smallest = right;
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }

  getResults() {
    return this.heap.sort((a, b) => b.score - a.score).map((h) => ({ ...h.item, score: h.score }));
  }
}

// =======================
// 1. EMBEDDING BATCHING
// =======================

export async function embedQueries(queries: string[]): Promise<number[][]> {
  const results: number[][] = new Array(queries.length);
  const toFetch: { query: string; index: number }[] = [];

  queries.forEach((q, i) => {
    if (QUERY_EMBED_CACHE.has(q)) {
      results[i] = QUERY_EMBED_CACHE.get(q)!;
    } else {
      toFetch.push({ query: q, index: i });
    }
  });

  if (toFetch.length > 0) {
    const PROJECT_ID = GOOGLE_CLOUD_PROJECT;
    const LOCATION = GOOGLE_CLOUD_LOCATION;

    const isVertex = !!PROJECT_ID && !!GOOGLE_APPLICATION_CREDENTIALS;
    const aiOptions: any = {
      vertexai: isVertex,
    };

    if (isVertex) {
      aiOptions.project = PROJECT_ID;
      aiOptions.location = LOCATION;
    } else {
      if (GEMINI_API_KEY) {
        aiOptions.apiKey = GEMINI_API_KEY;
      } else {
        throw new Error("No valid Google Cloud project or Gemini API Key found for embedding.");
      }
    }

    const ai = new GoogleGenAI(aiOptions);
    const actualModel = isVertex ? EMBED_MODEL : "gemini-embedding-001";

    const BATCH_SIZE = 5;
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const currentBatch = toFetch.slice(i, i + BATCH_SIZE);

      let success = false;
      let retries = 0;
      const MAX_RETRIES = 3;

      while (!success && retries < MAX_RETRIES) {
        try {
          log({
            stage: "RETRIEVAL_CORE", message: "GoogleGenAI Embedding Request", data: {
              batch_size: currentBatch.length,
              attempt: retries + 1,
              queries: currentBatch.map(b => b.query.substring(0, 50) + "...")
            }
          });

          const response = await ai.models.embedContent({
            model: actualModel,
            contents: currentBatch.map(b => b.query)
          });

          const embeddings = response.embeddings;
          if (!embeddings || embeddings.length !== currentBatch.length) {
            throw new Error(`GoogleGenAI returned invalid embeddings count: expected ${currentBatch.length}, got ${embeddings?.length}`);
          }

          embeddings.forEach((e: any, j: number) => {
            if (!e.values) {
              log({ stage: "RETRIEVAL_CORE", message: "Empty values in embedding response", data: { index: j }, level: "ERROR" });
              return;
            }
            const vec = normalize(e.values);

            const cachedVectors = loadVectors();
            if (cachedVectors && cachedVectors.length > 0) {
              const expectedDim = cachedVectors[0].embedding.length;
              if (vec.length !== expectedDim) {
                log({
                  stage: "VECTOR_INTEGRITY_FAILURE", message: "DIMENSION_MISMATCH", data: {
                    expected: expectedDim,
                    got: vec.length,
                    model: EMBED_MODEL,
                    warning: "CRITICAL: Vector dimension mismatch detected! Re-embedding vector DB is required for valid search results."
                  }, level: "WARN"
                });
              }
            }

            const originalIndex = currentBatch[j].index;
            const queryText = currentBatch[j].query;
            QUERY_EMBED_CACHE.set(queryText, vec);
            results[originalIndex] = vec;
          });

          success = true;
        } catch (error: any) {
          retries++;
          const errorMsg = error.message || String(error);
          const isQuota = errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota");
          const waitTime = isQuota ? 2000 * Math.pow(2, retries) : 1000;

          log({
            stage: "RETRIEVAL_CORE", message: "GoogleGenAI Embedding Error", data: {
              error: errorMsg,
              retry: retries,
              next_wait: waitTime
            }, level: "WARN"
          });

          if (retries >= MAX_RETRIES) throw error;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
  }

  return results;
}

// =======================
// 2. LOAD VECTORS
// =======================

function loadVectors(symbol?: string): ChunkVector[] {
  const cacheKey = symbol || "_global";
  if (VECTOR_CACHE.has(cacheKey)) {
    log({ stage: "CACHE_HIT", message: `Vector cache hit for symbol: ${cacheKey}` });
    return VECTOR_CACHE.get(cacheKey)!;
  }
  log({ stage: "CACHE_MISS", message: `Vector cache miss for symbol: ${cacheKey}` });


  const vectorDir = VECTOR_STORE_DIR;

  const symbolVectors: ChunkVector[] = [];
  if (fs.existsSync(vectorDir)) {
    let files = fs.readdirSync(vectorDir).filter((f) => f.endsWith(".vectors.json"));

    for (const file of files) {
      const content: ChunkVector[] = JSON.parse(fs.readFileSync(path.join(vectorDir, file), "utf8"));
      for (const v of content) {
        v.embedding = normalize(v.embedding);
      }
      symbolVectors.push(...content);
    }
  }

  VECTOR_CACHE.set(cacheKey, symbolVectors);
  log({ stage: "CACHE_CREATE", message: `Vector cache created for symbol: ${cacheKey}`, data: { count: symbolVectors.length } });

  return symbolVectors;
}

// =======================
// 3. BM25 INDEX
// =======================

function validateChunkStore() {
  if (!fs.existsSync(CHUNK_DIR)) {
    throw new Error(`CRITICAL: CHUNK_DIR does not exist: ${CHUNK_DIR}. Please run the ingestion and chunking scripts.`);
  }
  const chunkFiles = fs.readdirSync(CHUNK_DIR).filter(f => f.endsWith(".chunks.json"));
  if (chunkFiles.length === 0) {
    throw new Error(`CRITICAL: No .chunks.json files found in CHUNK_DIR: ${CHUNK_DIR}. Please run the chunking script.`);
  }
}

validateChunkStore();

function getBM25(symbol?: string): BM25Index {
  const cacheKey = symbol || "_global";
  if (BM25_INDEX.has(cacheKey)) {
    log({ stage: "CACHE_HIT", message: `BM25 index cache hit for symbol: ${cacheKey}` });
    return BM25_INDEX.get(cacheKey)!;
  }
  log({ stage: "CACHE_MISS", message: `BM25 index cache miss for symbol: ${cacheKey}` });

  const docs: BM25Doc[] = [];
  let totalLen = 0;

  if (fs.existsSync(CHUNK_DIR)) {
    let files = fs.readdirSync(CHUNK_DIR).filter((f) => f.endsWith(".chunks.json"));
    log({
      stage: "BM25_FILTER",
      message: "Using global BM25 corpus (symbol-agnostic retrieval)",
      data: {
        symbol,
        totalFiles: files.length
      }
    });
    for (const file of files) {
      const content: Chunk[] = JSON.parse(fs.readFileSync(path.join(CHUNK_DIR, file), "utf8"));
      for (const chunk of content) {
        const tokens = tokenize(chunk.text);
        docs.push({ ...chunk, tokens });
        totalLen += tokens.length;
      }
    }
  }
  if (docs.length === 0) {
    log({ stage: "BM25_INDEX", message: `BM25 index is empty for symbol: ${cacheKey}. Returning empty index.`, level: "WARN" });
    const emptyIndex: BM25Index = {
      docs: [],
      avgdl: 0,
      N: 0,
    };
    BM25_INDEX.set(cacheKey, emptyIndex);
    return emptyIndex;
  }

  const newIndex: BM25Index = {
    docs,
    avgdl: docs.length > 0 ? totalLen / docs.length : 0,
    N: docs.length,
  };

  BM25_INDEX.set(cacheKey, newIndex);
  log({ stage: "CACHE_CREATE", message: `BM25 index cache created for symbol: ${cacheKey}`, data: { docCount: docs.length } });


  return newIndex;
}

// =======================
// 4. SCORING & FUSION
// =======================

function computeConceptBonus(chunk: Chunk, conceptEmbeddings: number[][]): number {
  if (!chunk.embedding || conceptEmbeddings.length === 0) return 0;
  let maxSim = 0;
  for (const cEmb of conceptEmbeddings) {
    const sim = dotProduct(chunk.embedding, cEmb);
    if (sim > maxSim) maxSim = sim;
  }
  return maxSim > 0.7 ? 0.15 : 0;
}

function calculateRelationalBonus(chunk: Chunk, relational?: RelationalContext): number {
  if (!relational || !chunk.text) return 0;
  let totalBonus = 0;
  const text = chunk.text.toLowerCase();

  for (const smt of relational.smt_hints) {
    if (smt.confidence > 0.7) {
      if (text.includes("smt") || text.includes("divergence")) {
        if (smt.assets.some(a => text.includes(a.toLowerCase())) || text.includes(smt.type.toLowerCase())) {
          totalBonus += 0.03;
        }
      }
    }
  }

  for (const influence of relational.external_influences) {
    if (influence.confidence > 0.7) {
      const source = influence.source_asset.toLowerCase();
      if (text.includes(source)) {
        if (influence.direction.toLowerCase() === "bullish_pressure" && (text.includes("bullish") || text.includes("displacement"))) {
          totalBonus += 0.02;
        } else if (influence.direction.toLowerCase() === "bearish_pressure" && (text.includes("bearish") || text.includes("pressure"))) {
          totalBonus += 0.02;
        }
      }
    }
  }
  return Math.min(totalBonus, 0.05);
}

// Centralized PMSO boost helper to keep retrieval augmentation canonical
function applyPmsoBoosts(chunk: Chunk, pmso?: PMSO, chunkId?: string): number {
  if (!pmso || !chunk || !chunk.text) return 0;
  let pmsoBonus = 0;
  const text = chunk.text.toLowerCase();

  try {
    const opposing = pmso.market_context?.htf_bias?.opposing_evidence || [];
    for (const evidence of opposing) {
      if (typeof evidence === 'string' && text.includes(evidence.toLowerCase())) {
        pmsoBonus += 0.15;
        log({ stage: "ANTI_TUNNEL_VISION", message: "Boosting contradictory evidence from PMSO", data: { chunk_id: chunkId } });
      }
    }

    const bias = pmso.market_context?.htf_bias?.value;
    if (bias === "bearish" && (text.includes("premium") || text.includes("short"))) {
      pmsoBonus += 0.05;
    } else if (bias === "bullish" && (text.includes("discount") || text.includes("long"))) {
      pmsoBonus += 0.05;
    }
  } catch (e: any) {
    log({ stage: "MACRO_RETRIEVAL_TRACE", message: "applyPmsoBoosts failed", data: { error: e?.message }, level: "WARN" });
  }

  return pmsoBonus;
}

function fuseScores(
  vectorResults: Chunk[],
  bm25Results: Chunk[],
  conceptEmbeddings: number[][],
  queries: string[],
  parentThesis?: TimeframeThesis,
  relational?: RelationalContext,
  scenarios?: ScenarioMemory,
  pmso?: PMSO
): Chunk[] {
  const allIds = new Set([...vectorResults.map((r) => r.chunk_id), ...bm25Results.map((r) => r.chunk_id)]);

  const maxVec = Math.max(...vectorResults.map((r) => r.score || 0), 1);
  const maxBM = Math.max(...bm25Results.map((r) => r.score || 0), 1);

  const finalChunks: Chunk[] = [];

  for (const id of allIds) {
    const vMatch = vectorResults.find((r) => r.chunk_id === id);
    const bMatch = bm25Results.find((r) => r.chunk_id === id);
    const chunk = vMatch || bMatch!;
    if (!vMatch) {
      log({ stage: "FALLBACK_RETRIEVAL", message: "Chunk retrieved using BM25 only", data: { chunkId: id }, level: "WARN" });
    }

    const normVector = (vMatch?.score || 0) / maxVec;
    const normBM25 = (bMatch?.score || 0) / maxBM;

    const conceptBonus = computeConceptBonus(chunk, conceptEmbeddings);
    const ontResult = calculateOntologyBonus(id, queries);
    const ontologyBonus = ontResult.bonus;
    const relationalBonus = calculateRelationalBonus(chunk, relational);

    // Scenario-Aware Boosting & Anti-Tunnel-Vision (Phase 7)
    let scenarioBonus = 0;
    if (scenarios && scenarios.active_scenarios.length > 0) {
      const text = chunk.text.toLowerCase();
      for (const scenario of scenarios.active_scenarios) {
        if (scenario.confidence > 0.5) {
          const isSupporting = scenario.supporting_anchors.some(a => text.includes(a.toLowerCase()));
          if (isSupporting) scenarioBonus += 0.05;

          const isContradicting = scenario.contradicting_anchors.some(a => text.includes(a.toLowerCase())) ||
            scenario.contradicting_evidence.includes(id);
          if (isContradicting) {
            scenarioBonus += 0.15;
            log({ stage: "ANTI_TUNNEL_VISION", message: "Boosting contradictory evidence", data: { chunk_id: id, scenario: scenario.name } });
          }
        }
      }
    }

    let hierarchyBonus = 0;
    if (parentThesis) {
      const text = chunk.text.toLowerCase();
      const isBearish = parentThesis.bias.toLowerCase().includes("bearish");
      const isBullish = parentThesis.bias.toLowerCase().includes("bullish");
      if (isBearish && (text.includes("bearish") || text.includes("premium") || text.includes("short"))) {
        hierarchyBonus = 0.08;
      } else if (isBullish && (text.includes("bullish") || text.includes("discount") || text.includes("long"))) {
        hierarchyBonus = 0.08;
      }
    }

    if (ontologyBonus > 0) {
      retrievalTracer.logOntologyBoost(id, ontologyBonus, ontResult.matchedConcepts);
    }

    // PMSO-Aware Anti-Tunnel-Vision Boosting
    const pmsoBonus = applyPmsoBoosts(chunk, pmso, id);

    const score = 0.70 * normVector + 0.15 * normBM25 + conceptBonus + ontologyBonus + hierarchyBonus + relationalBonus + scenarioBonus + pmsoBonus;

    log({
      stage: "FUSE_SCORES", message: "Chunk Score Calculation", data: {
        chunkId: id,
        normVector: normVector,
        normBM25: normBM25,
        conceptBonus: conceptBonus,
        ontologyBonus: ontologyBonus,
        hierarchyBonus: hierarchyBonus,
        relationalBonus: relationalBonus,
        scenarioBonus: scenarioBonus,
        pmsoBonus: pmsoBonus,
        finalScore: score
      }
    });

    finalChunks.push({ ...chunk, score });
  }

  return finalChunks.sort((a, b) => (b.score || 0) - (a.score || 0));
}

// =======================
// 5. DEDUP & COMPRESSION
// =======================

function semanticDedup(chunks: Chunk[]): Chunk[] {
  if (chunks.length === 0) return [];
  const sorted = [...chunks].sort((a, b) => (b.score || 0) - (a.score || 0));
  const unique: Chunk[] = [];
  for (const chunk of sorted) {
    let isDuplicate = false;
    if (chunk.embedding) {
      for (const u of unique) {
        if (u.embedding) {
          const sim = dotProduct(chunk.embedding, u.embedding);
          if (sim > 0.9) {
            isDuplicate = true;
            break;
          }
        }
      }
    }
    if (!isDuplicate) unique.push(chunk);
  }
  return unique;
}

function compressChunkText(text: string, maxLen = 300): string {
  if (text.length <= maxLen) return text;
  const sentences = text.split(/[.!?]/);
  let result = "";
  for (const s of sentences) {
    if (result.length + s.length > maxLen) break;
    result += s.trim() + ". ";
  }
  return result.trim();
}

function limitTokens(chunks: Chunk[], maxTokens = 1000): Chunk[] {
  let currentTokens = 0;
  const limited: Chunk[] = [];
  for (const chunk of chunks) {
    const est = Math.ceil(chunk.text.length / 4);
    if (currentTokens + est > maxTokens) break;
    limited.push(chunk);
    currentTokens += est;
  }
  return limited;
}

// =======================
// 6. SEARCH LOGIC
// =======================

function topKSimilar(queryVec: number[], vectors: ChunkVector[], topK: number): Chunk[] {
  const heap = new MinHeap(topK);
  let searchSpace = vectors.slice(0, 10000);
  for (const v of searchSpace) {
    const sim = dotProduct(queryVec, v.embedding);
    heap.push(sim, v);
  }
  return heap.getResults();
}

async function vectorSearch(
  queryEmbeddings: number[][], 
  weights: number[], 
  queries: string[],
  symbol?: string
): Promise<Chunk[]> {
  const vectors = loadVectors(symbol);
  const allScored = new Map<string, Chunk>();
  
  for (let i = 0; i < queryEmbeddings.length; i++) {
    const topK = i === 0 ? 40 : 25;
    const top = topKSimilar(queryEmbeddings[i], vectors, topK);
    const chunkIds: string[] = [];
    
    for (const res of top) {
      const weight = weights[i] || 0.7;
      const weightedScore = (res.score || 0) * weight;
      const existing = allScored.get(res.chunk_id);
      if (!existing || weightedScore > (existing.score || 0)) {
        allScored.set(res.chunk_id, { ...res, score: weightedScore });
      }
      chunkIds.push(res.chunk_id);
    }
    
    // Track attribution: this query retrieved these chunks
    if (queries[i]) {
      attributionTracker.trackQueryChunks(queries[i], chunkIds);
    }
  }
  return Array.from(allScored.values());
}

function keywordSearch(queries: string[], weights: number[], symbol?: string): Chunk[] {
  const index = getBM25(symbol);
  const k1 = 1.2, b = 0.75;
  const allResults = new Map<string, Chunk>();
  
  for (let i = 0; i < queries.length; i++) {
    const qTokens = tokenize(queries[i]);
    const docFreqs = new Map<string, number>();
    qTokens.forEach(t => docFreqs.set(t, index.docs.filter(doc => doc.tokens.includes(t)).length));
    const heap = new MinHeap(20);
    const chunkIds: string[] = [];
    
    for (const doc of index.docs) {
      let score = 0;
      qTokens.forEach(t => {
        const n_q = docFreqs.get(t) || 0;
        const idf = Math.log((index.N - n_q + 0.5) / (n_q + 0.5) + 1);
        const f_q = doc.tokens.filter(tok => tok === t).length;
        score += (idf * (f_q * (k1 + 1))) / (f_q + k1 * (1 - b + b * (doc.tokens.length / index.avgdl)));
      });
      if (score > 0) {
        heap.push(score * (weights[i] || 1.0), { chunk_id: doc.chunk_id, text: doc.text });
      }
    }
    
    for (const res of heap.getResults()) {
      const existing = allResults.get(res.chunk_id);
      if (!existing || (res.score || 0) > (existing.score || 0)) {
        allResults.set(res.chunk_id, res);
      }
      chunkIds.push(res.chunk_id);
    }
    
    // Track attribution: this query retrieved these chunks
    if (queries[i]) {
      attributionTracker.trackQueryChunks(queries[i], chunkIds);
    }
  }
  return Array.from(allResults.values());
}

// =======================
// 7. PUBLIC API
// =======================

export async function retrieveRAG(input: {
  queries: string[] | WeightedQuery[];
  conceptEmbeddings: number[][];
  agentName?: string;
  queryId?: string;
  memory?: HierarchicalMemory;
  pmso?: PMSO;
  symbol?: string;
  relational?: RelationalContext;
  scenarios?: ScenarioMemory;
}): Promise<{ chunks: Chunk[]; expandedQueries: string[]; topKChunks: number }> {
  console.log("[TRACE] R1-enter", { queryCount: input.queries.length, agent: input.agentName });
  const rawQueries = input.queries;
  const originalQuery = typeof rawQueries[0] === "string" ? rawQueries[0] : rawQueries[0].query;
  if (input.queryId) retrievalTracer.startTrace(input.queryId, originalQuery);

  const weightedQueries: WeightedQuery[] = rawQueries.map(q =>
    typeof q === "string" ? { query: q, weight: 1.0, type: "anchor" } : q
  );

  const queriesOnly = weightedQueries.map(wq => wq.query);
  const weightsOnly = weightedQueries.map(wq => wq.weight);
  const queryEmbeddings = await embedQueries(queriesOnly);
  console.log("[TRACE] R2-after-embed", { embeddingCount: queryEmbeddings.length });

  retrievalTracer.logExpandedQueries(queriesOnly);

  const vectorResults = await vectorSearch(queryEmbeddings, weightsOnly, queriesOnly, input.symbol);
  const bm25Results = keywordSearch(queriesOnly, weightsOnly, input.symbol);
  console.log("[TRACE] R3-after-search", { vectorCount: vectorResults.length, bm25Count: bm25Results.length });

  if (process.env.RAG_DEBUG_DUMP === "true") {
    try {
      if (!(global as any).currentCaptureId) {
        (global as any).currentCaptureId = Date.now().toString();
      }
      const captureId = (global as any).currentCaptureId;
      const agentName = input.agentName || "RAG";
      const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
      if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });


      fs.writeFileSync(
        `${dumpDir}/04_VECTOR_RESULTS.json`,

        JSON.stringify(
          {
            query_count: queriesOnly.length,
            result_count: vectorResults.length,
            results: vectorResults.map((c: any) => ({ chunk_id: c.chunk_id, score: c.score, text: c.text }))
          },
          null,
          2
        ),
        "utf8"
      );

      fs.writeFileSync(
        `${dumpDir}/04_BM25_RESULTS.json`,

        JSON.stringify(
          {
            query_count: queriesOnly.length,
            result_count: bm25Results.length,
            results: bm25Results.map((c: any) => ({ chunk_id: c.chunk_id, score: c.score, text: c.text }))
          },
          null,
          2
        ),
        "utf8"
      );
    } catch {
      // ignore debug dump failures
    }
  }
  console.log(
    "[RETRIEVAL_CORE_WEEKLY_STAGE]",
    JSON.stringify({
      stage: "post_search",
      query_count: queriesOnly.length,
      vector_count: vectorResults.length,
      bm25_count: bm25Results.length,
      vector_ids: vectorResults.slice(0, 15).map((c) => c.chunk_id),
      bm25_ids: bm25Results.slice(0, 15).map((c) => c.chunk_id)
    })
  );
  retrievalTracer.logStep(vectorResults.length, bm25Results.length);

  const parentThesis = input.memory?.parent_anchor ? input.memory.theses[input.memory.parent_anchor] : undefined;

  if (!parentThesis) {
    log({ stage: "ENRICHMENT_DEBUG", message: "Parent thesis is missing", data: { queryId: input.queryId } });
  }
  if (!input.relational) {
    log({ stage: "ENRICHMENT_DEBUG", message: "Relational context is missing", data: { queryId: input.queryId } });
  }
  if (!input.scenarios) {
    log({ stage: "ENRICHMENT_DEBUG", message: "Scenarios are missing", data: { queryId: input.queryId } });
  }
  const pmso = input.pmso;

  let merged = fuseScores(vectorResults, bm25Results, input.conceptEmbeddings, queriesOnly, parentThesis, input.relational, input.scenarios, pmso);

  if (process.env.RAG_DEBUG_DUMP === "true") {
    try {
      if (!(global as any).currentCaptureId) {
        (global as any).currentCaptureId = Date.now().toString();
      }
      const captureId = (global as any).currentCaptureId;
      const agentName = input.agentName || "RAG";
      const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
      if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });


      fs.writeFileSync(
        `${dumpDir}/04_FUSED_RESULTS.json`,

        JSON.stringify(
          {
            result_count: merged.length,
            results: merged.map((c: any) => ({ chunk_id: c.chunk_id, score: c.score, text: c.text }))
          },
          null,
          2
        ),
        "utf8"
      );
    } catch {
      // ignore debug dump failures
    }
  }

  if (merged.length > 400) merged = merged.slice(0, 400);
  console.log(
    "[RETRIEVAL_CORE_WEEKLY_STAGE]",
    JSON.stringify({
      stage: "post_fuse",
      merged_count: merged.length,
      merged_ids: merged.slice(0, 20).map((c) => c.chunk_id)
    })
  );

  let deduped = semanticDedup(merged);
  const maxScore = Math.max(...deduped.map(c => c.score || 0), 0);
  let thresholdFiltered = deduped.filter(c => (c.score || 0) >= maxScore * 0.3);
  if (thresholdFiltered.length < 15) thresholdFiltered = deduped.slice(0, 25);
  console.log(
    "[RETRIEVAL_CORE_WEEKLY_STAGE]",
    JSON.stringify({
      stage: "post_filter",
      deduped_count: deduped.length,
      threshold_filtered_count: thresholdFiltered.length,
      threshold_filtered_ids: thresholdFiltered.slice(0, 20).map((c) => c.chunk_id)
    })
  );

  let topCandidates = thresholdFiltered.slice(0, 80);
  let final = topCandidates;
  if (topCandidates.length > 0) {
    const rerankQuery = queriesOnly.join(", ");

    if (process.env.RAG_DEBUG_DUMP === "true") {
      try {
        if (!(global as any).currentCaptureId) {
          (global as any).currentCaptureId = Date.now().toString();
        }
        const captureId = (global as any).currentCaptureId;
        const agentName = input.agentName || "RAG";
        const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
      if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });


        fs.writeFileSync(
          `${dumpDir}/05_RERANK_PRE.json`,

          JSON.stringify(
            {
              rerank_query: rerankQuery,
              candidate_count: topCandidates.length,
              candidate_order: topCandidates.map((c: any) => ({ chunk_id: c.chunk_id, score: c.score }))
            },
            null,
            2
          ),
          "utf8"
        );
      } catch {
        // ignore debug dump failures
      }
    }

    final = await rerank(rerankQuery, topCandidates as any, parentThesis, input.relational);
  }
  console.log("[TRACE] R4-after-rerank", { candidateCount: topCandidates.length, finalCount: final.length });
  console.log(
    "[RETRIEVAL_CORE_WEEKLY_STAGE]",
    JSON.stringify({
      stage: "post_rerank",
      top_candidates_count: topCandidates.length,
      final_count: final.length,
      final_ids: final.slice(0, 20).map((c) => c.chunk_id)
    })
  );

  if (process.env.RAG_DEBUG_DUMP === "true") {
    try {
      if (!(global as any).currentCaptureId) {
        (global as any).currentCaptureId = Date.now().toString();
      }
      const captureId = (global as any).currentCaptureId;
      const agentName = input.agentName || "RAG";
      const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
      if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });


      const finalOrder = final.map((c: any) => ({ chunk_id: c.chunk_id, score: c.score }));

      fs.writeFileSync(
        `${dumpDir}/05_RERANK_POST.json`,

        JSON.stringify(
          {
            rerank_query: topCandidates.length > 0 ? queriesOnly.join(", ") : null,
            final_count: final.length,
            final_order: finalOrder,
          },
          null,
          2
        ),
        "utf8"
      );
    } catch {
      // ignore debug dump failures
    }
  }

  const trimmed = final.slice(0, 50).map(c => ({ ...c }));
  const limited = limitTokens(trimmed, 5000);
  console.log(
    "[RETRIEVAL_CORE_WEEKLY_STAGE]",
    JSON.stringify({
      stage: "post_limit",
      trimmed_count: trimmed.length,
      limited_count: limited.length,
      trimmed_ids: trimmed.slice(0, 20).map((c) => c.chunk_id),
      limited_ids: limited.slice(0, 20).map((c) => c.chunk_id)
    })
  );

  retrievalTracer.logFinal(limited);
  log({ stage: "MACRO_RETRIEVAL_TRACE", message: "Retrieval augmented by PMSO", data: { pmso_id: ((pmso?.metadata as any)?.cognition_id) || pmso?.metadata?.capture_id || null, topK: limited.length } });
  if (input.queryId) retrievalTracer.saveTrace();

  return { chunks: limited, expandedQueries: queriesOnly, topKChunks: limited.length };
}

export async function retrieveTimeKnowledge(query: string, optional_context: string): Promise<RetrievalResult> {
  const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
  const pipePath = path.join(process.cwd(), "data/time_pipeline.json");
  const knowledgeMap: KnowledgeMapEntry[] = JSON.parse(fs.readFileSync(kmPath, "utf8"));
  return processPipeline(pipePath, knowledgeMap, "TIME");
}

export async function retrieveConfluenceKnowledge(query: string, optional_context: string): Promise<RetrievalResult> {
  const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
  const pipePath = path.join(process.cwd(), "data/confluence_pipeline.json");
  const knowledgeMap: KnowledgeMapEntry[] = JSON.parse(fs.readFileSync(kmPath, "utf8"));
  return processPipeline(pipePath, knowledgeMap, "CONFLUENCE");
}
