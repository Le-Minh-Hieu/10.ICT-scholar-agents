import { loadPipeline, extractConcepts } from "../../core/3.query/pipeline-processor";
import { buildQueries } from "../../core/3.query/query-builder";
import fs from "fs";
import path from "path";

async function runTest() {
    console.log("===== PIPELINE → QUERY TEST =====");

    // 🔹 1. load pipeline
    const pipelinePath = path.join(process.cwd(), "data/htf_pipeline.json");
    const pipeline = loadPipeline(pipelinePath);

    // 🔹 2. extract concepts
    const concepts = extractConcepts(pipeline);
    console.log("\n[CONCEPTS]");
    console.log(concepts);

    // 🔹 3. load knowledge_map
    const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
    const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));

    // 🔹 4. build queries
    for (const step of pipeline.steps) {
        const queries = buildQueries(step.concepts, knowledgeMap);
        console.log("\n[QUERIES]");
        console.log(step.name, queries);
        console.log("Query count:", queries.length);
    }
    

    // 🔹 5. stats
    console.log("\n[STATS]");
    console.log("Concept count:", concepts.length);
    
    console.log("\n===== DONE =====");
}

runTest().catch(console.error);