import * as fs from 'fs';
import * as path from 'path';

const VECTOR_DIR_OLD = path.join(process.cwd(), 'data/vectors');
const VECTOR_DIR_NEW = path.join(process.cwd(), 'data/vectors_vertex');

function loadVectorFile(dir: string, fileName: string) {
  const filePath = path.join(dir, fileName);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return [];
}

function findChunk(vectors: any[], chunkId: string) {
  return vectors.find((v) => v.chunk_id === chunkId);
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const normB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (normA * normB);
}

async function main() {
  const oldVectorFiles = fs.readdirSync(VECTOR_DIR_OLD).filter((f) => f.endsWith('.vectors.json'));

  if (oldVectorFiles.length === 0) {
    console.log('No vector files found in the old directory. Nothing to compare.');
    return;
  }

  const testFile = oldVectorFiles[0];
  const oldVectors = loadVectorFile(VECTOR_DIR_OLD, testFile);
  const newVectors = loadVectorFile(VECTOR_DIR_NEW, testFile);

  if (oldVectors.length === 0 || newVectors.length === 0) {
    console.log('Could not load vectors for comparison. Make sure both old and new vector files exist.');
    return;
  }

  const testChunkId = oldVectors[0].chunk_id;
  const oldChunk = findChunk(oldVectors, testChunkId);
  const newChunk = findChunk(newVectors, testChunkId);

  if (!oldChunk || !newChunk) {
    console.log(`Could not find chunk with ID ${testChunkId} in both vector stores.`);
    return;
  }

  console.log('Migration Validation Results:');
  console.log('=============================');
  console.log(`Test Chunk ID: ${testChunkId}`);
  console.log(`Old Embedding Dimension: ${oldChunk.embedding.length}`);
  console.log(`New Embedding Dimension: ${newChunk.embedding.length}`);

  if (oldChunk.embedding.length !== newChunk.embedding.length) {
    console.log('✅ Dimension mismatch confirmed. This is expected.');
  } else {
    console.log('❌ Dimension mismatch NOT confirmed. This is unexpected.');
  }

  // Note: Cosine similarity between different embedding models is not a reliable measure of semantic similarity.
  // This is just for a rough sense check.
  // const similarity = cosineSimilarity(oldChunk.embedding, newChunk.embedding);
  // console.log(`Cosine Similarity between old and new embeddings: ${similarity}`);
}

main();
