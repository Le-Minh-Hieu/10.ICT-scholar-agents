import path from "path";
import { runRAG } from "../../core/3.query/rag-orchestrator";

async function runTest() {
  const pipelinePath = path.join(process.cwd(), "data/htf_pipeline.json");

  const result = await runRAG(pipelinePath, "structure");

  console.log("======== ORCHESTRATOR TEST ========");

  console.log("\nQueries:");
  console.log(result.expandedQueries);

  console.log("\nTopK:", result.topKChunks);

  console.log("\nChunks:");
  result.chunks.forEach((c, i) => {
    console.log(`\n#${i + 1} ${c.chunk_id}`);
    console.log(c.text.slice(0, 120));
  });
}

runTest().catch(console.error);