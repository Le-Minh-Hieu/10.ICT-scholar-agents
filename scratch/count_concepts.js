import * as fs from "fs";
import * as path from "path";

const CHUNK_DIR = path.join(process.cwd(), "data/chunk_output");
const concepts = [
  "Quarterly Bias",
  "Quarterly Seasonality",
  "Quarterly profile",
  "End-of-Quarter Effect",
  "Turn-of-Quarter Effect",
  "First Trading Day Effect",
  "Last Trading Day Effect",
  "Options Expiry Effect",
  "Quarterly Market Sentiment Shifts",
  "Quarterly Economic Data Releases",
  "Quarterly Options Expiry",
  "Quarterly Buy Day Bias",
  "Quarterly Sell Day Bias",
  "End-of-Quarter Reversal",
  "Turn-of-Quarter Reversal",
  "First Trading Day Reversal",
  "Last Trading Day Reversal",
  "Options Expiry Reversal",
  "NFP Reversal"
];

const files = fs.readdirSync(CHUNK_DIR).filter(f => f.endsWith(".chunks.json"));
const results = {};
concepts.forEach(c => results[c] = 0);

for (const file of files) {
  const content = JSON.parse(fs.readFileSync(path.join(CHUNK_DIR, file), "utf-8"));
  for (const chunk of content) {
    const textLower = chunk.text.toLowerCase();
    concepts.forEach(c => {
      const cLower = c.toLowerCase();
      // Count frequency of occurrences
      let pos = textLower.indexOf(cLower);
      while (pos !== -1) {
        results[c]++;
        pos = textLower.indexOf(cLower, pos + 1);
      }
    });
  }
}

console.log(JSON.stringify(results, null, 2));
