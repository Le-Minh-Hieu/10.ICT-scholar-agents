// core/2.index/embedder.ts

/// <reference types="node" />

import "dotenv/config";
import fs from "fs";
import path from "path";

// =======================
// TYPES
// =======================

type Chunk = {
  chunk_id: string;
  section_title: string;
  text: string;
};

type Vector = Chunk & {
  embedding: number[];
};

// =======================
// CONFIG
// =======================

import { CHUNK_DIR, VECTOR_DIR } from "../../shared/config/data-paths.js";

const INPUT_DIR = CHUNK_DIR;
const OUTPUT_DIR = VECTOR_DIR;

const LOG_PATH = path.join(process.cwd(), "shared/log/failed_chunks.log");

const EMBED_MODEL = "gemini-embedding-001";

const EMBED_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key}`;

// =======================
// ENV CHECK
// =======================

if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY is missing in .env");
}

// =======================
// INIT
// =======================

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ensure log dir
const logDir = path.dirname(LOG_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// =======================
// UTILS
// =======================

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =======================
// EMBEDDING FUNCTION
// =======================

async function embedText(text: string): Promise<number[]> {
  const res = await fetch(EMBED_URL(process.env.GEMINI_API_KEY!), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: {
        parts: [{ text }],
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ API Error:", data);
    throw new Error("Embedding API failed");
  }

  if (!data.embedding || !data.embedding.values) {
    console.error("❌ Invalid response:", data);
    throw new Error("Invalid embedding response");
  }

  return data.embedding.values;
}

// 🔥 retry wrapper
async function embedWithRetry(text: string, retries = 3): Promise<number[]> {
  for (let i = 0; i < retries; i++) {
    try {
      return await embedText(text);
    } catch (err) {
      console.log(`⚠️ Retry ${i + 1}`);
      await sleep(1000);
    }
  }
  throw new Error("Embedding failed after retries");
}

// =======================
// MAIN PROCESS
// =======================

async function processFiles() {
  const files = fs.readdirSync(INPUT_DIR);

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(
      OUTPUT_DIR,
      file.replace(".chunks.json", ".vectors.json")
    );

    const chunks: Chunk[] = JSON.parse(
      fs.readFileSync(inputPath, "utf-8")
    );

    // 🔥 load existing vectors nếu có
    let existing: Vector[] = [];
    let existingMap = new Map<string, Vector>();

    if (fs.existsSync(outputPath)) {
      existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      existingMap = new Map(existing.map(v => [v.chunk_id, v]));
    }

    const vectors: Vector[] = [...existing];

    for (const chunk of chunks) {
      if (existingMap.has(chunk.chunk_id)) continue;

      try {
        console.log(`🔄 ${file} → ${chunk.chunk_id}`);

        const embedding = await embedWithRetry(chunk.text);

        const vector: Vector = {
          ...chunk,
          embedding,
        };

        vectors.push(vector);

        // 🔥 incremental write
        fs.writeFileSync(outputPath, JSON.stringify(vectors, null, 2));

        // 🔥 rate limit protection
        await sleep(200);

      } catch (err) {
        console.error(`❌ Failed chunk: ${chunk.chunk_id}`);

        fs.appendFileSync(
          LOG_PATH,
          JSON.stringify({
            file,
            chunk_id: chunk.chunk_id
          }) + "\n"
        );

        continue;
      }
    }

    console.log(`✅ Done: ${file}`);
  }

  console.log("🎯 All embedding complete.");
}

// =======================
// RUN
// =======================

processFiles();