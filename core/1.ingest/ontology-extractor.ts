
import fs from "fs";
import path from "path";
import "dotenv/config";
import { GoogleGenAI } from '@google/genai';
import { ChunkAnnotation, Concept } from "../../shared/knowledge/ontology-types.js";
import { canonicalizeConcept } from "./canonicalizer.js";

const INPUT_DIR = path.join(process.cwd(), "data/chunk_output");
const OUTPUT_DIR = path.join(process.cwd(), "data/ontology/annotations");
const LOG_PATH = path.join(process.cwd(), "shared/log/failed_ontology_chunks.log");

const LLM_MODEL = "gemini-2.5-flash";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(path.dirname(LOG_PATH))) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
}

const genAI = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});


function getSessionFromFilename(filename: string): string | undefined {
  const lowerCaseFilename = filename.toLowerCase();
  if (lowerCaseFilename.includes("london")) return "LONDON";
  if (lowerCaseFilename.includes("ny_am") || lowerCaseFilename.includes("am session")) return "NY_AM";
  if (lowerCaseFilename.includes("ny_pm") || lowerCaseFilename.includes("pm session")) return "NY_PM";
  return undefined;
}

async function extractOntologyFromChunk(
  chunk: any,
  sourceFile: string,
  prevChunk?: any,
  nextChunk?: any
): Promise<ChunkAnnotation | null> {
  const prompt = `
    You are an expert in ICT (Inner Circle Trader) market concepts and behavioral cognition.
    Analyze the following PRIMARY chunk of text and extract relevant concepts, narrative state, and directional flow.

    PRIMARY CHUNK TO ANALYZE (ID: ${chunk.chunk_id}):
    "${chunk.text}"

    SUPPORTING CONTEXT (Use ONLY to infer transitions/state, do NOT extract concepts from these):
    PREVIOUS CHUNK: "${prevChunk ? prevChunk.text : "N/A"}"
    NEXT CHUNK: "${nextChunk ? nextChunk.text : "N/A"}"

    Focus on identifying:
    1.  Concepts: Canonical name (e.g., LIQUIDITY_SWEEP, FAIR_VALUE_GAP, ORDER_BLOCK, MARKET_STRUCTURE_SHIFT), surface terms, confidence, and narrative roles.
    2.  Narrative State: Classify the PRIMARY CHUNK into one of: ACCUMULATION, MANIPULATION, EXPANSION, REBALANCE, CONTINUATION, REVERSAL, CONSOLIDATION.
    3.  Directional Flow: BULLISH, BEARISH, or NEUTRAL.
    4.  Session/Temporal Tags: Relevant market sessions or specific times mentioned in the PRIMARY chunk.

    The output MUST be a JSON object with this structure:
    {
      "concepts": [{ "canonical": "...", "confidence": 0.9, "surface_terms": [...], "narrative_roles": [...] }],
      "narrative_metadata": {
        "state": { "value": "...", "confidence": 0.8 },
        "flow": { "direction": "...", "intensity": 0.7 }
      },
      "temporal_tags": [...],
      "session_tags": [...]
    }
  `;

  try {
    const result = await genAI.models.generateContent({
      model: LLM_MODEL,
      contents: prompt,
    });

    let textResponse = result.text ?? "";

    // Clean markdown code blocks if present
    textResponse = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(textResponse);
    } catch (parseError: any) {
      console.error(`Failed to parse LLM response for chunk ${chunk.chunk_id}:`, textResponse);
      throw new Error("Failed to parse LLM response");
    }

    const finalConcepts: Concept[] = (parsedResponse.concepts || []).map((concept: any) => {
      if (!concept.surface_terms) concept.surface_terms = [];
      return canonicalizeConcept(concept);
    });

    const sessionTag = getSessionFromFilename(sourceFile);

    return {
      chunk_id: chunk.chunk_id,
      concepts: finalConcepts,
      session_tags: parsedResponse.session_tags || (sessionTag ? [sessionTag] : []),
      temporal_tags: parsedResponse.temporal_tags || [],
      source_context: {
        section_title: chunk.section_title,
        source_file: sourceFile,
        chunk_index: chunk.chunk_index,
        ...(sessionTag && { session: sessionTag }),
      },
      narrative_metadata: {
        state: parsedResponse.narrative_metadata?.state,
        flow: parsedResponse.narrative_metadata?.flow,
        links: [] // Links populated by NarrativeLinker
      }
    };
  } catch (err: any) {
    console.error(`Failed to extract for chunk ${chunk.chunk_id}:`, err.message);
    fs.appendFileSync(LOG_PATH, JSON.stringify({ chunk_id: chunk.chunk_id, error: err.message }) + "\n");
    return null;
  }
}

async function processFiles() {
  const files = fs.readdirSync(INPUT_DIR);

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file.replace(".chunks.json", ".annotations.json"));

    if (fs.existsSync(outputPath)) {
      console.log(`⏩ Skipping ${file}, annotations already exist.`);
      continue;
    }

    const chunks: any[] = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
    const allAnnotations: ChunkAnnotation[] = [];

    console.log(`Processing file: ${file} (${chunks.length} chunks)`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prev = i > 0 ? chunks[i - 1] : undefined;
      const next = i < chunks.length - 1 ? chunks[i + 1] : undefined;

      const annotation = await extractOntologyFromChunk(chunk, file, prev, next);
      if (annotation) {
        allAnnotations.push(annotation);
      }
      // Increased delay for rate limit safety on free tier if applicable
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    fs.writeFileSync(outputPath, JSON.stringify(allAnnotations, null, 2));
    console.log(`✅ Annotated: ${file}`);
  }
  console.log("🎯 Narrative-aware ontology extraction complete.");
}

processFiles();
