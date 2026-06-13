# RERANK_GRAPH.md

## Proven code facts (no speculation)

### Rerank call entrypoint (only concrete call we found)
- `core/3.query/retrieval-core.ts` inside `retrieveRAG(...)`
  - `await rerank(rerankQuery, topCandidates as any, parentThesis, input.relational)`
  - `rerankQuery = queriesOnly.join(", ")`
  - `topCandidates = thresholdFiltered.slice(0, 80)`

### Rerank implementation (LLM invocation)
- `core/3.query/rerank.ts` inside `rerank(...)`
  - `callLLM(prompt, "rerank", "rerank", [{ text: prompt }], { responseType: 'text' })`
  - Early exit: `if (chunks.length <= 3) return chunks;`

### Who triggers retrieval (where `retrieveRAG(...)` is called)
We found these `retrieveRAG(...)` callsites (each can reach `rerank(...)` through `retrieveRAG`):

1. `core/3.query/agents/shared/base-agent.ts`
   - Function: `runBaseAgent(...)`
   - Layer: **depends on config.layer** passed by the specific agent wrapper (htf/itf/ltf/time/confluence)
   - Flow:
     - `runBaseAgent(...)`
       -> `retrieveRAG({ queries, conceptEmbeddings, agentName: config.agentName, memory, relational, scenarios, pmso })`
       -> `core/3.query/retrieval-core.ts:retrieveRAG(...)`
       -> `core/3.query/rerank.ts:rerank(...)` (via rerank call in retrieveRAG)

2. `core/3.query/rag-orchestrator.ts`
   - Function: `runRAG(pipelinePath, step?)`
   - Layer: **Other/Orchestrator** (not tied to HTF/ITF/LTF/Time/Confluence in this file)
   - Flow: `runRAG(...) -> retrieveRAG(...) -> retrieve-core -> rerank.ts -> callLLM(..."rerank"...)`

3. `core/3.query/cli-retrieval.ts`
   - Function: `runRetrievalCli()`
   - Layer: **Other/CLI**
   - Flow: CLI -> `retrieveRAG(...)` -> retrieval-core -> rerank.ts -> callLLM(..."rerank"...)

4. News retrieval (macro adapters)
   - `core/news/cognition/macro-retrieval-adapter.ts`
     - `retrieveForMacroProfile(...) -> retrieveRAG(...) -> rerank`
   - `core/news/cognition/daily-context-retrieval-adapter.ts`
     - `retrieveForDailyContext(...) -> retrieveRAG(...) -> rerank`

5. News retrieval (archived)
   - `core/archive/news-retrieval.ts`
     - `retrieveNewsContext(...) -> retrieveRAG(...) -> rerank`

6. Evaluation runner (benchmarks)
   - `core/5.eval/runner.ts`
     - `runEvaluation(...) -> retrieveRAG(...) -> rerank`

## Agent layer mapping (what we can state from code)
All agent wrappers call `runBaseAgent(...)` with a `layer` field, and `runBaseAgent(...)` always calls `retrieveRAG(...)`.

From `core/3.query/agents/shared/base-agent.ts`:
- `retrieveRAG(...)` is invoked unconditionally after building queries + embeddings.
- therefore every agent wrapper that uses `runBaseAgent` can generate rerank calls.

From wrapper files we opened:

### Time layer agents (examples)
- `core/3.query/agents/time/weekly-agent.ts`
  - `agentName: "Weekly-Agent"`
  - `layer: "time"`
- `core/3.query/agents/time/daily-agent.ts`
  - `agentName: "Daily-Agent"`
  - `layer: "time"`

### HTF/ITF structure agents (examples)
- `core/3.query/agents/htf/htf-structure-agent.ts`
  - `agentName: "HTF-Structure-Agent"`
  - `layer: "htf"`
- `core/3.query/agents/itf/itf-structure-agent.ts`
  - `agentName: "ITF-Structure-Agent"`
  - `layer: "itf"`

## Rerank graph summary (template)
For every `runBaseAgent(...)` invocation:

- `Agent(HTF/ITF/LTF/Time/Confluence wrapper)`
  -> `runBaseAgent(...)` (base-agent orchestrator)
  -> `retrieveRAG(...)`
     -> `retrieveRAG` in `core/3.query/retrieval-core.ts`
        -> `await rerank(...)`
           -> `rerank(...)` in `core/3.query/rerank.ts`
              -> `callLLM(..., agentType="rerank", callId="rerank", ...)`

## Status
This file currently includes the complete *retrieval-to-rerank* edge and the known `retrieveRAG(...)` callsites.

Runtime-counting (Steps 3–6 in your audit) is not implemented here because it requires locating the latest runtime logs with `stage: "LLM_TRACE"` and `agentType: "rerank"` / or `agentType` / `callId` correlation.

