// core/1.ingest/text-cleaner.ts

/// <reference types="node" />

import fs from "fs";
import path from "path";

const INPUT_DIR = path.join(process.cwd(), "data/raw_text_output");
const OUTPUT_DIR = path.join(process.cwd(), "data/cleaned");

// Ensure output folder exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function cleanText(text: string): string {
  return text
    // remove page numbers
    .replace(/Page\s*\d+/gi, "")

    // remove timestamps
    .replace(/TIMESTAMP:\s*\d{2}:\d{2}:\d{2}/gi, "")

    // remove weird unicode chars
    .replace(/[^\x00-\x7F]+/g, " ")

    // fix broken hyphen words
    .replace(/-\n/g, "")

    // preserve section headers (ALL CAPS + :)
    .replace(/([A-Z\s]{8,}:)/g, "\n$1\n")

    // preserve bullet points
    .replace(/-\s+/g, "\n- ")

    // normalize new lines (but keep structure)
    .replace(/\n{2,}/g, "\n")

    // normalize spaces inside line
    .replace(/[ \t]+/g, " ")

    // trim each line
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")

    .trim();
}

function processFiles() {
  const files = fs.readdirSync(INPUT_DIR);

  files.forEach((file) => {
    if (!file.endsWith(".txt")) return;

    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);

    const raw = fs.readFileSync(inputPath, "utf-8");
    const cleaned = cleanText(raw);

    fs.writeFileSync(outputPath, cleaned, "utf-8");

    console.log(`✅ Cleaned: ${file}`);
  });

  console.log("🎯 Done cleaning all files.");
}

processFiles();