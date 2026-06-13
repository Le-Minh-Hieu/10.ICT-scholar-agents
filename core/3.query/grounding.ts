import { Chunk } from "../../core/3.query/retrieval-core";
import { log } from "../../shared/utils/logger";
import { ontologyLoader } from "./ontology/loader";

export enum OwnershipType {
  TIME_PRIMARY = "TIME_PRIMARY",
  TIME_SHARED = "TIME_SHARED",
  PRICE = "PRICE"
}

export function classifyChunkOwnership(chunk: Chunk): OwnershipType {
  const text = chunk.text.toLowerCase();
  const chunkId = chunk.chunk_id;
  
  const annotation = ontologyLoader.getAnnotation(String(chunkId));
  const concepts = annotation ? annotation.concepts.map(c => c.canonical.toLowerCase()) : [];
  
  const primaryTimeKeywords = [
    "yield seasonal", "dxy seasonal", "intermarket timing", "macro cycle", "quarterly shift", 
    "quarterly seasonality", "month-in-quarter", "turn of month", "turn-of-month", "end of month", "end-of-month",
    "monthly seasonality", "options expiry", "nwog", "weekly open", "ndog", "daily open", "economic catalyst", 
    "catalyst timing", "midnight open", "judas swing", "silver bullet", "london open", "ny open", "new york open", 
    "asian open", "london/ny/asian open", "macro cycle transition", "economic catalyst timing", "turn of month / eom",
    "yield seasonal regime", "dxy seasonal regime", "intermarket timing divergence", "weekly open timing", "daily open timing",
    "tom", "eom"
  ];
  
  const sharedTimeKeywords = [
    "weekly profile", "daily profile", "session profile", "session timing", "killzone", "ny am", "ny pm", 
    "asia session", "london session", "new york session", "time window", "timing window", "temporal tag"
  ];

  for (const concept of concepts) {
    if (primaryTimeKeywords.some(kw => concept.includes(kw) || kw.includes(concept))) {
      return OwnershipType.TIME_PRIMARY;
    }
  }
  
  for (const concept of concepts) {
    if (sharedTimeKeywords.some(kw => concept.includes(kw) || kw.includes(concept))) {
      return OwnershipType.TIME_SHARED;
    }
  }

  if (primaryTimeKeywords.some(kw => text.includes(kw))) {
    return OwnershipType.TIME_PRIMARY;
  }
  
  if (sharedTimeKeywords.some(kw => text.includes(kw) || (annotation && annotation.temporal_tags?.length > 0) || (annotation && annotation.session_tags?.length > 0))) {
    return OwnershipType.TIME_SHARED;
  }

  return OwnershipType.PRICE;
}


export interface GroundedMeta {
  selected_chunk_ids: string[];
  grounded_chunk_count: number;
  grounded_token_estimate: number;
}

export interface GroundedContext {
  chunks: Chunk[];
  text: string;
  meta?: GroundedMeta;
}


// =======================
// RELEVANCE (STRONGER)
// =======================

function isRelevant(text: string, queries: string[]): boolean {
  const t = text.toLowerCase();

  return queries.some(q => {
    const words = q.toLowerCase().split(" ").filter(w => w.length > 3);
    return queries.some(q => {
      const words =
        q.toLowerCase()
          .split(" ")
          .filter(w => w.length > 3);

      const matched =
        words.filter(w => t.includes(w));

      return matched.length >=
        Math.max(1, Math.floor(words.length * 0.3));
    }); // 🔥 stricter
  });
}

// =======================
// DECISION LOGIC DETECTION
// =======================

// function hasDecisionLogic(text: string): boolean {
//   const t = text.toLowerCase();

//   return (
//     t.includes("if") ||
//     t.includes("when") ||
//     t.includes("then") ||
//     t.includes("only") ||
//     t.includes("should") ||
//     t.includes("must")
//   );
// }

// =======================
// GENERIC DETECTION
// =======================

// function isGeneric(text: string): boolean {
//   const t = text.toLowerCase();

//   return (
//     t.includes("introduction") ||
//     t.includes("overview") ||
//     t.includes("there are") ||
//     t.includes("a number of") ||
//     t.includes("can be used") ||
//     t.includes("is defined as")
//   );
// }

