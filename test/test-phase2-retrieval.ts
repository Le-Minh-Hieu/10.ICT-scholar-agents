import { retrieveRAG } from "../core/3.query/retrieval-core";
import { buildQueries } from "../core/3.query/query-builder";
import { ontologyLoader } from "../core/3.query/ontology/loader";
import * as fs from "fs";
import * as path from "path";

async function testPhase2() {
  console.log("--- TEST PHASE 2: ONTOLOGY-AWARE RETRIEVAL ---");

  // Wait for loader
  await ontologyLoader.load();

  const knowledgeMap = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/knowledge_map.json"), "utf8"));

  const testQueries = [
    "stop hunt",          // Should expand to LIQUIDITY_SWEEP
    "Silver Bullet",      // Should have TIME/SESSION intent
    "FVG execution"       // Should combine concept and execution
  ];

  for (const q of testQueries) {
    console.log(`\nTesting Query: "${q}"`);
    
    // 1. Test Query Expansion
    const expanded = buildQueries([q], knowledgeMap);
    console.log("Expanded Queries (Weighted):");
    expanded.forEach(eq => console.log(` - [${eq.type}] ${eq.query} (Weight: ${eq.weight})`));

    // 2. Test RAG Retrieval
    const results = await retrieveRAG({
      queries: expanded,
      conceptEmbeddings: [], // Optional
      agentName: "test-agent"
    });

    console.log(`Results Found: ${results.chunks.length}`);
    if (results.chunks.length > 0) {
      console.log("Top 3 Chunk IDs & Scores:");
      results.chunks.slice(0, 3).forEach(c => {
        const ann = ontologyLoader.getAnnotation(c.chunk_id);
        const conceptStr = ann ? ann.concepts.map(con => con.canonical).join(", ") : "none";
        console.log(` - ${c.chunk_id}: ${c.score?.toFixed(4)} (Ontology Concepts: ${conceptStr})`);
      });
    }
  }
}

testPhase2().catch(console.error);
