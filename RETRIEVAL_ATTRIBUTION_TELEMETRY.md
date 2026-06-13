# Retrieval Attribution Telemetry

## Overview

Telemetry system that tracks **which queries trigger which chunks** during RAG retrieval, enabling precise measurement of lane-specific retrieval impact in Vision-First architecture.

## Purpose

Answer critical questions:
1. **Does Lane 2 actually retrieve new knowledge?**
2. How many chunks are unique to each lane?
3. What is Lane 2's hit rate (chunks retrieved per query)?
4. Which observation queries produced those chunks?

## Architecture

### Components

**1. `retrieval-attribution.ts`** (NEW)
- `RetrievalAttributionTracker` class
- Tracks query→chunk mappings
- Computes per-lane metrics
- Singleton instance: `attributionTracker`

**2. `retrieval-core.ts`** (MODIFIED)
- `vectorSearch()`: tracks query→chunk for vector retrieval
- `keywordSearch()`: tracks query→chunk for BM25 retrieval
- Single retrieval pass with attribution overlay

**3. `base-agent.ts`** (MODIFIED)
- Registers lane assignments before `retrieveRAG()`
- Computes metrics after `retrieveRAG()`
- Dumps `04_ATTRIBUTION.json`

## Implementation

### 1. Query→Chunk Tracking

In `vectorSearch()` and `keywordSearch()`:

```typescript
// After retrieval, track which chunks this query retrieved
const chunkIds: string[] = [...]; // collected during retrieval
attributionTracker.trackQueryChunks(queries[i], chunkIds);
```

**Key principle:** Capture attribution during normal retrieval flow, no extra retrieval pass needed.

### 2. Lane Registration

In `base-agent.ts`, before calling `retrieveRAG()`:

```typescript
// Reset tracker
attributionTracker.reset();

// Register lane assignments
const laneRegistrations = [
  { query: "Dollar Index HTF targets", lane: "lane0" },
  { query: "Yield Divergence", lane: "lane1" },
  { query: "DXY bearish displacement visible", lane: "lane2" },
  // ...
];
attributionTracker.registerLanes(laneRegistrations);
```

### 3. Metrics Computation

After `retrieveRAG()` completes:

```typescript
const attributionMetrics = attributionTracker.computeMetrics();
dumpRagDebug(config.agentName, "04_ATTRIBUTION.json", attributionMetrics);
```

## Output Format

**File:** `data/rag-debug/{captureId}/{agentName}/04_ATTRIBUTION.json`

```json
{
  "lane0QueryCount": 62,
  "lane1QueryCount": 5,
  "lane2QueryCount": 4,
  
  "lane0TriggeredChunks": 21,
  "lane1TriggeredChunks": 3,
  "lane2TriggeredChunks": 4,
  
  "lane0UniqueChunks": ["chunk_1234", "chunk_5678"],
  "lane1UniqueChunks": ["chunk_9012"],
  "lane2UniqueChunks": ["chunk_3456", "chunk_7890"],
  
  "lane0SharedChunks": ["chunk_1111", "chunk_2222"],
  "lane1SharedChunks": ["chunk_3333"],
  "lane2SharedChunks": ["chunk_4444", "chunk_5555"],
  
  "lane2HitRate": 1.0,
  
  "queryAttribution": [
    {
      "query": "Dollar Index HTF targets",
      "lane": "lane0",
      "chunkIds": ["chunk_1234", "chunk_1111"]
    },
    {
      "query": "DXY bearish displacement visible",
      "lane": "lane2",
      "chunkIds": ["chunk_3456", "chunk_4444"]
    }
  ]
}
```

## Metrics Definitions

