import { Timeframe, TimeframeThesis, ProbabilisticBias } from "../../shared/knowledge/hierarchical-types.js";
import { callLLM } from "../../shared/utils/llm-utils.js";
import axios from "axios";
import { log } from "../../shared/utils/logger.js";
import fs from "fs";
export async function summarizeTimeframeThesis(
  timeframe: Timeframe,
  agentOutputs: any[],
  retrievedChunks: any[],
  parentThesis?: TimeframeThesis
): Promise<TimeframeThesis> {

  log({ stage: "SUMMARIZER", message: `Generating probabilistic thesis for ${timeframe}` });
  const compactAgentOutputs = agentOutputs.map(output => {
    const {
      _debug,
      _raw,
      telemetry,
      grounded,
      expandedQueries,
      compact_output,
      ...rest
    } = output;

    return rest;
  });
  const prompt = `You are a Hierarchical Market Summarizer specializing in ICT concepts.
Your task is to compress the provided agent analyses and retrieved knowledge into a PROBABILISTIC THESIS for the ${timeframe} timeframe.

## PARENT THESIS (${parentThesis?.timeframe || 'NONE'})
${parentThesis?.summary || 'No parent thesis provided.'}

## INPUT DATA
AGENT OUTPUTS:
${JSON.stringify(compactAgentOutputs, null, 2)}

KEY RETRIEVED CHUNKS:
${retrievedChunks.slice(0, 5).map(c => `[${c.chunk_id}] ${c.text}`).join("\n\n")}

## MANDATORY GUIDELINES
1. USE PROBABILISTIC LANGUAGE: Use terms like "suggests", "potential", "evidence for", "aligns with". NEVER state a market bias as an absolute fact.
2. IDENTIFY ANCHORS: Extract specific ICT levels or concepts (FVGs, Order Blocks, Liquidity Pools) that are serving as the "anchor" for this timeframe.
3. SEEK OPPOSING EVIDENCE: Explicitly look for data that contradicts the primary bias.
4. DEFINE SHIFT CONDITIONS: What specific price action would invalidate this thesis?

## OUTPUT FORMAT (JSON ONLY)
{
  "bias": "suggests_bullish" | "suggests_bearish" | "suggests_neutral" | "evidence_for_reversal" | "evidence_for_retracement",
  "confidence": 0.7,
  "key_anchors": ["Level 1", "Concept 2"],
  "summary": "2-3 sentence probabilistic summary",
  "supporting_chunks": ["chunk_id_1", "chunk_id_2"],
  "opposing_evidence": "Notes on contradictory signals",
  "shift_conditions": "What invalidates this?"
}

IMPORTANT: Be objective. If the data is conflicting, favor "suggests_neutral" or lower the confidence.`;


  fs.writeFileSync(
    `debug-${timeframe}.txt`,
    prompt,
    "utf8"
  );
  try {
    const rawLlmResult = await callLLM(prompt, "Hierarchical-Summarizer", Date.now().toString(), [{ text: prompt }], {
      useStructured: true,
      returnTelemetry: true
    });
    const result: any = rawLlmResult.data;
    const telemetry = rawLlmResult.telemetry;

    const thesis: TimeframeThesis & { telemetry?: any } = {
      timeframe,
      bias: (result?.bias || "unknown") as ProbabilisticBias,
      confidence: result?.confidence ?? 0.1,
      key_anchors: result?.key_anchors || [],
      summary: result?.summary || "No summary available.",
      supporting_chunks: result?.supporting_chunks || [],
      opposing_evidence: result?.opposing_evidence,
      shift_conditions: result?.shift_conditions,
      // telemetry,
    };

    log({ stage: "SUMMARIZER_RESULT", message: `Thesis for ${timeframe} generated`, data: { bias: thesis.bias, confidence: thesis.confidence } });
    return thesis;
  } catch (error) {
    console.error(`Error generating thesis for ${timeframe}:`, error);
    return {
      timeframe,
      bias: "unknown",
      confidence: 0.1,
      key_anchors: [],
      summary: "Error generating probabilistic summary.",
      supporting_chunks: []
    };
  }
}
