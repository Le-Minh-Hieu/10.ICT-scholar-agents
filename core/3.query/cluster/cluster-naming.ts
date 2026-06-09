/// <reference types="node" />

import "dotenv/config";
import fs from "fs";
import path from "path";
import { callLLM } from "../../../shared/utils/llm-utils";

// ===== PATH =====
const CLUSTER_FILE = path.join(process.cwd(), "data/cluster/refined_clusters.json");
const CHUNK_DIR = path.join(process.cwd(), "data/chunk_output");
const OUTPUT_FILE = path.join(process.cwd(), "data/knowledge_map.json");

// ===== CONFIG =====
const TEST_LIMIT = Infinity;
const SAMPLE_SIZE = 10; // 🔥 giảm để tránh lỗi
const TEXT_LIMIT = 250; // 🔥 giảm token
const DELAY_MS = 800;
const MAX_RETRY = 2;

// ===== TYPES =====
type Cluster = {
  cluster_id: string;
  chunk_ids: string[];
};

type Chunk = {
  chunk_id: string;
  text: string;
};

// ===== LOAD CHUNKS =====
function loadChunks(): Record<string, string> {
  const files = fs.readdirSync(CHUNK_DIR);
  const map: Record<string, string> = {};

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const data: Chunk[] = JSON.parse(
      fs.readFileSync(path.join(CHUNK_DIR, file), "utf-8")
    );

    for (const c of data) {
      map[c.chunk_id] = c.text;
    }
  }

  console.log(`📦 Loaded chunks: ${Object.keys(map).length}`);
  return map;
}

// ===== SAMPLE =====
function sampleChunks(ids: string[], chunkMap: Record<string, string>) {
  const shuffled = [...ids].sort(() => 0.5 - Math.random());

  return shuffled
    .slice(0, SAMPLE_SIZE)
    .map(id => chunkMap[id])
    .filter(Boolean)
    .map(t => t.slice(0, TEXT_LIMIT));
}

// ===== PROMPT =====
function buildPrompt(samples: string[]) {
  return `
Return ONLY ONE JSON OBJECT.

{
  "concept": "",
  "type": "concept | rule | behavior | pattern | timing | target",
  "layer": "HTF | ITF | LTF",

  "agent": {
    "role": "",
    "query_templates": [],
    "focus": [],
    "signal": "",
    "when_to_use": "",
    "invalid_when": ""
  }
}

Rules:
- concept = short ICT term
- HTF = bias
- ITF = structure
- LTF = entry

- role = what this detects
- query_templates = 3 queries for retrieval
- focus = 2-3 key elements
- signal = what it outputs
- when_to_use = condition
- invalid_when = when NOT to use
- MUST use precise ICT term (e.g., Bullish FVG, Bearish Breaker)
- DO NOT return generic concepts (e.g., learning, discipline, advice)
- Prefer variants: Bullish/Bearish, Buy-side/Sell-side

TEXTS:
${samples.map((s, i) => `${i + 1}. ${s}`).join("\n")}
`;
}

// ===== SAFE PARSE =====
function safeParse(text: string | undefined) {
  if (!text) return null;

  try {
    // remove markdown ```json ```
    const clean = text.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(clean);

    // 🔥 nếu model trả array → lấy object đầu tiên
    if (Array.isArray(parsed)) {
      return parsed[0];
    }

    return parsed;

  } catch {
    // fallback: tìm object trong string
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// ===== GEMINI =====
async function callGemini(prompt: string, retry = 0): Promise<any> {
  try {
    const result = await callLLM(prompt, "cluster-naming", "cluster-naming", [{ text: prompt }]) as any;
    const parsed = safeParse(result);

    if (!parsed) throw new Error("Parse failed");

    return parsed;

  } catch (err: any) {
    console.log("❌ ERROR:", err.message);

    if (retry < MAX_RETRY) {
      console.log(`⚠️ Retry ${retry + 1}`);
      await new Promise(r => setTimeout(r, 1000));
      return callGemini(prompt, retry + 1);
    }

    // 🔥 fallback (never fail)
    return {
      name: "unknown",
      type: "concept",
      usable: false,
      layer: "unknown"
    };
  }
}

// ===== MAIN =====
async function main() {
  console.log("📂 Loading clusters...");
  const clusters: Cluster[] = JSON.parse(
    fs.readFileSync(CLUSTER_FILE, "utf-8")
  );

  console.log(`📊 Total clusters: ${clusters.length}`);

  const chunkMap = loadChunks();

  const results: any[] = [];

  const limit = Math.min(TEST_LIMIT, clusters.length);

  for (let i = 0; i < limit; i++) {
    const cluster = clusters[i];

    console.log(`🔍 [${i + 1}/${limit}] ${cluster.cluster_id}`);

    const samples = sampleChunks(cluster.chunk_ids, chunkMap);

    if (samples.length === 0) continue;

    const prompt = buildPrompt(samples);
    const result = await callGemini(prompt);

    results.push({
    cluster_id: cluster.cluster_id,

    concept: result.concept,
    type: result.type,
    layer: result.layer,

    agent: {
        role: result.agent?.role || "",
        query_templates: result.agent?.query_templates || [],
        focus: result.agent?.focus || [],
        signal: result.agent?.signal || "",
        when_to_use: result.agent?.when_to_use || "",
        invalid_when: result.agent?.invalid_when || ""
    },

    size: cluster.chunk_ids.length
    });

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  console.log("✅ knowledge_map.json created");
}

main();