// =======================
// SCORING
// =======================

// =======================
// SIMPLE DEDUP
// =======================

function simpleDedup(chunks: Chunk[]): Chunk[] {
  const seen = new Set<string>();
  const result: Chunk[] = [];

  for (const c of chunks) {
    const key = c.text.slice(0, 120); // fingerprint rộng hơn
    if (!seen.has(key)) {
      seen.add(key);
      result.push(c);
    }
  }

  return result;
}

// =======================
// MAIN
// =======================

export function buildGrounded(
  chunks: Chunk[],
  queries: string[],
  agentName?: string,
  pmso?: any
): GroundedContext {

  // 1. FILTER relevance
  let filtered = chunks.filter(c => isRelevant(c.text, queries));

  // fallback nếu quá gắt
  if (filtered.length < 3) {
    filtered = chunks;
  }

  // 2. DEDUP (preserving rerank order)
  const deduped = simpleDedup(filtered);

  // 3. VALIDATE
  const validated = deduped.filter(c => c.chunk_id);

  const timeAgents = [
    "HTF-Macro-Agent",
    "Quarterly-Agent",
    "Monthly-Agent",
    "Weekly-Agent",
    "Daily-Agent",
    "Session-Agent"
  ];

  const isTimeAgent = agentName && timeAgents.includes(agentName);

  let finalChunks: Chunk[] = [];

  if (isTimeAgent) {
    // 4. LIMIT & ALLOCATE (Grounding Contract: min 6 Time / max 2 Price)
    const timePrimaryChunks: Chunk[] = [];
    const timeSharedChunks: Chunk[] = [];
    const priceChunks: Chunk[] = [];

    for (const chunk of validated) {
      const classification = classifyChunkOwnership(chunk);
      if (classification === OwnershipType.TIME_PRIMARY) {
        timePrimaryChunks.push(chunk);
      } else if (classification === OwnershipType.TIME_SHARED) {
        timeSharedChunks.push(chunk);
      } else {
        priceChunks.push(chunk);
      }
    }

    const allTimeChunks = [...timePrimaryChunks, ...timeSharedChunks];

    // Select up to 6 Time chunks (prioritize TIME_PRIMARY then TIME_SHARED)
    const selectedTime = allTimeChunks.slice(0, 6);

    // Select up to 2 Price chunks (preserving original ranking order)
    const selectedPrice = priceChunks.slice(0, 2);

    // Combine
    finalChunks = [...selectedTime, ...selectedPrice];

    // Fill up to MAX = 8 with extra Time chunks if we have them
    if (finalChunks.length < 8) {
      const remainingTime = allTimeChunks.filter(c => !selectedTime.includes(c));
      const extraTime = remainingTime.slice(0, 8 - finalChunks.length);
      finalChunks = [...finalChunks, ...extraTime];
    }

    // Fallback: Use extra Price chunks if we still have less than 8 total chunks
    if (finalChunks.length < 8) {
      const remainingPrice = priceChunks.filter(c => !selectedPrice.includes(c));
      const extraPrice = remainingPrice.slice(0, 8 - finalChunks.length);
      finalChunks = [...finalChunks, ...extraPrice];
    }
  } else {
    // Legacy behavior for non-Time agents (HTF, ITF, LTF price agents)
    const MAX = 6;
    finalChunks = validated.slice(0, MAX);
  }



  // 6. FORMAT
  const text = finalChunks
    .map(c => `[CHUNK_ID:${c.chunk_id}]\n${c.text}`)
    .join("\n\n");
  log({ stage: "MACRO_GROUNDING_TRACE", message: "Grounding completed", data: { pmso_id: pmso?.metadata?.cognition_id || pmso?.metadata?.capture_id || null, chunk_count: finalChunks.length } });

  const selected_chunk_ids = finalChunks.map(c => String(c.chunk_id));
  const grounded_chunk_count = finalChunks.length;
  const grounded_token_estimate = Math.ceil((text?.length || 0) / 4);

  return {
    chunks: finalChunks,
    text,
    meta: {
      selected_chunk_ids,
      grounded_chunk_count,
      grounded_token_estimate,
    },
  };
}
