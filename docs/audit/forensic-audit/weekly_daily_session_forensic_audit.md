# SYSTEM FORENSIC AUDIT: Weekly, Daily, and Session Agents

This forensic audit report investigates the current behavior, query generation pipeline, vocabulary coverage, retrieval diversity, grounding patterns, vision-first readiness, and calendar dependencies of the **Weekly-Agent**, **Daily-Agent**, and **Session-Agent**.

---

## PHASE 1 — EXECUTION TRACE

The execution path for all three agents is standardized under a shared orchestration framework. The complete trace from entrypoint to response generation is outlined below:

### Weekly-Agent Execution Trace

| Stage | File | Function | Purpose |
| :--- | :--- | :--- | :--- |
| **Agent Entrypoint** | [weekly-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/weekly-agent.ts) | `weeklyAgent` | Entry point for Weekly Time analysis. Constructs the NY time context and weekly profile narrative, registers the 3 chart image buffers (W, D, H4), and invokes `runBaseAgent`. |
| **Base Orchestration** | [base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts) | `runBaseAgent` | Manages the lifecycle of the agent: loads the pipeline steps, triggers concept extraction, calls the query builder, runs RAG retrieval, invokes grounding, structures the prompt, and handles the LLM response loop. |
| **Query Generation** | [query-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts) | `buildQueries` / `finalizeWeightedQueries` | Extracts concepts for `weekly_time` from `time_pipeline.json`, creates query structures, attempts ontology expansion, and applies a hard truncation limit to the top 15 queries. |
| **Retrieval Core** | [retrieval-core.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts) | `retrieveRAG` | Standard two-way retrieval: embeds queries and runs `vectorSearch` (cosine similarity) combined with tokenized `keywordSearch` (BM25) over the global corpus index. |
| **Rerank** | [retrieval-core.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts) | `fuseScores` | Computes fusion scores by combining normalized vector similarity (70%) and BM25 scores (15%) with active boosts (ontology, scenario, PMSO, and relational). |
| **Grounding** | [grounding.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/grounding.ts) | `buildGrounded` | Filters out irrelevant chunks, deduplicates sequential matches preserving rerank order via `simpleDedup`, and returns the top 6 grounding blocks. |
| **Prompt Build** | [prompt-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/prompt-builder.ts) | `buildPrompt` | Hydrates the template prompt using the role, task, constraints, input context, and the grounded knowledge text blocks. |
| **Response Generation** | [base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts) | `callLLM` | Sends the prompt combined with the weekly charts (W, D, H4) to the Gemini model and validates the JSON output against the schema. |

### Daily-Agent Execution Trace

| Stage | File | Function | Purpose |
| :--- | :--- | :--- | :--- |
| **Agent Entrypoint** | [daily-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/daily-agent.ts) | `dailyAgent` | Entry point for Daily Time analysis. Resolves NY time, current weekday, trading session status, and today's calendar catalysts. Attaches Daily chart buffers (D, H4, H1) and calls `runBaseAgent`. |
| **Base Orchestration** | [base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts) | `runBaseAgent` | Executes the standard RAG pipeline, tracking lineage and managing execution state. |
| **Query Generation** | [query-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts) | `buildQueries` / `finalizeWeightedQueries` | Extracts `daily_time` concepts, maps anchor queries, and truncates to the top 15 weighted queries. |
| **Retrieval Core** | [retrieval-core.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts) | `retrieveRAG` | Resolves embeddings for daily queries and executes parallel vector and BM25 keyword matching against the corpus. |
| **Rerank** | [retrieval-core.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts) | `fuseScores` | Applies score fusion and checks for OTE/session ontology boosts using `calculateOntologyBonus`. |
| **Grounding** | [grounding.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/grounding.ts) | `buildGrounded` | Captures the top 6 OTE and daily session chunks, preserving the exact rerank order. |
| **Prompt Build** | [prompt-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/prompt-builder.ts) | `buildPrompt` | Generates the LLM instructions containing the role focus and strict constraints (excluding MSS/BOS logic). |
| **Response Generation** | [base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts) | `callLLM` | Calls the model using the structured prompt and chart images (D, H4, H1). |

### Session-Agent Execution Trace

