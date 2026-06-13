import { retrieveRAG } from '../core/3.query/retrieval-core.js';

async function main() {
  const query = 'what is market structure shift?';

  console.log('--- OLD RETRIEVAL (gemini-embedding-001) ---');
  process.env.VECTOR_STORE_DIR = 'data/vectors';
  const oldResults = await retrieveRAG({ queries: [query], conceptEmbeddings: [] });
  console.log(oldResults.chunks.slice(0, 5).map(c => ({ chunk_id: c.chunk_id, score: c.score, text: c.text.substring(0, 100) + '...' })));

  console.log('\n--- NEW RETRIEVAL (text-embedding-004) ---');
  process.env.VECTOR_STORE_DIR = 'data/vectors_vertex';
  const newResults = await retrieveRAG({ queries: [query], conceptEmbeddings: [] });
  console.log(newResults.chunks.slice(0, 5).map(c => ({ chunk_id: c.chunk_id, score: c.score, text: c.text.substring(0, 100) + '...' })));
}

main();
