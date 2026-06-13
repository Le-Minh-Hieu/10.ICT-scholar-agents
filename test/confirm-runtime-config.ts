
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const VECTOR_DIR = path.join(process.cwd(), process.env.VECTOR_STORE_DIR || 'data/vectors');

type Chunk = {
  chunk_id: string;
  text: string;
  score?: number;
  embedding?: number[];
};

type ChunkVector = Chunk & {
  embedding: number[];
};

let VECTOR_CACHE: ChunkVector[] | null = null;

function normalize(v: number[]): number[] {
    const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return v;
    return v.map((val) => val / norm);
}

function loadVectors(): ChunkVector[] {
    if (VECTOR_CACHE) return VECTOR_CACHE;

    VECTOR_CACHE = [];
    const vectorDir = path.join(process.cwd(), process.env.VECTOR_STORE_DIR || "data/vectors");
    if (fs.existsSync(vectorDir)) {
        const files = fs.readdirSync(vectorDir).filter((f) => f.endsWith(".vectors.json"));
        for (const file of files) {
            const content: ChunkVector[] = JSON.parse(fs.readFileSync(path.join(vectorDir, file), "utf8"));
            for (const v of content) {
                v.embedding = normalize(v.embedding);
            }
            VECTOR_CACHE.push(...content);
        }
    }
    return VECTOR_CACHE;
}

function runTest() {
    console.log('--- Confirm Runtime Config Test ---');
    console.log(`process.env.VECTOR_STORE_DIR: ${process.env.VECTOR_STORE_DIR}`);
    
    const vectors = loadVectors();
    
    if (vectors.length > 0) {
        console.log(`Loaded ${vectors.length} vectors.`);
        console.log(`Dimension of first vector: ${vectors[0].embedding.length}`);
    } else {
        console.log('No vectors loaded.');
    }
    
    console.log('--- End Test ---');
}

runTest();
