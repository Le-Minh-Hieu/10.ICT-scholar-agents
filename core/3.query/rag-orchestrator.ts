// rag-orchestrator.ts
import { loadPipeline, extractConcepts } from "./pipeline-processor";
import { buildQueries } from "./query-builder";
import { retrieveRAG, embedQueries } from "./retrieval-core";
import fs from "fs";
import path from "path";



export async function runRAG(pipelinePath: string, step?: string) {
    const pipeline = loadPipeline(pipelinePath);
    const concepts = extractConcepts(pipeline, step);

    const kmPath = path.join(process.cwd(), "data/knowledge_map.json");
    const knowledgeMap = JSON.parse(fs.readFileSync(kmPath, "utf8"));

    const weightedQueries = buildQueries(concepts, knowledgeMap);
    const queries = weightedQueries.map(q => q.query);
    const conceptEmbeddings = await embedQueries(queries);

    return retrieveRAG({
        queries,
        conceptEmbeddings
    });
}