| Metric | Definition |
|--------|------------|
| `lane0QueryCount` | Number of queries from Lane 0 (pipeline baseline) |
| `lane1QueryCount` | Number of queries from Lane 1 (vision ontology concepts) |
| `lane2QueryCount` | Number of queries from Lane 2 (raw vision observations) |
| `lane0TriggeredChunks` | Number of unique chunks retrieved by at least one Lane 0 query |
| `lane1TriggeredChunks` | Number of unique chunks retrieved by at least one Lane 1 query |
| `lane2TriggeredChunks` | Number of unique chunks retrieved by at least one Lane 2 query |
| `lane0UniqueChunks` | Chunks retrieved ONLY by Lane 0 (not by Lane 1 or Lane 2) |
| `lane1UniqueChunks` | Chunks retrieved ONLY by Lane 1 (not by Lane 0 or Lane 2) |
| `lane2UniqueChunks` | Chunks retrieved ONLY by Lane 2 (not by Lane 0 or Lane 1) |
| `lane0SharedChunks` | Chunks retrieved by Lane 0 AND at least one other lane |
| `lane1SharedChunks` | Chunks retrieved by Lane 1 AND at least one other lane |
| `lane2SharedChunks` | Chunks retrieved by Lane 2 AND at least one other lane |
| `lane2HitRate` | `lane2TriggeredChunks / lane2QueryCount` |
| `queryAttribution` | Array of {query, lane, chunkIds} mappings |

## Key Insights from Metrics

### Lane 2 Effectiveness
```
lane2HitRate = lane2TriggeredChunks / lane2QueryCount
```
- **1.0 = perfect hit rate** (every query retrieved chunks)
- **0.5 = 50% hit rate** (half of queries retrieved nothing)
- **0.0 = complete miss** (Lane 2 added no retrieval value)

### Unique Contribution
```
len(lane2UniqueChunks) > 0
```
**Proves Lane 2 retrieved knowledge that Lane 0 + Lane 1 missed.**

### Redundancy Check
```
len(lane2SharedChunks) / lane2TriggeredChunks
```
- **High ratio** = Lane 2 mostly retrieved same chunks as Lane 0/1
- **Low ratio** = Lane 2 brought genuinely new chunks

## Files Modified

| File | Lines Added | Purpose |
|------|-------------|---------|
| `core/3.query/retrieval-attribution.ts` | +179 (NEW) | Attribution tracker module |
| `core/3.query/retrieval-core.ts` | +27 | Track query→chunk in vectorSearch() and keywordSearch() |
| `core/3.query/agents/shared/base-agent.ts` | +36 | Register lanes, compute metrics, dump JSON |

**Total: ~242 LOC**

## Usage

### Running with Attribution Telemetry

```bash
# Enable RAG debug dumps (includes attribution)
export RAG_DEBUG_DUMP=true

# Run any agent test
node test/test-htf-macro.ts
```

### Check Attribution Output

```bash
# Latest capture ID
ls -t data/rag-debug/ | head -1

# View attribution metrics
cat data/rag-debug/{captureId}/HTF-Macro-Agent/04_ATTRIBUTION.json | jq .
```

### Analyzing Results

```javascript
const attribution = require('./data/rag-debug/{captureId}/HTF-Macro-Agent/04_ATTRIBUTION.json');

console.log(`Lane 2 queries: ${attribution.lane2QueryCount}`);
console.log(`Lane 2 triggered chunks: ${attribution.lane2TriggeredChunks}`);
console.log(`Lane 2 unique chunks: ${attribution.lane2UniqueChunks.length}`);
console.log(`Lane 2 hit rate: ${attribution.lane2HitRate.toFixed(2)}`);

// Did Lane 2 add retrieval value?
if (attribution.lane2UniqueChunks.length > 0) {
  console.log('✅ Lane 2 retrieved NEW knowledge');
  console.log('Unique chunks:', attribution.lane2UniqueChunks);
} else {
  console.log('❌ Lane 2 added no unique chunks');
}
```

## Success Criteria

After ONE Macro-Time-Agent capture with attribution telemetry enabled:

✅ Can answer: **Did Lane 2 trigger any chunks?**
✅ Can answer: **How many?**
✅ Can answer: **Were any chunks unique to Lane 2?**
✅ Can answer: **What is Lane 2 hit rate?**
✅ Can answer: **Which observation queries produced those chunks?**

## Constraints Honored

- ✅ No architecture changes
- ✅ No retrieval logic changes
- ✅ No query generation changes
- ✅ Single retrieval pass only
- ✅ Telemetry overlay on existing flow

## Next Steps

1. Run production HTF-Macro-Agent capture with `RAG_DEBUG_DUMP=true`
2. Analyze `04_ATTRIBUTION.json`
3. Measure Lane 2 impact vs baseline (Lane 0 only)
4. Document findings and optimize if needed