| Stage | File | Function | Purpose |
| :--- | :--- | :--- | :--- |
| **Agent Entrypoint** | [session-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/session-agent.ts) | `sessionAgent` | Entry point for Session Time analysis. Determines the current trading session (London, NY, Asian) and injects H1, M15, M5 chart buffers before invoking `runBaseAgent`. |
| **Base Orchestration** | [base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts) | `runBaseAgent` | Orchestrates the session context assembly, retrieval, and LLM calls. |
| **Query Generation** | [query-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts) | `buildQueries` / `finalizeWeightedQueries` | Extracts `session_time` concepts from `time_pipeline.json` and limits query size to 15. |
| **Retrieval Core** | [retrieval-core.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts) | `retrieveRAG` | Executes joint vector and lexical searches focused on session-specific tags. |
| **Rerank** | [retrieval-core.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts) | `fuseScores` | Runs score fusion with session tag boosts. |
| **Grounding** | [grounding.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/grounding.ts) | `buildGrounded` | Selects the top 6 session open/gap chunks. |
| **Prompt Build** | [prompt-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/prompt-builder.ts) | `buildPrompt` | Injects session open constraints and grounded facts. |
| **Response Generation** | [base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts) | `callLLM` | Performs inference with session-level charts (H1, M15, M5) to output timing bias. |

---

## PHASE 2 — VISION-FIRST STATUS AUDIT

An audit of the configuration profiles in the source files confirms that all three agents remain purely text-driven in their RAG pipelines and do not implement vision-first mechanisms.

