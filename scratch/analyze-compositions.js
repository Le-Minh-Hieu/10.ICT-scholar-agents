import fs from "fs";
import path from "path";

const RUN_ID = "1781229081204";
const DEBUG_DIR = path.join(process.cwd(), "data", "rag-debug", RUN_ID);

const agents = [
  "HTF-Macro-Agent",
  "Quarterly-Agent",
  "Monthly-Agent",
  "Weekly-Agent",
  "Daily-Agent",
  "Session-Agent"
];

const timeKeywords = [
  "yield seasonal", "dxy seasonal", "intermarket timing", "macro cycle", "quarterly shift", 
  "quarterly seasonality", "month-in-quarter", "turn of month", "turn-of-month", "end of month", "end-of-month",
  "monthly seasonality", "options expiry", "nwog", "weekly open", "ndog", "daily open", "economic catalyst", 
  "catalyst timing", "midnight open", "judas swing", "silver bullet", "london open", "ny open", "new york open", 
  "asian open", "session timing", "killzone", "ny am", "ny pm", "asia session", "london session", "new york session", 
  "time window", "timing window", "temporal tag", "tom", "eom", "catalyst", "midnight", "london", "new york", "asia",
  "hours", "weekly profile", "daily profile", "session profile"
];

const priceKeywords = [
  "fvg", "fair value gap", "order block", "ob", "breaker", "mitigation", "mss", "bms", "liquidity sweep", 
  "stop hunt", "ote", "displacement", "premium", "discount", "equilibrium", "range", "structure", "liquidity",
  "highs", "lows", "support", "resistance"
];

function classifyText(text) {
  if (!text) return "PRICE";
  const t = text.toLowerCase();
  
  const hasTime = timeKeywords.some(kw => t.includes(kw));
  const hasPrice = priceKeywords.some(kw => t.includes(kw));
  
  if (hasTime && hasPrice) return "MIXED";
  if (hasTime) return "TIME";
  return "PRICE";
}

function computeStats(items) {
  if (!items || items.length === 0) return { time: 0, price: 0, mixed: 0 };
  let time = 0;
  let price = 0;
  let mixed = 0;
  
  for (const item of items) {
    const cls = classifyText(item);
    if (cls === "TIME") time++;
    else if (cls === "MIXED") mixed++;
    else price++;
  }
  
  const total = items.length;
  return {
    time: Math.round((time / total) * 100),
    price: Math.round((price / total) * 100),
    mixed: Math.round((mixed / total) * 100)
  };
}

const matrix = {};

for (const agent of agents) {
  const agentDir = path.join(DEBUG_DIR, agent);
  if (!fs.existsSync(agentDir)) {
    console.error(`Dir not found for ${agent}`);
    continue;
  }

  // 1. Vision Observations (from 00_VISION_SUMMARY.txt)
  let visionBullets = [];
  const visionSummaryPath = path.join(agentDir, "00_VISION_SUMMARY.txt");
  if (fs.existsSync(visionSummaryPath)) {
    const text = fs.readFileSync(visionSummaryPath, "utf8");
    visionBullets = text.split("\n").filter(l => l.trim().startsWith("*") || l.trim().startsWith("-"));
  }
  const visionStats = computeStats(visionBullets);

  // 2. Lane2 Query (from 00_VISION_SIGNALS.json)
  let lane2Queries = [];
  const visionSignalsPath = path.join(agentDir, "00_VISION_SIGNALS.json");
  if (fs.existsSync(visionSignalsPath)) {
    const data = JSON.parse(fs.readFileSync(visionSignalsPath, "utf8"));
    lane2Queries = data.lane2_fact_queries || [];
  }
  const lane2Stats = computeStats(lane2Queries);

  // 3. Retrieval Top80 (from 04_SEARCH.json)
  // 4. Rerank Top20 (from 04_SEARCH.json)
  let top80Chunks = [];
  let top20Chunks = [];
  const searchPath = path.join(agentDir, "04_SEARCH.json");
  if (fs.existsSync(searchPath)) {
    const data = JSON.parse(fs.readFileSync(searchPath, "utf8"));
    const rawChunks = data.chunks || [];
    top80Chunks = rawChunks.slice(0, 80).map(c => c.text);
    top20Chunks = rawChunks.slice(0, 20).map(c => c.text);
  }
  const top80Stats = computeStats(top80Chunks);
  const top20Stats = computeStats(top20Chunks);

  // 5. Grounding (from 06_GROUNDED.txt)
  let groundedChunks = [];
  const groundedPath = path.join(agentDir, "06_GROUNDED.txt");
  if (fs.existsSync(groundedPath)) {
    const text = fs.readFileSync(groundedPath, "utf8");
    groundedChunks = text.split("[CHUNK_ID:").filter(c => c.trim().length > 0);
  }
  const groundingStats = computeStats(groundedChunks);

  // 6. Reasoning (sentences from response notes/reasoning)
  let reasoningSentences = [];
  const responsePath = path.join(agentDir, "08_RESPONSE.json");
  if (fs.existsSync(responsePath)) {
    const data = JSON.parse(fs.readFileSync(responsePath, "utf8"));
    const reasoningText = data.response?.notes || data.response?.reasoning || "";
    reasoningSentences = reasoningText.split(/[.!?]/).filter(s => s.trim().length > 10);
  }
  const reasoningStats = computeStats(reasoningSentences);

  // 7. Output (from response fields)
  let outputFields = [];
  if (fs.existsSync(responsePath)) {
    const data = JSON.parse(fs.readFileSync(responsePath, "utf8"));
    const resp = data.response || {};
    // Extract textual fields
    if (resp.expectation) outputFields.push(resp.expectation);
    if (resp.notes) outputFields.push(resp.notes);
    if (resp.timing_bias) outputFields.push(resp.timing_bias);
  }
  const outputStats = computeStats(outputFields);

  matrix[agent] = {
    vision: visionStats,
    lane2: lane2Stats,
    top80: top80Stats,
    top20: top20Stats,
    grounding: groundingStats,
    reasoning: reasoningStats,
    output: outputStats
  };
}

console.log(JSON.stringify(matrix, null, 2));
