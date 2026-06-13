import path from "path";
import { retrieveRAG } from "../../core/3.query/retrieval-core";

async function runTest() {
  const pipelinePath = path.join(process.cwd(), "data/htf_pipeline.json");

  const result = await retrieveRAG({
    pipelinePath,
    step: "structure",
    agentName: "TEST_AGENT"
  });

  console.log("======== TEST RESULT ========");
  console.log("Queries:", result.expandedQueries);
  console.log("TopK:", result.topKChunks);

  result.chunks.forEach((c, i) => {
    console.log(`\n#${i + 1}`, c.chunk_id);
    console.log(c.text.slice(0, 100));
  });
}

runTest().catch(console.error);