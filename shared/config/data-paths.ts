import path from 'path';

// =================================================================
// SINGLE SOURCE OF TRUTH FOR ALL DATA PATHS
// =================================================================

// -----------------------------------------------------------------
// RAW & INTERMEDIATE DATA (PRODUCER OUTPUTS)
// -----------------------------------------------------------------

// Raw block data from ingestion
export const BLOCK_DIR = path.join(process.cwd(), 'data/block/block_builder_output');

// Chunked text data, used for BM25 and vector embedding
export const CHUNK_DIR = path.join(process.cwd(), 'data/chunk_output');

// Vector embeddings generated from chunks
export const VECTOR_DIR = path.join(process.cwd(), 'data/vectors');
export const VECTOR_VERTEX_DIR = path.join(process.cwd(), 'data/vectors_vertex');

// -----------------------------------------------------------------
// RETRIEVAL CONFIGURATION (CONSUMER INPUTS)
// -----------------------------------------------------------------

/**
 * Authoritative path for the vector store.
 * Retrieval core will ONLY read from this directory.
 * The embedder script will ONLY write to this directory.
 * 
 * There is no need to set VECTOR_STORE_DIR in the .env file anymore.
 * This variable ensures that the producer and consumer are always aligned.
 */
export const VECTOR_STORE_DIR = VECTOR_VERTEX_DIR;
