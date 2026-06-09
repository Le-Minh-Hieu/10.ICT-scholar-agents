import fs from "fs";
import path from "path";

const LOG_FILE = "/shared/log/failed_chunks.log";
const INPUT_DIR = path.join(process.cwd(), "data/chunk_output");
const OUTPUT_DIR = path.join(process.cwd(), "data/vectors");

type Failed = {
  file: string;
  chunk_id: string;
};

function loadFailed(): Failed[] {
  if (!fs.existsSync(LOG_FILE)) return [];

  const lines = fs.readFileSync(LOG_FILE, "utf-8").split("\n").filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

function groupByFile(failed: Failed[]) {
  const map = new Map<string, string[]>();

  for (const f of failed) {
    if (!map.has(f.file)) map.set(f.file, []);
    map.get(f.file)!.push(f.chunk_id);
  }

  return map;
}

async function main() {
  const failed = loadFailed();
  const grouped = groupByFile(failed);

  console.log(`🔁 Rebuilding ${failed.length} failed chunks`);

  for (const [file, chunkIds] of grouped.entries()) {
    console.log(`📄 ${file} → ${chunkIds.length} chunks`);

    // 👉 đơn giản: xóa file vectors để embed lại
    const vectorPath = path.join(
      OUTPUT_DIR,
      file.replace(".chunks.json", ".vectors.json")
    );

    if (fs.existsSync(vectorPath)) {
      fs.unlinkSync(vectorPath);
      console.log(`🗑️ Removed ${vectorPath}`);
    }
  }

  console.log("👉 Now rerun embedder.ts");
}

main();