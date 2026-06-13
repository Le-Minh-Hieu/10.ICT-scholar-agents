const fs = require('fs');
const path = require('path');

const dir = 'd:\\10. ict-scholar-agents-V1\\data\\rag-debug\\1781172658047\\HTF-Macro-Agent';
const pre = JSON.parse(fs.readFileSync(path.join(dir, '05_RERANK_PRE.json'), 'utf8'));
const post = JSON.parse(fs.readFileSync(path.join(dir, '05_RERANK_POST.json'), 'utf8'));

// Load all chunks from all files to ensure we get texts for all candidate chunk IDs
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
  let list = [];
  if (data.postRerankChunks) list = data.postRerankChunks;
  else if (data.results) list = data.results;
  
  for (const item of list) {
    if (item.chunk_id) {
      if (!chunkMap[item.chunk_id]) {
        chunkMap[item.chunk_id] = {
          text: item.text || '',
          source: item.source || '',
          section_title: item.section_title || ''
        };
      } else {
        if (!chunkMap[item.chunk_id].text && item.text) {
          chunkMap[item.chunk_id].text = item.text;
        }
        if (!chunkMap[item.chunk_id].source && item.source) {
          chunkMap[item.chunk_id].source = item.source;
        }
        if (!chunkMap[item.chunk_id].section_title && item.section_title) {
          chunkMap[item.chunk_id].section_title = item.section_title;
        }
      }
    }
  }
}

// Function to classify a chunk
function classify(chunkId, chunk) {
  const text = (chunk.text || '').toLowerCase();
  const source = (chunk.source || '').toLowerCase();
  const title = (chunk.section_title || '').toLowerCase();

  // Rules:
  // 1. DXY: Dollar Index, DXY, DX, USD index, US Dollar Index, etc.
  // 2. US10Y: 10-year note, 10-year Treasury, 10 Year Yield, 10-year yield, US10Y, 10 Year Note, 10-Yr yield, etc.
  // 3. Bond Market: bond market, bonds, 30-year bond, treasury bond, bond contract, ZB, etc.
  // 4. Rates: Interest rate, yield differential, yields, rate differential, macro interest rates, yield curve, etc.
  // 5. Treasury: Treasury, treasury notes, treasury bills, treasury market, debt market, etc.
  // 6. Other: anything else.

  if (text.includes('us10y') || text.includes('10-year note') || text.includes('10-year treasury') || text.includes('10 year yield') || text.includes('10 year note') || text.includes('10-year yield') || text.includes('ten-year yield') || text.includes('ten-year note') || source.includes('10 year yield') || source.includes('10 year note')) {
    return 'US10Y';
  }

  if (text.includes('dxy') || text.includes('dollar index') || text.includes('u.s. dollar index') || text.includes('dx ') || text.includes('dollar strength') || text.includes('dollar weakness') || title.includes('dollar index')) {
    return 'DXY';
  }

  if (text.includes('bond market') || text.includes('bond futures') || text.includes('treasury bond') || text.includes('30-year bond') || text.includes('30 year bond') || source.includes('bond trading') || source.includes('bond mega-trades')) {
    return 'Bond Market';
  }

  if (text.includes('interest rate') || text.includes('yield differential') || text.includes('rate differential') || text.includes('yield curve') || text.includes('rates market') || text.includes('interest rates') || source.includes('interest rate') || text.includes('yield triad')) {
    return 'Rates';
  }

  if (text.includes('treasury') || text.includes('treasuries') || text.includes('debt market') || source.includes('treasury') || text.includes('us20y')) {
    return 'Treasury';
  }

  // Fallback to text check if no high-priority match
  if (text.includes('bond')) {
    return 'Bond Market';
  }
  if (text.includes('yield') || text.includes('rate')) {
    return 'Rates';
  }

  return 'Other';
}

const classifiedChunks = {};
for (const [id, chunk] of Object.entries(chunkMap)) {
  classifiedChunks[id] = {
    ...chunk,
    class: classify(id, chunk)
  };
}

// Print classification for review
const outputData = [];
for (const item of pre.candidate_order) {
  const chunk = classifiedChunks[item.chunk_id] || { text: '', source: '', class: 'Other' };
  outputData.push({
    chunk_id: item.chunk_id,
    pre_score: item.score,
    pre_class: chunk.class,
    source: chunk.source,
    text: chunk.text.substring(0, 100).replace(/\n/g, ' ')
  });
}
fs.writeFileSync('chunk_classifications.json', JSON.stringify(outputData, null, 2));

// Calculate distribution
const preDist = {};
const postDist = {};

pre.candidate_order.forEach((item, index) => {
  const chunk = classifiedChunks[item.chunk_id] || { class: 'Other' };
  preDist[chunk.class] = (preDist[chunk.class] || 0) + 1;
});

post.final_order.forEach((item, index) => {
  const chunk = classifiedChunks[item.chunk_id] || { class: 'Other' };
  postDist[chunk.class] = (postDist[chunk.class] || 0) + 1;
});

console.log('PRE distribution:', preDist);
console.log('POST distribution:', postDist);

// Check ranking changes
const preRank = {};
pre.candidate_order.forEach((item, index) => {
  preRank[item.chunk_id] = index + 1;
});

const deltaList = [];
post.final_order.forEach((item, index) => {
  const postIndex = index + 1;
  const preIndex = preRank[item.chunk_id];
  const chunk = classifiedChunks[item.chunk_id] || { class: 'Other' };
  const diff = preIndex - postIndex; // positive means it gained rank (moved closer to 1)
  deltaList.push({
    chunk_id: item.chunk_id,
    class: chunk.class,
    pre_rank: preIndex,
    post_rank: postIndex,
    delta: diff,
    text: chunk.text.substring(0, 120).replace(/\n/g, ' ')
  });
});

fs.writeFileSync('delta_list.json', JSON.stringify(deltaList, null, 2));
console.log('Delta data written successfully.');
