import { retrieveRAG } from "../core/3.query/retrieval-core";

async function test() {
  console.log("--- TEST RAG RETRIEVAL CORE ---");

  try {
    const results = await retrieveRAG({
      pipelinePath: "data/htf_pipeline.json",
      step: "structure",
    });

    console.log("Retrieved Chunks:");
    console.log(JSON.stringify(results, null, 2));

    if (results.length === 0) {
      console.log("\nNote: Results are empty because vectorSearch and keywordSearch are stubs.");
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

test();
