import path from "path";
import fs from "fs";
import {
  loadPipeline,
  extractConcepts,
  processPipeline
} from "../../core/3.query/pipeline-processor";
import { KnowledgeMapEntry } from "../../core/3.query/type/knowledge";

async function runTest() {
  const pipelinePath = path.join(process.cwd(), "data/htf_pipeline.json");
  const kmPath = path.join(process.cwd(), "data/knowledge_map.json");

  const knowledgeMap: KnowledgeMapEntry[] = JSON.parse(
    fs.readFileSync(kmPath, "utf8")
  );

  console.log("====== TEST PIPELINE PROCESSOR ======");

  // 1. Load pipeline
  const pipeline = loadPipeline(pipelinePath);
  console.log("Pipeline loaded:", Object.keys(pipeline));

  // 2. Extract concepts
  const concepts = extractConcepts(pipeline, "structure");
  console.log("\nConcepts:", concepts);

  // 3. Process pipeline (map → knowledge_map)
  const result = processPipeline(pipelinePath, knowledgeMap, "HTF");

  console.log("\n====== RESULT ======");
  for (const step in result) {
    console.log(`\nSTEP: ${step}`);
    result[step].forEach((entry, i) => {
      console.log(
        `#${i + 1}`,
        entry.concept,
        "| type:",
        entry.type,
        "| layer:",
        entry.layer
      );
    });
  }
}

runTest().catch(console.error);