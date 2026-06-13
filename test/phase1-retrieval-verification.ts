import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { retrieveRAG, invalidateRetrievalCache } from '../core/3.query/retrieval-core.js';
import { CHUNK_DIR, VECTOR_STORE_DIR } from '../shared/config/data-paths.js';

// Mock data for testing
const mockChunk = {
  chunk_id: 'test-chunk-1',
  text: 'This is a test chunk.',
};

const mockVector = {
  ...mockChunk,
  embedding: Array(768).fill(0.1),
};

async function runVerification() {
  console.log('--- Phase 1: Retrieval Lifecycle Verification Runner ---');

  // Setup mock environment
  if (!fs.existsSync(CHUNK_DIR)) fs.mkdirSync(CHUNK_DIR, { recursive: true });
  if (!fs.existsSync(VECTOR_STORE_DIR)) fs.mkdirSync(VECTOR_STORE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CHUNK_DIR, 'test.chunks.json'), JSON.stringify([mockChunk]));
  fs.writeFileSync(path.join(VECTOR_STORE_DIR, 'test.vectors.json'), JSON.stringify([mockVector]));

  // Test 1: Runtime Contract Verification
  try {
    console.log('TEST 1: Runtime Contract Verification...');
    const result = await retrieveRAG({
      queries: [{ query: 'test', weight: 1.0, type: 'anchor' }],
      conceptEmbeddings: [Array(768).fill(0.1)],
    });
    assert.strictEqual(result.chunks.length, 1, 'Test 1 Failed: Should retrieve one chunk');
    assert.strictEqual(result.chunks[0].chunk_id, 'test-chunk-1', 'Test 1 Failed: Should retrieve the correct chunk');
    console.log('PASS: Test 1');
  } catch (e) {
    console.log(`FAIL: Test 1 - ${e}`);
  }

  // Test 2: Schema Integrity - Vector Dimension Mismatch
  try {
    console.log('TEST 2: Schema Integrity - Vector Dimension Mismatch...');
    const mismatchedVector = {
      ...mockVector,
      embedding: Array(128).fill(0.1),
    };
    fs.writeFileSync(path.join(VECTOR_STORE_DIR, 'mismatch.vectors.json'), JSON.stringify([mismatchedVector]));

    await assert.rejects(
      retrieveRAG({
        queries: [{ query: 'test', weight: 1.0, type: 'anchor' }],
        conceptEmbeddings: [Array(768).fill(0.1)],
        symbol: 'mismatch'
      }),
      /CRITICAL: Invalid vector dimension detected/,
      'Test 2 Failed: Should throw an error for mismatched vector dimensions'
    );
    console.log('PASS: Test 2');
    fs.unlinkSync(path.join(VECTOR_STORE_DIR, 'mismatch.vectors.json'));
  } catch (e) {
    console.log(`FAIL: Test 2 - ${e}`);
  }

  // Test 3: Degraded-State Semantics - BM25 Fallback
  try {
    console.log('TEST 3: Degraded-State Semantics - BM25 Fallback...');
    const result = await retrieveRAG({
      queries: [{ query: 'chunk', weight: 1.0, type: 'anchor' }],
      conceptEmbeddings: [Array(768).fill(0.9)],
    });
    assert.ok(result.chunks.length > 0, 'Test 3 Failed: Should return a result even if vector search is weak');
    console.log('PASS: Test 3');
  } catch (e) {
    console.log(`FAIL: Test 3 - ${e}`);
  }

  // Test 4: Fail-Fast Boundaries - Empty RAG Results
  try {
    console.log('TEST 4: Fail-Fast Boundaries - Empty RAG Results...');
    const result = await retrieveRAG({
      queries: [{ query: 'non-existent', weight: 1.0, type: 'anchor' }],
      conceptEmbeddings: [Array(768).fill(0.9)],
    });
    assert.strictEqual(result.chunks.length, 0, 'Test 4 Failed: Should return zero chunks for a non-existent query');
    console.log('PASS: Test 4');
  } catch (e) {
    console.log(`FAIL: Test 4 - ${e}`);
  }

  // Cleanup
  fs.unlinkSync(path.join(CHUNK_DIR, 'test.chunks.json'));
  fs.unlinkSync(path.join(VECTOR_STORE_DIR, 'test.vectors.json'));

  console.log('--- Verification Complete ---');
}

runVerification();
