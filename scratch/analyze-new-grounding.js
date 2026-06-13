import fs from "fs";
import path from "path";

const DEBUG_ROOT = path.join(process.cwd(), "data", "rag-debug");

function getLatestRun() {
  const dirs = fs.readdirSync(DEBUG_ROOT).filter(f => fs.statSync(path.join(DEBUG_ROOT, f)).isDirectory());
  dirs.sort((a, b) => {
    return fs.statSync(path.join(DEBUG_ROOT, b)).mtimeMs - fs.statSync(path.join(DEBUG_ROOT, a)).mtimeMs;
  });
  return dirs[0];
}

const latestRun = getLatestRun();
console.log(`Analyzing latest run: ${latestRun}`);

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

function classifyText(text) {
  if (!text) return "PRICE";
  const t = text.toLowerCase();
  
  const hasTime = timeKeywords.some(kw => t.includes(kw));
  if (hasTime) return "TIME";
  return "PRICE";
}

for (const agent of agents) {
  const metaPath = path.join(DEBUG_ROOT, latestRun, agent, "06_GROUNDED_META.json");
  const textPath = path.join(DEBUG_ROOT, latestRun, agent, "06_GROUNDED.txt");
  
  if (fs.existsSync(metaPath) && fs.existsSync(textPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const text = fs.readFileSync(textPath, "utf8");
    const chunks = text.split("[CHUNK_ID:").filter(c => c.trim().length > 0);
    
    let time = 0;
    let price = 0;
    for (const chunk of chunks) {
      if (classifyText(chunk) === "TIME") {
        time++;
      } else {
        price++;
      }
    }
    
    console.log(`${agent}:`);
    console.log(`  Grounded Chunks: ${chunks.length}`);
    console.log(`  TIME Chunks: ${time}`);
    console.log(`  PRICE Chunks: ${price}`);
    console.log(`  Ratio: ${time} TIME / ${price} PRICE`);
  } else {
    console.log(`${agent}: (No data yet)`);
  }
}
