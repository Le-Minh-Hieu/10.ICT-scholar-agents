import * as fs from "fs";
import * as path from "path";

const CHUNK_DIR = path.join(process.cwd(), "data/chunk_output");
const files = fs.readdirSync(CHUNK_DIR).filter(f => f.endsWith(".chunks.json"));

const searchMap = {
  "Quarterly Bias": [
    "quarterly shift",
    "quarterly market shift",
    "quarterly shifts",
    "directional bias",
    "quarterly direction"
  ],
  "Quarterly Seasonality": [
    "seasonal tendencies",
    "seasonal tendency",
    "seasonal influence",
    "seasonal pattern",
    "seasonality"
  ],
  "Quarterly profile": [
    "quarterly shifts",
    "ipda data ranges",
    "data ranges",
    "quarterly profile"
  ],
  "End-of-Quarter Effect": [
    "quarter change",
    "new quarter",
    "quarter transition",
    "turn of quarter",
    "quarterly shift",
    "quarterly shifts"
  ],
  "Turn-of-Quarter Effect": [
    "quarter change",
    "new quarter",
    "quarter transition",
    "turn of quarter",
    "quarterly shift",
    "quarterly shifts"
  ],
  "First Trading Day Effect": [
    "first trading day",
    "opening range",
    "opening day"
  ],
  "Last Trading Day Effect": [
    "last trading day",
    "closing day",
    "end of month"
  ],
  "Options Expiry Effect": [
    "options expiry",
    "opex",
    "expiration"
  ],
  "Quarterly Market Sentiment Shifts": [
    "sentiment shift",
    "sentiment shifts",
    "market sentiment"
  ],
  "Quarterly Economic Data Releases": [
    "economic data",
    "data releases",
    "news release",
    "data release"
  ],
  "Quarterly Options Expiry": [
    "options expiry",
    "opex",
    "expiration"
  ],
  "Quarterly Buy Day Bias": [
    "buy day bias",
    "seasonal tendencies",
    "quarterly shifts"
  ],
  "Quarterly Sell Day Bias": [
    "sell day bias",
    "seasonal tendencies",
    "quarterly shifts"
  ],
  "End-of-Quarter Reversal": [
    "quarter end",
    "rebalancing",
    "institutional repositioning",
    "quarterly shift",
    "quarterly shifts",
    "reversal"
  ],
  "Turn-of-Quarter Reversal": [
    "turn of quarter",
    "quarter change",
    "quarterly shifts",
    "reversal"
  ],
  "First Trading Day Reversal": [
    "first trading day",
    "reversal"
  ],
  "Last Trading Day Reversal": [
    "last trading day",
    "reversal"
  ],
  "Options Expiry Reversal": [
    "options expiry",
    "reversal"
  ],
  "NFP Reversal": [
    "non farm payroll",
    "payroll release",
    "nfp week",
    "employment data",
    "nfp",
    "non-farm payroll"
  ]
};

const results = {};
Object.keys(searchMap).forEach(concept => {
  results[concept] = [];
});

for (const file of files) {
  const content = JSON.parse(fs.readFileSync(path.join(CHUNK_DIR, file), "utf-8"));
  for (const chunk of content) {
    const textLower = chunk.text.toLowerCase();
    
    Object.entries(searchMap).forEach(([concept, terms]) => {
      terms.forEach(term => {
        if (textLower.includes(term.toLowerCase())) {
          results[concept].push({
            file: file,
            chunk_id: chunk.chunk_id,
            matched_term: term,
            snippet: chunk.text.slice(0, 150).replace(/\n/g, " ") + "..."
          });
        }
      });
    });
  }
}

// Print summary
const summary = {};
Object.entries(results).forEach(([concept, matches]) => {
  // Dedup matches by chunk_id
  const uniqueMatches = [];
  const seen = new Set();
  matches.forEach(m => {
    if (!seen.has(m.chunk_id)) {
      seen.add(m.chunk_id);
      uniqueMatches.push(m);
    }
  });
  summary[concept] = {
    total_unique_matches: uniqueMatches.length,
    sample_matches: uniqueMatches.slice(0, 3)
  };
});

console.log(JSON.stringify(summary, null, 2));
