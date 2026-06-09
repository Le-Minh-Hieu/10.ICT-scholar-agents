
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { log } from "./logger.js";

if (!global.mockable) {
    global.mockable = {};
}

let genAI;
async function initializeGenAI() {
    if (genAI) return;

    if (process.env.GOOGLE_CLOUD_AUTH_FLOW) {
        const { VertexAI } = await import("@google-cloud/vertexai");
        const vertex_ai = new VertexAI({ project: process.env.GOOGLE_PROJECT_ID, location: process.env.GOOGLE_LOCATION });
        genAI = vertex_ai.getGenerativeModel({ model: "gemini-1.5-pro-preview-0409" });
    } else {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: "gemini-1.5-pro-preview-0409" });
    }
}

export async function callLLM(prompt, orchestrator, captureId, chunks, options) {
    if (global.mockable.callLLM) {
        return global.mockable.callLLM(prompt, orchestrator, captureId, chunks, options);
    }
    await initializeGenAI();
    // ... rest of the function
}