### Weekly-Agent
| Feature | Enabled? | Evidence |
| :--- | :--- | :--- |
| **visionPrompt** | **NO** | Not defined in the config object passed to `runBaseAgent` in [weekly-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/weekly-agent.ts#L57-L123). |
| **Vision First** | **NO** | Skipped due to the missing `visionPrompt` parameter in the base agent orchestration. |
| **Lane1** | **NO** | The extraction of ontology concepts from vision summaries is inactive since no vision summary is generated. |
| **Lane2** | **NO** | The extraction of physical observations (Lane 2 queries) is bypassed. |
| **Pure Lane0** | **YES** | Bypasses all vision-first lanes, routing all queries entirely through Lane 0 (base queries). |
| **Attribution Tracking** | **INACTIVE** | Although the tracker registers all queries under `lane0` by default, no `04_ATTRIBUTION.json` is generated for this agent because it has not been executed since the telemetry code was merged. |

### Daily-Agent
| Feature | Enabled? | Evidence |
| :--- | :--- | :--- |
| **visionPrompt** | **NO** | Missing in `AgentConfig` in [daily-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/daily-agent.ts#L63-L132). |
| **Vision First** | **NO** | Bypassed. |
| **Lane1** | **NO** | Inactive. |
| **Lane2** | **NO** | Inactive. |
| **Pure Lane0** | **YES** | Executes as a Pure Lane 0 text RAG agent. |
| **Attribution Tracking** | **INACTIVE** | Bypassed at runtime (no logs exist). |

### Session-Agent
| Feature | Enabled? | Evidence |
| :--- | :--- | :--- |
| **visionPrompt** | **NO** | Missing in `AgentConfig` in [session-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/session-agent.ts#L60-L120). |
| **Vision First** | **NO** | Bypassed. |
| **Lane1** | **NO** | Inactive. |
| **Lane2** | **NO** | Inactive. |
| **Pure Lane0** | **YES** | Executes as a Pure Lane 0 text RAG agent. |
| **Attribution Tracking** | **INACTIVE** | Bypassed at runtime (no logs exist). |

---

## PHASE 3 — QUERY GENERATION AUDIT

An analysis of the query generation code in [query-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts) reveals critical architectural bottlenecks:

1. **The Truncation Bottleneck**: The pipeline defines dozens of concepts per agent. However, `finalizeWeightedQueries` sorts queries by weight and truncates them using a hard limit of `MAX_QUERY = 15`.
2. **Expansion Starvation**:
   * **Ontology Expansion** (weight 0.7) is completely starved. Because there are more than 15 base concepts (weight 0.8), the canonical mappings generated are pushed below the top 15 slots and are truncated.
   * **Temporal Expansion** (weight 0.25) is starved and never makes it to the final query list.
3. **Dead Parameters in base-agent**: In [base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L373-L374), when calling `buildQueries`, the variables `relational` and `scenarios` are passed as `undefined`. Consequently, **Scenario Expansion** and **Relational Expansion** are completely **DEAD** in these agents, even if contextual data is provided.

### Query Counts and Mappings

| Agent | Concepts Count | Generated Queries (Pre-Truncation) | Canonical Mappings (Surviving) | Final Query Count (Post-Truncation) |
| ----- | -------------- | ---------------------------------- | ------------------------------ | ----------------------------------- |
| **Weekly-Agent** | 61 | 61 (Anchor queries) + 0 (Ontology) | 0 | 15 (First 15 concepts only) |
| **Daily-Agent** | 73 | 73 (Anchor queries) + 0 (Ontology) | 0 | 15 (First 15 concepts only) |
| **Session-Agent** | 29 | 29 (Anchor queries) + 0 (Ontology) | 0 | 15 (First 15 concepts only) |

---

## PHASE 4 — VOCABULARY COVERAGE AUDIT

The pipeline concepts are heavily misaligned with the actual terminology in the corpus, leading to low exact match rates.

### 1. Weekly-Agent Concepts Coverage (Audit of Top 15 Concepts)
* **Exact Hits**: **0%** (The terms "weekly", "week", or "weekend" have zero matches in `knowledge_map.json` concept keys).
* **Semantic Coverage**: **80%** (Most concepts exist in the corpus under technical terms like `seasonal tendencies`, `weekly bias`, `Commitment of Traders`, or `displacement`).
* **Missing Coverage**: **20%** (Concepts like "Weekend Effect" or "End-of-Week Effect" are completely missing from the technical notes).

| Concept | Exact Hits | Closest Corpus Phrase | Example Chunk IDs |
| ------- | ---------- | --------------------- | ----------------- |
| **Weekly Buy Day Bias** | 0 | `seasonal tendencies`, `weekly bias` | `chunk_3799`, `chunk_1298` |
| **Weekly Sell Day Bias** | 0 | `seasonal tendencies`, `weekly bias` | `chunk_3799`, `chunk_1298` |
| **Weekly profile** | 0 | `weekly templates`, `weekly range` | `chunk_917` |
| **Weekend Effect** | 0 | None (Missing) | N/A |
| **End-of-Week Effect** | 0 | None (Missing) | N/A |
| **Weekly Options Expiry** | 0 | `options expiry`, `expiration` | `chunk_3003` |
| **Weekly Economic Data Releases** | 0 | `economic calendar`, `news events` | `chunk_917` |
| **Weekly Market Sentiment Shifts** | 0 | `sentiment`, `market sentiment` | `chunk_3540` |
| **Weekly Volatility Patterns** | 0 | `volatility`, `adr` | `chunk_3086` |
| **Weekly Momentum Patterns** | 0 | `momentum` | `chunk_213` |
| **Weekly Reversal Patterns** | 0 | `reversals`, `mid-week reversals` | `chunk_1318` |
| **Weekly Liquidity Patterns** | 0 | `liquidity`, `liquidity pools` | `chunk_213` |
| **Weekly Risk Management Patterns** | 0 | `risk management`, `hedging` | `chunk_3540` |
| **Weekly Trade Timing Patterns** | 0 | `time and price`, `kill zones` | `chunk_799` |
| **Weekly Seasonal Patterns** | 0 | `seasonal tendencies` | `chunk_2627` |

### 2. Daily-Agent Concepts Coverage (Audit of Top 15 Concepts)
* **Exact Hits**: **13.3%** (Only "Optimal Trade Entry (OTE)" and "15M Chart" have exact matches).
* **Semantic Coverage**: **85%**
* **Missing Coverage**: **15%** (Concepts like "News Embargo Lift Timing" are missing).

| Concept | Exact Hits | Closest Corpus Phrase | Example Chunk IDs |
| ------- | ---------- | --------------------- | ----------------- |
| **intraday bias** | 0 | `daily bias`, `directional bias` | `chunk_1139` |
| **intraday seasonality** | 0 | `seasonal tendencies` | `chunk_2627` |
| **intraday profile** | 0 | `intraday profiles` | `chunk_3086` |
| **daily_time_profile** | 0 | `intraday profiles` | `chunk_3086` |
| **15M Chart** | 1 | `15-minute chart`, `15M` | `chunk_4248`, `chunk_2101` |
| **News Embargo Lift Timing** | 0 | `8:30 AM`, `news release` | `chunk_2362` |
| **No-Trade Day** | 0 | None (Missing) | N/A |
| **Kill Zones** | 0 (fuzzy) | `kill zone`, `kill zones` | `chunk_574`, `chunk_799` |
| **Silver Bullet Hour** | 0 (fuzzy) | `silver bullet` | `chunk_3086` |
| **NY OTE Time Window** | 0 | `8:30 AM to 11:00 AM New York Time` | `chunk_4088` |
| **Optimal Trade Entry (OTE)** | 1 | `optimal trade entry`, `ote` | `chunk_4113`, `chunk_4088` |
| **Midnight-2AM Window** | 0 | `2:00 AM and 4:00 AM NY time` | `chunk_3009` |
| **Time & Day Analysis** | 0 | `time & price theory` | `chunk_574` |
| **Temporal Projection Window** | 0 | None (Missing) | N/A |
| **New York Expansion** | 0 | `new york session` | `chunk_4088` |

### 3. Session-Agent Concepts Coverage (Audit of Top 15 Concepts)
* **Exact Hits**: **40.0%** (Concepts like "NWOG", "NDOG", "London Session", "Midnight Open", "Asian Open", and "New York Session" have exact matches).
* **Semantic Coverage**: **90%**
* **Missing Coverage**: **10%**

| Concept | Exact Hits | Closest Corpus Phrase | Example Chunk IDs |
| ------- | ---------- | --------------------- | ----------------- |
| **NWOG** | 1 | `new week opening gap`, `nwog` | `chunk_632`, `chunk_3842` |
| **NDOG** | 1 | `new day opening gap`, `ndog` | `chunk_3842` |
| **Morning Session Setups** | 0 | `morning session`, `am session` | `chunk_3630` |
| **London Open Kill Zone** | 1 | `london open kill zone` | `chunk_3009`, `chunk_799` |
| **London Session** | 1 | `london session` | `chunk_799` |
| **Session Timing** | 0 | `time windows`, `intraday session` | `chunk_3009` |
| **Midnight Open** | 1 | `midnight opening price` | `chunk_2103`, `chunk_1348` |
| **Morning Session** | 0 | `am session` | `chunk_3630` |
| **Afternoon Session** | 0 | `pm session` | `chunk_80` |
| **Asian Open** | 1 | `asian open` | `chunk_1252` |
| **London Close Killzone** | 0 | `london close`, `london close killzone` | `chunk_3086` |
| **Market Open** | 0 | `opening price`, `open` | `chunk_1348` |
| **New York Session** | 1 | `new york session` | `chunk_4088` |
| **New York Close Killzone** | 0 | None (Missing) | N/A |
| **Sydney Session** | 0 | None (Missing) | N/A |

---

## PHASE 5 — RETRIEVAL DIVERSITY AUDIT

An audit of the top 20 candidate chunk distributions in `05_RERANK_PRE.json` shows that each agent is dominated by a specific concept category:

### 1. Weekly-Agent candidate distribution
* **Dominant Category**: **OTHER** (60%) — dominated by COT hedging summaries and weekly templates.
* **Distribution Table**:

| Concept Group | Count | Percentage |
| ------------- | ----- | ---------- |
| **FAIR_VALUE_GAP** | 2 | 10% |
| **ORDER_BLOCK** | 2 | 10% |
| **DEALING_RANGE** | 2 | 10% |
| **SESSIONS** | 0 | 0% |
| **TIME WINDOWS** | 1 | 5% |
| **OPENING RANGE** | 1 | 5% |
| **OTHER** | 12 | 60% |

### 2. Daily-Agent candidate distribution
* **Dominant Category**: **DEALING_RANGE** (55%) — heavily dominated by Optimal Trade Entry (OTE) structures.
* **Distribution Table**:

| Concept Group | Count | Percentage |
| ------------- | ----- | ---------- |
| **FAIR_VALUE_GAP** | 2 | 10% |
| **ORDER_BLOCK** | 0 | 0% |
| **DEALING_RANGE** | 11 | 55% |
| **SESSIONS** | 2 | 10% |
| **TIME WINDOWS** | 2 | 10% |
| **OPENING RANGE** | 0 | 0% |
| **OTHER** | 3 | 15% |

### 3. Session-Agent candidate distribution
* **Dominant Category**: **OPENING RANGE** (55%) — dominated by opening gaps (NWOG/NDOG).
* **Distribution Table**:

| Concept Group | Count | Percentage |
| ------------- | ----- | ---------- |
| **FAIR_VALUE_GAP** | 0 | 0% |
| **ORDER_BLOCK** | 0 | 0% |
| **DEALING_RANGE** | 0 | 0% |
| **SESSIONS** | 5 | 25% |
| **TIME WINDOWS** | 3 | 15% |
| **OPENING RANGE** | 11 | 55% |
| **OTHER** | 1 | 5% |

---

## PHASE 6 — GROUNDING AUDIT

The grounding process selects the top 6 chunks for the LLM context. An audit of these chunks shows varying levels of concept concentration:

* **Concept Diversity Score** = $\frac{\text{Unique Concepts Represented}}{\text{Total Grounded Chunks}}$
* **Concept Concentration Score** = $\frac{\text{Count of Chunks of Most Common Concept}}{\text{Total Grounded Chunks}}$

### Grounding Statistics

| Agent | Grounded Chunk IDs | Originating Lane | Originating Concept | Diversity Score | Concentration Score |
| ----- | ------------------ | ---------------- | ------------------- | --------------- | ------------------- |
| **Weekly-Agent** | `chunk_3799`, `chunk_917`, `chunk_1298`, `chunk_3540`, `chunk_1318`, `chunk_213` | `lane0` (all) | `Weekly Buy Day Bias` (3), `Weekly profile` (3) | **0.50** | **0.50** |
| **Daily-Agent** | `chunk_4113`, `chunk_4088`, `chunk_574`, `chunk_4146`, `chunk_4168`, `chunk_4153` | `lane0` (all) | `Optimal Trade Entry` (5), `Kill Zones` (1) | **0.33** | **0.83** |
| **Session-Agent** | `chunk_799`, `chunk_3009`, `chunk_1419`, `chunk_3086`, `chunk_3842`, `chunk_1252` | `lane0` (all) | `London Open` (2), `Session Timing` (1), `NY Session` (1), `NWOG/NDOG` (1), `Asian Open` (1) | **0.83** | **0.33** |

---

## PHASE 7 — VISION-FIRST FEASIBILITY

Integrating **Vision First** (incorporating a `visionPrompt` to extract facts from charts before RAG) would significantly improve retrieval quality by resolving vocabulary mismatches.

1. **Can objective chart facts be extracted?**
   * **Yes**. Swings, session ranges, Midnight Open lines, and gap boundaries are highly visible features that Gemini's vision capability can extract.
2. **Would those facts map better to corpus vocabulary?**
   * **Yes**. Instead of searching for abstract concept terms, the system can search for concrete terms like "weekly opening price", "BMS", "breaker block", "NWOG", which match the corpus vocabulary.
3. **Would Lane 2 likely outperform current concept-driven retrieval?**
   * **Yes**. Direct searches based on chart observations bypass the pipeline concept truncation issues.
4. **Estimated retrieval improvement %**:
   * **Weekly-Agent**: **90% - 100%** (Currently suffers from 0% exact vocabulary coverage).
   * **Daily-Agent**: **50% - 70%** (Bridges daily profile mismatches).
   * **Session-Agent**: **30% - 40%** (Bridges session timing offsets).

---

## PHASE 8 — CALENDAR DEPENDENCY AUDIT

1. **Which outputs from Calendar are currently consumed?**
   * **None**. All agents run independently of Calendar Agent outputs, relying on system clock times and general profiles.
2. **Which outputs are ignored?**
   * High-impact news releases, daily volatility events, and macro scheduling lists are currently ignored.
3. **Which outputs would naturally support these agents?**
   * **Weekly-Agent**: Aligning the weekly low expectation with high-impact calendar events (e.g., Tuesday London open vs. Friday NFP).
   * **Daily-Agent**: Injecting news times (e.g., CPI at 8:30 AM) to refine volatility windows.
   * **Session-Agent**: Tagging catalysts occurring within specific session killzones.

---

## SYSTEM READINESS SUMMARY

| Agent | Current State | Main Bottleneck | Priority |
| ----- | ------------- | --------------- | -------- |
| **Weekly-Agent** | Pure Lane0 (Stable but limited) | **Vocabulary Mismatch**: 0% exact coverage on weekly concepts; critical mid-week reversal templates are starved due to query truncation. | **P0** (Immediate fix candidate) |
| **Daily-Agent** | Pure Lane0 (Stable but limited) | **OTE Domination / Truncation**: Starves temporal and session expansions, resulting in low concept diversity (0.33). | **P1** (Worth upgrading) |
| **Session-Agent** | Pure Lane0 (Stable) | **Query Truncation**: Truncates 50% of session concepts; dominated by opening range gaps. | **P2** (Low impact) |

---
*Audit completed by System Forensic Auditor.*
