const fs = require('fs');
const d = JSON.parse(fs.readFileSync('data/rag-debug/1781063557088/HTF-Macro-Agent/04_ATTRIBUTION.json', 'utf8'));
const qa = d.queryAttribution;

// Task 1: Full Executed Query Table
console.log('=== TASK 1: Full Executed Query Table ===');
console.log('| query | lane | chunk_count |');
console.log('|---|---|---|');
qa.forEach(entry => {
    const count = entry.chunkIds.length;
    console.log(`| ${entry.query} | ${entry.lane} | ${count} |`);
});

// Task 2: Validate Query Counts
console.log('\n=== TASK 2: Validate Query Counts ===');
const uniqueQueries = new Set(qa.map(x => x.query));
const lane0Queries = qa.filter(x => x.lane === 'lane0').map(x => x.query);
const lane1Queries = qa.filter(x => x.lane === 'lane1').map(x => x.query);
const lane2Queries = qa.filter(x => x.lane === 'lane2').map(x => x.query);
const uniqueLane0 = new Set(lane0Queries);
const uniqueLane1 = new Set(lane1Queries);
const uniqueLane2 = new Set(lane2Queries);
console.log('Unique queries in queryAttribution:', uniqueQueries.size);
console.log('Unique lane0 queries:', uniqueLane0.size);
console.log('Unique lane1 queries:', uniqueLane1.size);
console.log('Unique lane2 queries:', uniqueLane2.size);
const sumLanes = uniqueLane0.size + uniqueLane1.size + uniqueLane2.size;
console.log('Sum of unique lane queries:', sumLanes);
console.log('Total unique queries:', uniqueQueries.size);
console.log('Discrepancy:', uniqueQueries.size - sumLanes);

// Task 3: Top Retrieval Drivers (top 15 by chunk_count descending)
console.log('\n=== TASK 3: Top Retrieval Drivers (top 15) ===');
const withCount = qa.map(x => ({ query: x.query, lane: x.lane, chunk_count: x.chunkIds.length }));
withCount.sort((a, b) => b.chunk_count - a.chunk_count);
console.log('| query | lane | chunk_count |');
console.log('|---|---|---|');
withCount.slice(0, 15).forEach(x => {
    console.log(`| ${x.query} | ${x.lane} | ${x.chunk_count} |`);
});

// Task 4: Bottom Retrieval Drivers (bottom 15 by chunk_count ascending)
console.log('\n=== TASK 4: Bottom Retrieval Drivers (bottom 15) ===');
withCount.sort((a, b) => a.chunk_count - b.chunk_count);
console.log('| query | lane | chunk_count |');
console.log('|---|---|---|');
withCount.slice(0, 15).forEach(x => {
    console.log(`| ${x.query} | ${x.lane} | ${x.chunk_count} |`);
});

// Task 5: Lane Contribution
console.log('\n=== TASK 5: Lane Contribution ===');
const lanes = ['lane0', 'lane1', 'lane2'];
lanes.forEach(lane => {
    const entries = qa.filter(x => x.lane === lane);
    const queryCount = entries.length;
    const totalChunkHits = entries.reduce((sum, x) => sum + x.chunkIds.length, 0);
    const avg = queryCount === 0 ? 0 : totalChunkHits / queryCount;
    console.log(`${lane}:`);
    console.log(`  query_count: ${queryCount}`);
    console.log(`  total_chunk_hits: ${totalChunkHits}`);
    console.log(`  average_chunks_per_query: ${avg}`);
});

// Task 6: Coverage Analysis
console.log('\n=== TASK 6: Coverage Analysis (lane2UniqueChunks minus lane0UniqueChunks) ===');
const l2s = new Set(d.lane2UniqueChunks);
const l0s = new Set(d.lane0UniqueChunks);
const diff = [...l2s].filter(x => !l0s.has(x));
console.log('Unique chunk count:', diff.length);
console.log('First 50 chunk ids:');
diff.slice(0, 50).forEach((chunk, i) => console.log(`${i + 1}. ${chunk}`));

// Task 7: Contradiction Check
console.log('\n=== TASK 7: Contradiction Check ===');
const lane0ChunkHits = qa.filter(x => x.lane === 'lane0').reduce((sum, x) => sum + x.chunkIds.length, 0);
const lane2ChunkHits = qa.filter(x => x.lane === 'lane2').reduce((sum, x) => sum + x.chunkIds.length, 0);
const lane2UniqueCount = d.lane2UniqueChunks.length;

// A. "Lane2 contributes nothing"
const lane2ContributesNothing = lane2UniqueCount === 0;
console.log(`A. "Lane2 contributes nothing": ${lane2ContributesNothing ? 'PROVEN' : 'DISPROVEN'}`);
console.log(`   lane2UniqueChunks count: ${lane2UniqueCount}`);

// B. "Lane2 retrieves fewer chunks than Lane0"
const lane2RetrievesFewer = lane2ChunkHits < lane0ChunkHits;
console.log(`B. "Lane2 retrieves fewer chunks than Lane0": ${lane2RetrievesFewer ? 'PROVEN' : 'DISPROVEN'}`);
console.log(`   lane0 total_chunk_hits: ${lane0ChunkHits}`);
console.log(`   lane2 total_chunk_hits: ${lane2ChunkHits}`);

// C. "Lane2 expands retrieval coverage"
const lane2ExpandsCoverage = diff.length > 0;
console.log(`C. "Lane2 expands retrieval coverage": ${lane2ExpandsCoverage ? 'PROVEN' : 'DISPROVEN'}`);
console.log(`   unique chunks only in lane2 (not in lane0): ${diff.length}`);