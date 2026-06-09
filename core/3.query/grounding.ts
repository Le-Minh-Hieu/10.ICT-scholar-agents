import { Chunk } from "../../core/3.query/retrieval-core";
import { log } from "../../shared/utils/logger";

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

function scoreChunk(chunk: Chunk, queries: string[]): number {
  const t = chunk.text.toLowerCase();
  let score = 0;

  // 🔹 keyword match
  for (const q of queries) {
    if (t.includes(q.toLowerCase())) {
      score += 2;
    }
  }

  // // 🔥 decision logic boost
  // if (hasDecisionLogic(chunk.text)) {
  //   score += 4;
  // }

  // // ❌ generic penalty
  // if (isGeneric(chunk.text)) {
  //   score -= 2;
  // }

  return score;
}

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
  pmso?: any
): GroundedContext {

  // 1. FILTER relevance
  let filtered = chunks.filter(c => isRelevant(c.text, queries));

  // fallback nếu quá gắt
  if (filtered.length < 3) {
    filtered = chunks;
  }

  // 2. SCORE + SORT
  const scored = filtered
    .map(c => ({
      ...c,
      score: scoreChunk(c, queries)
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  // 3. DEDUP
  const deduped = simpleDedup(scored);

  // 4. VALIDATE
  const validated = deduped.filter(c => c.chunk_id);

  // 5. LIMIT (adaptive)
  const MAX = 6;
  const finalChunks = validated.slice(0, MAX);

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
