// core/1.ingest/block/section-detector.ts

/// <reference types="node" />

import fs from "fs";
import path from "path";

export type Section = {
  title: string;
  startIndex: number;
};

const INPUT_DIR = path.join(process.cwd(), "data/cleaned_text_output");
const OUTPUT_DIR = path.join(process.cwd(), "data/block/section_output");

// ensure output dir
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function isHeading(line: string): boolean {
  const trimmed = line.trim();

  if (trimmed.length < 5) return false;

  // ❌ reject bullet / sub-line
  if (/^[-•]/.test(trimmed)) return false;

  // ❌ reject quá ngắn (ví dụ: "ENTRIES")
  if (trimmed.split(" ").length < 2) return false;

  // phải có chữ hoa
  if (!/[A-Z]/.test(trimmed)) return false;

  const lowerCount = (trimmed.match(/[a-z]/g) || []).length;
  const upperCount = (trimmed.match(/[A-Z]/g) || []).length;

  // ưu tiên ALL CAPS / gần ALL CAPS
  if (upperCount < lowerCount) return false;

  // ❌ loại câu bình thường
  if (trimmed.endsWith(".")) return false;

  return true;
}

function detectSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];

  let currentIndex = 0;

  lines.forEach((line) => {
    const lengthWithNewline = line.length + 1;

    if (isHeading(line)) {
      sections.push({
        title: line.trim(),
        startIndex: currentIndex,
      });
    }

    currentIndex += lengthWithNewline;
  });

  return sections;
}

function processFiles() {
  const files = fs.readdirSync(INPUT_DIR);

  files.forEach((file) => {
    if (!file.endsWith(".txt")) return;

    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(
      OUTPUT_DIR,
      file.replace(".txt", ".sections.json")
    );

    const text = fs.readFileSync(inputPath, "utf-8");
    const sections = detectSections(text);

    fs.writeFileSync(outputPath, JSON.stringify(sections, null, 2));

    console.log(`✅ Sections extracted: ${file}`);
  });

  console.log("🎯 Done section detection.");
}

processFiles();