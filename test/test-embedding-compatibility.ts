
import * as dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;

async function getEmbedding(modelName: string, text: string, isVertex: boolean): Promise<number[]> {
    const aiOptions: any = {
        vertexai: isVertex,
    };

    if (isVertex) {
        aiOptions.project = GOOGLE_CLOUD_PROJECT;
        aiOptions.location = GOOGLE_CLOUD_LOCATION;
    } else {
        aiOptions.apiKey = GEMINI_API_KEY;
    }

    const ai = new GoogleGenAI(aiOptions);

    const result = await ai.models.embedContent({
        model: modelName,
        contents: [text]
    });

    if (!result.embeddings || result.embeddings.length === 0 || !result.embeddings[0].values) {
        throw new Error("Failed to get embeddings");
    }

    return result.embeddings[0].values;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const normB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (normA * normB);
}

async function main() {
    const sampleText = 'Hello world';

    // Get embedding from new model (Vertex AI)
    const newEmbedding = await getEmbedding('text-embedding-004', sampleText, true);

    console.log('New Model (text-embedding-004) Dimension:', newEmbedding.length);
}

main();
