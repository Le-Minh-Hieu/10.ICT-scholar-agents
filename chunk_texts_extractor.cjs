const fs = require('fs');
const path = require('path');

const rerankPath = 'd:\\10. ict-scholar-agents-V1\\data\\rag-debug\\1781172658047\\HTF-Macro-Agent\\05_RERANK.json';
const prePath = 'd:\\10. ict-scholar-agents-V1\\data\\rag-debug\\1781172658047\\HTF-Macro-Agent\\05_RERANK_PRE.json';
const postPath = 'd:\\10. ict-scholar-agents-V1\\data\\rag-debug\\1781172658047\\HTF-Macro-Agent\\05_RERANK_POST.json';

const rawData = JSON.parse(fs.readFileSync(rerankPath, 'utf8'));
const preData = JSON.parse(fs.readFileSync(prePath, 'utf8'));
const postData = JSON.parse(fs.readFileSync(postPath, 'utf8'));

const chunkMap = {};
for (const chunk of rawData.postRerankChunks) {
  chunkMap[chunk.chunk_id] = {
    text: chunk.text,
    source: chunk.source,
    section_title: chunk.section_title
  };
}

fs.writeFileSync('chunk_texts.json', JSON.stringify(chunkMap, null, 2));
console.log('Extracted', Object.keys(chunkMap).length, 'chunks.');
