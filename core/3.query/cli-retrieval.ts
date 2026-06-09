import { retrieveRAG, embedQueries } from "./retrieval-core";
import 'dotenv/config';

async function runRetrievalCli() {
    const query = process.argv[2];
    const symbol = process.argv[3];

    if (!query) {
        console.error("Usage: node cli-retrieval.js <query> [symbol]");
        process.exit(1);
    }

    console.log(`Performing retrieval for query: "${query}"${symbol ? ` on symbol ${symbol}` : ""}`);

    try {
        const queryEmbeddings = await embedQueries([query]);
        
        const results = await retrieveRAG({
            queries: [query],
            conceptEmbeddings: queryEmbeddings,
            symbol: symbol,
        });

        console.log("\n--- Retrieval Results ---");
        if (results.chunks.length > 0) {
            results.chunks.forEach((chunk, index) => {
                console.log(`\nChunk ${index + 1} (Score: ${chunk.score?.toFixed(4)})`);
                console.log("--------------------");
                console.log(chunk.text);
            });
        } else {
            console.log("No relevant chunks found.");
        }

    } catch (error) {
        console.error("Retrieval failed:", error);
    }
}

runRetrievalCli();