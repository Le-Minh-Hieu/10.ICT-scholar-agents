const fs = require('fs');
const path = require('path');

const dir = 'd:\\10. ict-scholar-agents-V1\\data\\rag-debug\\1781172658047\\HTF-Macro-Agent';
const pre = JSON.parse(fs.readFileSync(path.join(dir, '05_RERANK_PRE.json'), 'utf8'));
const post = JSON.parse(fs.readFileSync(path.join(dir, '05_RERANK_POST.json'), 'utf8'));

const sources = [
  '05_RERANK.json',
  '04_FUSED_RESULTS.json',
  '04_VECTOR_RESULTS.json',
  '04_BM25_RESULTS.json'
];

const chunkMap = {};
for (const file of sources) {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) continue;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let list = data.postRerankChunks || data.results || [];
  for (const item of list) {
    if (item.chunk_id) {
      if (!chunkMap[item.chunk_id]) {
        chunkMap[item.chunk_id] = {
          text: item.text || '',
          source: item.source || '',
          section_title: item.section_title || ''
        };
      } else {
        if (!chunkMap[item.chunk_id].text && item.text) chunkMap[item.chunk_id].text = item.text;
        if (!chunkMap[item.chunk_id].source && item.source) chunkMap[item.chunk_id].source = item.source;
      }
    }
  }
}

// Precise manual/rule-based classifications for matching candidate pool:
const specialClassMap = {
  'chunk_2627': 'US10Y',       // Declining 10-year treasury notes
  'chunk_609': 'Bond Market',  // Mentions bias through bonds or dollar
  'chunk_4172': 'DXY',         // "Framing Market Logic with DXY"
  'chunk_2509': 'DXY'          // "Impact on Exports, Stocks, and Bonds" (how DXY affects them)
};

function getClassification(chunkId, chunk) {
  if (specialClassMap[chunkId]) {
    return specialClassMap[chunkId];
  }

  const text = (chunk.text || '').toLowerCase();
  const title = (chunk.section_title || '').toLowerCase();

  if (text.includes('dxy') || text.includes('dollar index') || text.includes('u.s. dollar index') || text.includes('dx ') || title.includes('dollar index') || text.includes('dollar strength') || text.includes('dollar weakness')) {
    return 'DXY';
  }

  return 'Other';
}

const preDist = { DXY: 0, US10Y: 0, Treasury: 0, 'Bond Market': 0, Rates: 0, Other: 0 };
const postDist = { DXY: 0, US10Y: 0, Treasury: 0, 'Bond Market': 0, Rates: 0, Other: 0 };

pre.candidate_order.forEach((item) => {
  const chunk = chunkMap[item.chunk_id] || { text: '', source: '' };
  const cls = getClassification(item.chunk_id, chunk);
  preDist[cls] = (preDist[cls] || 0) + 1;
});

post.final_order.forEach((item) => {
  const chunk = chunkMap[item.chunk_id] || { text: '', source: '' };
  const cls = getClassification(item.chunk_id, chunk);
  postDist[cls] = (postDist[cls] || 0) + 1;
});

console.log('PRE distribution:', preDist);
console.log('POST distribution:', postDist);

// Calculate delta rank details
const preRank = {};
pre.candidate_order.forEach((item, index) => {
  preRank[item.chunk_id] = index + 1;
});

const deltaList = [];
post.final_order.forEach((item, index) => {
  const postIndex = index + 1;
  const preIndex = preRank[item.chunk_id];
  const chunk = chunkMap[item.chunk_id] || { text: '' };
  const cls = getClassification(item.chunk_id, chunk);
  const diff = preIndex - postIndex; // positive means rank improved
  deltaList.push({
    chunk_id: item.chunk_id,
    class: cls,
    pre_rank: preIndex,
    post_rank: postIndex,
    delta: diff,
    text: chunk.text
  });
});

fs.writeFileSync('delta_list_precise.json', JSON.stringify(deltaList, null, 2));
console.log('Precise delta data written.');
