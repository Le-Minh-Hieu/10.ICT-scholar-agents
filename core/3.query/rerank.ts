/// <reference types="node" />

import "dotenv/config";
import { ontologyLoader } from "./ontology/loader";
import { TimeframeThesis } from "../../shared/knowledge/hierarchical-types";
import { callLLM } from "../../shared/utils/llm-utils.js";
import axios from "axios";
import { log } from "../../shared/utils/logger";
import pLimit from "p-limit";
import fs from "fs";

import { RelationalContext } from "../../shared/knowledge/relational-types";

// =======================
// TYPES
// =======================
const jinaLimiter = pLimit(2);

type Chunk = {
  chunk_id: string;
  section_title: string;
  text: string;
  score?: number;
};

// =======================
// RERANK FUNCTION
// =======================

async function jinaRerank(query: string, chunks: Chunk[]): Promise<Chunk[]> {
  const response = await jinaLimiter(async () =>
    axios.post(
      "https://api.jina.ai/v1/rerank",
      {
        model: "jina-reranker-v2-base-multilingual",
        query,
        documents: chunks.map(c => c.text),
        top_n: chunks.length,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.JINA_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    )
  );

  const results = response.data.results || [];
  log({
    stage: "JINA_RERANK",
    message: "Jina rerank completed",
    data: { query, chunkCount: chunks.length },
  });

  return results
    .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
    .map((r: any) => chunks[r.index]);
}

export async function rerank(
  query: string,
  chunks: Chunk[],
  parentThesis?: TimeframeThesis,
  relational?: RelationalContext
): Promise<Chunk[]> {
  if (process.env.RAG_DEBUG_DUMP === "true") {
    try {
      if (!(global as any).currentCaptureId) {
        (global as any).currentCaptureId = Date.now().toString();
      }
      const captureId = (global as any).currentCaptureId;
      const agentName = "rerank";
      const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
      if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

      fs.writeFileSync(
        `${dumpDir}/05_RERANK_REQUEST.json`,
        JSON.stringify(
          {
            rerank_query: query,
            candidate_count: chunks.length,
            candidate_order: chunks.map((c: any) => ({
              chunk_id: c.chunk_id,
              score: c.score,
              text: c.text?.slice(0, 200),
            })),
          },
          null,
          2
        ),
        "utf8"
      );
    } catch {
      // ignore
    }
  }

  if (chunks.length <= 3) {
    if (process.env.RAG_DEBUG_DUMP === "true") {
      try {
        if (!(global as any).currentCaptureId) {
          (global as any).currentCaptureId = Date.now().toString();
        }
        const captureId = (global as any).currentCaptureId;
        const agentName = "rerank";
        const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
        if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

        fs.writeFileSync(
          `${dumpDir}/05_RERANK_POST.json`,
          JSON.stringify(
            {
              rerank_query: query,
              final_count: chunks.length,
              final_order: chunks.map((c: any) => ({ chunk_id: c.chunk_id, score: c.score })),
            },
            null,
            2
          ),
          "utf8"
        );
      } catch {
        // ignore
      }
    }

    return chunks;
  }

  if (process.env.USE_JINA_RERANK === "true") {
    try {
      const final = await jinaRerank(query, chunks);

      if (process.env.RAG_DEBUG_DUMP === "true") {
        try {
          if (!(global as any).currentCaptureId) {
            (global as any).currentCaptureId = Date.now().toString();
          }
          const captureId = (global as any).currentCaptureId;
          const agentName = "rerank";
          const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
          if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

          fs.writeFileSync(
            `${dumpDir}/05_RERANK_POST_JINA.json`,
            JSON.stringify(
              {
                rerank_query: query,
                final_count: final.length,
                final_order: final.map((c: any) => ({ chunk_id: c.chunk_id, score: c.score })),
              },
              null,
              2
            ),
            "utf8"
          );
        } catch {
          // ignore
        }
      }

      return final;
    } catch (err) {
      console.error("Jina rerank failed:", err);
      throw err;
    }
  }

  const context = chunks
    .map((c, i) => {
      const ann = ontologyLoader.getAnnotation(c.chunk_id);
      const metadata = ann
        ? `[Concepts: ${ann.concepts.map(con => con.canonical).join(", ")}] [Roles: ${ann.concepts
            .flatMap(con => con.narrative_roles || [])
            .join(", ")}]`
        : "";
      return `#${i + 1} ${metadata}\n${c.text.slice(0, 400)}`;
    })
    .join("\n\n");

  const anchorContext = parentThesis
    ? `PROBABILISTIC CONTEXT ANCHOR (Higher Timeframe):
- Bias: ${parentThesis.bias}
- Summary: ${parentThesis.summary}
- Anchors: ${parentThesis.key_anchors.join(", ")}
`
    : "";

  const relationalContext = relational
    ? `INTERMARKET RELATIONAL CONTEXT:
- Overall Alignment: ${relational.overall_relational_alignment}
- Influences: ${relational.external_influences
        .map(inf => `${inf.source_asset} ${inf.direction} (Conf: ${inf.confidence})`)
        .join(", ")}
- SMT Hints: ${relational.smt_hints
        .map(smt => `${smt.type} between ${smt.assets.join(" & ")}`)
        .join(", ")}
`
    : "";

  const prompt = `
You are a retrieval ranking system for an ICT market cognition system.

Task:
Rank ALL chunks by relevance (best to worst).
${anchorContext}
${relationalContext}

Rules:
1. Prioritize chunks that align with the Higher Timeframe Anchor OR explicitly explain deviations (retracements) from it.
2. Value chunks that define the relationship between the query timeframe and the HTF anchor.
3. INTERMARKET NOISE GUARDRAIL: Penalize cross-asset chunks (e.g., mentions of DXY when query is EURUSD) if they lack specific ICT technical concepts (FVG, OB, MSS) or do not explicitly explain the intermarket relationship.
4. Return full ranking as numbers (example: 3,1,5,2,...).
4. Return ONLY numbers separated by comma.
5. Do NOT explain.

Question:
${query}

Chunks:
${context}
`;

  const llmResult = await callLLM(prompt, "rerank", "rerank", [{ text: prompt }], { responseType: "text" });

  if (!llmResult) {
    console.log("⚠️ Rerank fallback");
    return chunks;
  }

  const text = typeof llmResult === "string" ? llmResult : String(llmResult);

  const indexes = text
    .split(",")
    .map((s: string) => parseInt(s.trim()) - 1)
    .filter((n: number) => !isNaN(n) && n >= 0 && n < chunks.length);

  if (indexes.length === 0) {
    console.log("⚠️ Invalid rerank output");
    return chunks;
  }

  const selected = indexes.map((i: number) => chunks[i]);
  const missing = chunks.filter((_, i) => !indexes.includes(i));
  const final = [...selected, ...missing];

  if (process.env.RAG_DEBUG_DUMP === "true") {
    try {
      if (!(global as any).currentCaptureId) {
        (global as any).currentCaptureId = Date.now().toString();
      }
      const captureId = (global as any).currentCaptureId;
      const agentName = "rerank";
      const dumpDir = `data/rag-debug/${captureId}/${agentName}`;
      if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

      fs.writeFileSync(
        `${dumpDir}/05_RERANK_POST.json`,
        JSON.stringify(
          {
            rerank_query: query,
            final_count: final.length,
            final_order: final.map((c: any) => ({
              chunk_id: c.chunk_id,
              score: c.score,
              jina_score: c.jina_score || c.relevance_score,
            })),
          },
          null,
          2
        ),
        "utf8"
      );
    } catch {
      // ignore
    }
  }

  return final;
}

