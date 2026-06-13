import path from "path";
import fs from "fs";

import { loadPipeline, extractConcepts } from "../../core/3.query/pipeline-processor";
import { buildQueries } from "../../core/3.query/query-builder";
import { embedQueries, retrieveRAG } from "../../core/3.query/retrieval-core";
import { buildGrounded } from "../../core/3.query/grounding";

async function runTest() {
  console.log("===== GROUNDING FLOW TEST =====");

  const pipelinePath = path.join(process.cwd(), "data/htf_pipeline.json");
  const kmPath = path.join(process.cwd(), "data/knowledge_map.json");

  const pipeline = loadPipeline(pipelinePath);
  const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));

  // 👉 test riêng 1 agent
  const step = "structure";

  // 1. concepts
  const concepts = extractConcepts(pipeline, step);
  console.log("\n[CONCEPTS]");
  console.log(concepts.slice(0, 10));

  // 2. queries
  const weightedQueries = buildQueries(concepts, knowledgeMap);
  const queries = weightedQueries.map(q => q.query);
  console.log("\n[QUERIES]");
  console.log(queries);

  // 3. embed
  const embeddings = await embedQueries(queries);

  // 4. retrieval
  const ragResult = await retrieveRAG({
    queries,
    conceptEmbeddings: embeddings
  });

  console.log("\n[RAW CHUNKS]");
  ragResult.chunks.slice(0, 10).forEach((c: any, i: number) => {
    console.log(`#${i + 1}`, c.chunk_id);
    console.log(c.text.slice(0, 100), "\n");
  });

  // 5. grounded
  const grounded = buildGrounded(ragResult.chunks, queries);

  console.log("\n[FINAL GROUNDED]");
  console.log(grounded.text);

  console.log("\n[STATS]");
  console.log("Raw chunks:", ragResult.chunks.length);
  console.log("Final chunks:", grounded.chunks.length);
}

runTest();