// core/1.ingest/block/chunker.ts

/// <reference types="node" />

import fs from "fs";
import path from "path";

type Block = {
  section_title: string;
  content: string;
};

type Chunk = {
  chunk_id: string;
  section_title: string;
  text: string;

  source: string;
  chunk_index: number;
  block_index: number;
};

import { BLOCK_DIR, CHUNK_DIR } from "../../shared/config/data-paths.js";

const INPUT_DIR = BLOCK_DIR;
const OUTPUT_DIR = CHUNK_DIR;

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 🔥 filter config
const WEAK_SECTIONS = ["INTRODUCTION", "PHILOSOPHY", "FALLBACK"];

function isWeakSection(title: string): boolean {
  return WEAK_SECTIONS.some((w) => title.toUpperCase().includes(w));
}

function isTranscriptNoise(text: string): boolean {
  return /\[\d{2}:\d{2}/.test(text);
}

function isComplete(text: string): boolean {
  return /[.?!:]$/.test(text.trim());
}

function splitIntoChunks(
  text: string,
  sectionTitle: string,
  maxLength = 1200
): string[] {
  const paragraphs = text
    .split(/\n|-\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current = "";

  for (let para of paragraphs) {
    if (para === sectionTitle) continue;
    if (para.length < 50) continue;
    if (isTranscriptNoise(para)) continue; // 🔥 remove transcript

    // 🔥 split dài theo sentence
    if (para.length > maxLength) {
      const sentences = para.split(/(?<=[.?!])\s+/);

      let temp = "";
      for (const sentence of sentences) {
        if ((temp + " " + sentence).length > maxLength) {
          if (temp.length >= 80 && isComplete(temp)) {
            chunks.push(temp.trim());
          }
          temp = sentence;
        } else {
          temp += " " + sentence;
        }
      }

      if (temp.length >= 80 && isComplete(temp)) {
        chunks.push(temp.trim());
      }

      continue;
    }

    // 🔥 build chunk
    if ((current + " " + para).length > maxLength) {
      if (current.length >= 80 && isComplete(current)) {
        chunks.push(current.trim());
        current = para;
      } else {
        current += " " + para;
      }
    } else {
      current += " " + para;
    }
  }

  if (current.length >= 80 && isComplete(current)) {
    chunks.push(current.trim());
  }

  return chunks;
}

function processFiles() {
  const files = fs.readdirSync(INPUT_DIR);

  let globalChunkIndex = 0;

  files.forEach((file) => {
    if (!file.endsWith(".json")) return;

    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(
      OUTPUT_DIR,
      file.replace(".blocks.json", ".chunks.json")
    );

    const blocks: Block[] = JSON.parse(
      fs.readFileSync(inputPath, "utf-8")
    );

    const allChunks: Chunk[] = [];

    blocks.forEach((block, blockIndex) => {
      // 🔥 skip weak section
      if (isWeakSection(block.section_title)) return;

      const pieces = splitIntoChunks(block.content, block.section_title);

      pieces.forEach((piece) => {
        allChunks.push({
          chunk_id: `chunk_${globalChunkIndex}`,

          section_title: block.section_title,

          // 🔥 semantic injection
          text: `${block.section_title}\n${piece}`,

          source: file,
          chunk_index: globalChunkIndex,
          block_index: blockIndex,
        });

        globalChunkIndex++;
      });
    });

    fs.writeFileSync(outputPath, JSON.stringify(allChunks, null, 2));

    console.log(`✅ Chunked: ${file}`);
  });

  console.log("🎯 Done chunking.");
}

processFiles();