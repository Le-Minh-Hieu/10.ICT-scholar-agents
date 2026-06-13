# SYSTEM ROLE MAP
## Comprehensive Architecture Audit
**Generated:** 2026-06-09  
**Repository:** d:\10. ict-scholar-agents-V1

---

## EXECUTIVE SUMMARY

**Architecture Discovery:** This system does NOT implement traditional agent classes. Instead, it uses a **RAG-based functional orchestration pattern** where "agents" are actually **knowledge retrieval queries** combined with LLM synthesis.

**Critical Finding:** The term "agent" in this codebase refers to **retrieval configurations in JSON pipelines** (data/time_pipeline.json, data/htf_pipeline.json, etc.), NOT executable code agents. The actual execution happens through orchestrators that query vector stores and synthesize results via LLMs.

**System Pattern:**
- Pipeline JSON files define retrieval concepts per "agent"
- Orchestrators execute retrieval queries against vector knowledge base
- LLM synthesizes retrieved knowledge into structured outputs
- No traditional agent classes exist in app/services/

---

## 1. ACTUAL ARCHITECTURE (EVIDENCE-BASED)

### 1.1 Core Pattern Discovery

**What This System Actually Is:**
- **NOT**: Traditional multi-agent system with agent classes
- **IS**: RAG-powered pipeline orchestrator with concept-based retrieval

**Evidence:**
1. `data/agents.json` - 83 entries defining retrieval patterns, NOT code agents
2. `data/time_pipeline.json` - Concept lists for macro/quarterly/monthly/weekly/daily/session
3. `data/htf_pipeline.json` - Concept lists for macro/structure/liquidity/pd_array/bias
4. `data/itf_pipeline.json` - Concept lists for structure/liquidity/pd_array/setup
5. `data/ltf_pipeline.json` - Concept lists for structure/liquidity/pd_array/setup
6. `app/services/` - Empty directory
7. `app/orchestrator/` - Contains only `getActiveWindow.ts` (macro calendar helper)

### 1.2 What "Agents" Actually Are

**Agent Definition in This System:**
```
"agent" = {
  agent_name: string,
  type: "pattern" | "behavior" | "concept",
  layer: "HTF" | "ITF" | "LTF",
  role: string,
  query_templates: string[],
  focus: string[],
  signal: string
}
```

**Examples from data/agents.json:**
- `bearish-breaker` - Pattern detection query template
- `htf-bias` - Concept extraction query
- `smart-money-mechanics` - Behavior pattern query

**These are NOT executable code.** They are retrieval configurations consumed by orchestrators.

---

## 2. ACTUAL OBJECT FLOW

### 2.1 Input Objects

#### System Input (runSystem)
- **Producer:** External caller (test files, API endpoints)
- **Structure:**
  ```typescript
  {
    eurusd: {
      d: string,   // Daily chart image path
      w?: string,  // Weekly chart image path  
      m?: string,  // Monthly chart image path
      h4: string,  // 4-hour chart image path
      h1: string,  // 1-hour chart image path
      m15: string, // 15-minute chart image path
      m5: string,  // 5-minute chart image path
      m1: string   // 1-minute chart image path
    },
    macro_events?: any[]
  }
  ```
- **Consumers:** HTF/ITF/LTF orchestrators
- **Lifecycle:** Created per system execution

#### HydrationContext
- **Producer:** Staging event store + macro context helpers
- **Fields:**
  ```typescript
  {
    weekly_profile?: any,
    daily_profile?: any,
    event_windows?: any[]
  }
  ```
- **Consumers:** All orchestrators
- **Purpose:** Inject temporal and news context into analysis
- **Lifecycle:** Built at start of runSystem, passed to all layers

### 2.2 Orchestrator Outputs (Canonical Schema)

#### HTFOrchestratorOutput
- **Producer:** `runHTFOrchestrator()`
- **Schema:** Defined in `shared/contracts/canonical.ts`
- **Contains:**
  - HTFStructureOutput (facts from vision analysis)
  - HTFLiquidityOutput (liquidity sweep data)
  - HTFPDArrayOutput (premium/discount status)
  - HTFMacroOutput (macro facts)
  - HTFBiasOutput (bullish/bearish/neutral)
- **Consumers:** ITF orchestrator, LTF orchestrator, Master orchestrator
- **Persistence:** Saved via `StorageService.persistAnalysisOutput`

#### ITFOrchestratorOutput
- **Producer:** `runITFOrchestrator()`
- **Schema:** Defined in `shared/contracts/canonical.ts`
- **Contains:**
  - ITFStructureOutput (intraday structure)
  - ITFLiquidityOutput (sweep patterns)
  - ITFPDArrayOutput (entry zones)
  - ITFSetupOutput (setup identification)
- **Consumers:** LTF orchestrator, Master orchestrator
- **Persistence:** Saved via `StorageService.persistAnalysisOutput`

#### LTFOrchestratorOutput
- **Producer:** `runLTFOrchestrator()`
- **Schema:** Defined in `shared/contracts/canonical.ts`
- **Contains:**
  - LTFStructureOutput (micro structure)
  - LTFLiquidityOutput (immediate targets)
  - LTFPDArrayOutput (precise entry zones)
  - LTFTriggerOutput (execution trigger: execute: boolean)
- **Consumers:** Master orchestrator
- **Persistence:** Saved via `StorageService.persistAnalysisOutput`

#### MasterOutput
- **Producer:** `runMasterOrchestrator()`
- **Schema:** Defined in `shared/contracts/canonical.ts`
- **Contains:**
  - Consolidated decision from all layers
  - PMSO snapshot
  - Temporal state
  - Scenario context
  - Final confidence metrics
- **Consumers:** External systems, storage
- **Persistence:** Saved as master decision artifact

### 2.3 Time Layer Objects

#### TimeOrchestratorOutput
- **Producer:** `runTimeOrchestrator()`
- **Schema:** Defined in `shared/contracts/time/time-orchestrator-output.ts`
- **Fields:**
  ```typescript
  {
    trading_window: "active" | "inactive",
    // Additional timing context
  }
  ```
- **Consumers:** Master orchestrator
- **Purpose:** Trading window and timing bias

---

## 3. ACTUAL AGENT MAP (RETRIEVAL CONFIGURATIONS)

### 3.1 Time Layer "Agents" (Concept Sets)

From `data/time_pipeline.json`:

#### macro_time
- **Type:** Concept retrieval set
- **Concepts:** 61 macro time concepts
- **Examples:** "Seasonal Tendencies", "Economic Calendar", "Macro Time Cycles"
- **Purpose:** RAG queries for macro temporal patterns
- **Consumer:** Time orchestrator retrieval phase

#### quarterly_time
- **Type:** Concept retrieval set
- **Concepts:** 19 quarterly concepts
- **Examples:** "Quarterly Bias", "End-of-Quarter Effect", "NFP Reversal"
- **Purpose:** Quarterly pattern retrieval
- **Consumer:** Time orchestrator

#### monthly_time
- **Type:** Concept retrieval set  
- **Concepts:** 17 monthly concepts
- **Examples:** "Monthly Bias", "Turn-of-Month Effect"
- **Purpose:** Monthly pattern retrieval
- **Consumer:** Time orchestrator

#### weekly_time
- **Type:** Concept retrieval set
- **Concepts:** 64 weekly concepts
- **Examples:** "Weekly Buy Day Bias", "Weekend Effect"
- **Purpose:** Weekly pattern retrieval
- **Consumer:** Time orchestrator

#### daily_time
- **Type:** Concept retrieval set
- **Concepts:** 70 daily concepts
- **Examples:** "intraday bias", "Kill Zones", "Silver Bullet Hour"
- **Purpose:** Daily pattern retrieval
- **Consumer:** Time orchestrator

#### session_time
- **Type:** Concept retrieval set
- **Concepts:** 28 session concepts
- **Examples:** "London Open Kill Zone", "Asian Open", "Silver Bullet Hour"
- **Purpose:** Session timing retrieval
- **Consumer:** Time orchestrator

### 3.2 HTF Layer "Agents" (Concept Sets)

From `data/htf_pipeline.json`:

#### htf.macro
- **Type:** Concept retrieval set
- **Concepts:** 38 macro concepts
- **Examples:** "Dollar Index", "Interest Rate Differentials", "Intermarket Analysis"
- **Purpose:** Macro fundamental retrieval
- **Consumer:** HTF orchestrator

#### htf.structure
- **Type:** Concept retrieval set
- **Concepts:** 106 structure concepts
- **Examples:** "HTF Bias", "Market Structure", "Smart Money", "Algorithmic Behavior"
- **Purpose:** HTF structural analysis retrieval
- **Consumer:** HTF orchestrator

#### htf.liquidity
- **Type:** Concept retrieval set
- **Concepts:** 15 liquidity concepts
- **Examples:** "Liquidity Engineering", "Buy-side Liquidity", "Stop Hunting Mechanism"
- **Purpose:** HTF liquidity pattern retrieval
- **Consumer:** HTF orchestrator

#### htf.pd_array
- **Type:** Concept retrieval set
- **Concepts:** 11 PD array concepts
- **Examples:** "HTF PD Arrays", "Order Block", "Fair Value Gap", "Premium Market"
- **Purpose:** HTF premium/discount retrieval
- **Consumer:** HTF orchestrator

#### htf.bias
- **Type:** Concept retrieval set
- **Concepts:** 36 bias concepts
- **Depends on:** macro, structure, liquidity, pd_array
- **Examples:** "Morning Bias", "Risk Management", "Trading Plan"
- **Purpose:** HTF bias synthesis retrieval
- **Consumer:** HTF orchestrator (final synthesis step)

### 3.3 ITF Layer "Agents" (Concept Sets)

From `data/itf_pipeline.json`:

#### itf.structure
- **Type:** Concept retrieval set
- **Concepts:** 17 structure concepts
- **Examples:** "Market Structure Shift", "Displacement", "Fractal Price Action"
- **Purpose:** ITF structure pattern retrieval
- **Consumer:** ITF orchestrator

#### itf.liquidity
- **Type:** Concept retrieval set
- **Concepts:** 17 liquidity concepts
- **Examples:** "Liquidity Sweep", "Stop Hunt", "Buy Side Liquidity Offset"
- **Purpose:** ITF liquidity sweep retrieval
- **Consumer:** ITF orchestrator

#### itf.pd_array
- **Type:** Concept retrieval set
- **Concepts:** 33 PD array concepts
- **Examples:** "Fair Value Gap", "Order Block & OTE", "Breaker", "Volume Imbalance"
- **Purpose:** ITF PD array retrieval
- **Consumer:** ITF orchestrator

#### itf.setup
- **Type:** Concept retrieval set
- **Concepts:** 77 setup concepts
- **Examples:** "Trade Framing", "London Open Kill Zone", "Judas Swing", "SMT Divergence"
- **Purpose:** ITF setup pattern retrieval
- **Consumer:** ITF orchestrator

### 3.4 LTF Layer "Agents" (Concept Sets)

From `data/ltf_pipeline.json`:

#### ltf.structure
- **Type:** Concept retrieval set
- **Concepts:** 12 structure concepts
- **Examples:** "OTE Pattern", "SMT Divergence", "Failure Swing"
- **Purpose:** LTF micro structure retrieval
- **Consumer:** LTF orchestrator

#### ltf.liquidity
- **Type:** Concept retrieval set
- **Concepts:** 10 liquidity concepts
- **Examples:** "Turtle Soup", "Stop Hunt", "Judas Swing", "Bearish Judas Swing"
- **Purpose:** LTF liquidity sweep retrieval
- **Consumer:** LTF orchestrator

#### ltf.pd_array
- **Type:** Concept retrieval set
- **Concepts:** 13 PD array concepts
- **Examples:** "Fair Value Gap", "Mean Threshold", "Micro Order Block Entry"
- **Purpose:** LTF precise entry zone retrieval
- **Consumer:** LTF orchestrator

#### ltf.setup
- **Type:** Concept retrieval set
- **Concepts:** 50 setup/trigger concepts
- **Examples:** "Silver Bullet", "Kill Zones", "Stop Loss Placement", "One Shot One Kill"
- **Purpose:** LTF trigger and execution retrieval
- **Consumer:** LTF orchestrator

---

## 4. RESPONSIBILITY MAP (ACTUAL SYSTEM)

### 4.1 Orchestrator Responsibilities

#### HTF Orchestrator
- **File:** `core/3.query/orchestrators/htf-orchestrator.ts`
- **Primary Responsibility:**
  1. Execute RAG queries using HTF concept sets
  2. Retrieve relevant knowledge chunks from vector store
  3. Pass retrieved context + images to LLM
  4. Synthesize HTF analysis (structure, liquidity, PD array, macro, bias)
  5. Validate and structure output according to canonical schema
  6. Persist HTF output artifacts

- **Knowledge Created:**
  - HTF structural bias
  - HTF liquidity narrative
  - HTF macro thesis
  - HTF premium/discount assessment
  - HTF directional bias

- **Does NOT:**
  - Execute domain-specific algorithms
  - Contain hard-coded trading logic
  - Use traditional agent reasoning

#### ITF Orchestrator  
- **File:** `core/3.query/orchestrators/itf-orchestrator.ts`
- **Primary Responsibility:**
  1. Execute RAG queries using ITF concept sets
  2. Retrieve intraday pattern knowledge
  3. Incorporate HTF context as parent thesis
  4. Synthesize ITF analysis (structure, liquidity, PD array, setup)
  5. Validate ITF/HTF alignment
  6. Persist ITF output artifacts

- **Knowledge Created:**
  - ITF intraday structure
  - ITF liquidity sweep patterns
  - ITF entry zone identification
  - ITF setup classification

- **Does NOT:**
  - Generate triggers (that's LTF's role)
  - Override HTF thesis

#### LTF Orchestrator
- **File:** `core/3.query/orchestrators/ltf-orchestrator.ts`
- **Primary Responsibility:**
  1. Execute RAG queries using LTF concept sets
  2. Retrieve micro-structure and trigger patterns
  3. Incorporate ITF + HTF context
  4. Synthesize LTF analysis (structure, liquidity, PD array, trigger)
  5. Generate execution trigger (execute: boolean)
  6. Persist LTF output artifacts

- **Knowledge Created:**
  - LTF micro structure
  - LTF immediate liquidity targets
  - LTF precise entry zones
  - **Execution trigger decision**

- **Does NOT:**
  - Make final system decision (that's Master's role)
  - Execute trades directly

#### Master Orchestrator
- **File:** `core/3.query/orchestrators/master-orchestrator.ts`
- **Primary Responsibility:**
  1. Consolidate HTF + ITF + LTF outputs
  2. Run scenario engine
  3. Run temporal engine  
  4. Apply news modifiers
  5. Reconcile PMSO (Persistent Multi-Source Observations)
  6. Generate final master decision
  7. Persist complete analysis artifacts

- **Knowledge Created:**
  - Final execution decision
  - PMSO snapshot
  - Temporal state
  - Scenario context
  - Master confidence score

- **Does NOT:**
  - Retrieve new knowledge (uses orchestrator outputs)
  - Execute RAG queries directly

#### Time Orchestrator
- **File:** Referenced in `run-system.ts`
- **Primary Responsibility:**
  1. Execute RAG queries using time concept sets
  2. Retrieve temporal pattern knowledge
  3. Determine trading window status
  4. Provide timing bias

- **Knowledge Created:**
  - Trading window (active/inactive)
  - Timing bias
  - Session context

### 4.2 Supporting Component Responsibilities

#### Retrieval Core
- **File:** `core/3.query/retrieval-core.ts` (inferred)
- **Responsibility:**
  - Execute vector similarity searches
  - Rank and rerank retrieved chunks
  - Return grounded knowledge with citations

#### Prompt Builder
- **File:** `core/3.query/prompt-builder.ts` (inferred)
- **Responsibility:**
  - Construct LLM prompts from retrieved knowledge
  - Inject schemas and output format instructions
  - Include image analysis requests

#### Storage Service
- **File:** Referenced in orchestrators
- **Responsibility:**
  - Persist analysis artifacts
  - Save capture artifacts
  - Manage output directory structure

---

## 5. KNOWLEDGE FLOW MAP

### 5.1 End-to-End Flow

```
Market Data (Images + Events)
        ↓
[Input Validation & Hydration]
        ↓
Time Orchestrator ──→ Trading Window Context
        ↓
HTF Orchestrator
  → Query: htf.macro concepts
  → Query: htf.structure concepts  
  → Query: htf.liquidity concepts
  → Query: htf.pd_array concepts
  → Query: htf.bias concepts (synthesis)
  → LLM Synthesis
  → HTF Output (structure, liquidity, PD, macro, bias)
        ↓
ITF Orchestrator (receives HTF context)
  → Query: itf.structure concepts
  → Query: itf.liquidity concepts
  → Query: itf.pd_array concepts
  → Query: itf.setup concepts
  → LLM Synthesis (with HTF parent thesis)
  → ITF Output (structure, liquidity, PD, setup)
        ↓
LTF Orchestrator (receives ITF + HTF context)
  → Query: ltf.structure concepts
  → Query: ltf.liquidity concepts
  → Query: ltf.pd_array concepts
  → Query: ltf.setup concepts
  → LLM Synthesis (with parent theses)
  → LTF Output (structure, liquidity, PD, **trigger**)
        ↓
Master Orchestrator
  → Consolidate HTF + ITF + LTF
  → Run Scenario Engine
  → Run Temporal Engine
  → Apply News Modifiers
  → Reconcile PMSO
  → Generate Master Decision
        ↓
Persist All Artifacts
        ↓
Return System Result
```

### 5.2 Knowledge Flow Per Stage

#### Stage 1: Time Layer
- **Input:** Market timing data, calendar events
- **Retrieval:** Temporal pattern knowledge (seasonal, session, daily cycles)
- **Transformation:** Raw timing → Trading window + timing bias
- **Output:** Trading window context

#### Stage 2: HTF Layer
- **Input:** Daily/Weekly/Monthly chart images, time context
- **Retrieval:** HTF concepts (macro, structure, liquidity, PD arrays)
- **Transformation:** Images + macro knowledge → HTF thesis
- **Output:** HTF structural bias, liquidity narrative, macro thesis

#### Stage 3: ITF Layer
- **Input:** H4/H1/M15 chart images, HTF thesis
- **Retrieval:** ITF concepts (intraday patterns, setups)
- **Transformation:** Intraday images + HTF context → ITF setup
- **Output:** ITF intraday analysis, setup identification

#### Stage 4: LTF Layer
- **Input:** M15/M5/M1 chart images, ITF + HTF theses
- **Retrieval:** LTF concepts (micro patterns, triggers)
- **Transformation:** Micro images + parent theses → Execution decision
- **Output:** LTF trigger (execute: boolean)

#### Stage 5: Master Layer
- **Input:** All orchestrator outputs, news, scenarios
- **Retrieval:** None (uses consolidated knowledge)
- **Transformation:** Multi-layer synthesis → Final decision
- **Output:** Master decision with PMSO snapshot

---

## 6. DRIFT ANALYSIS

### 6.1 Original Intent vs Current Reality

#### ORIGINAL INTENT (Inferred from Names)
**Expected:** Traditional multi-agent system
- SessionAgent → DailyAgent → WeeklyAgent → MonthlyAgent → QuarterlyAgent → MacroTimeAgent
- HTF Agents (Structure, Liquidity, PDArray, Macro) as executable classes
- ITF Agents (Structure, Liquidity, PDArray, Setup) as executable classes
- LTF Agents (Structure, Liquidity, PDArray, Trigger) as executable classes
- Each agent with domain logic and reasoning

#### CURRENT REALITY (Evidence-Based)
**Actual:** RAG-powered orchestration system
- No agent classes exist
- "Agents" are JSON retrieval configurations
- Orchestrators execute RAG queries and LLM synthesis
- Knowledge retrieved from vector store, not generated algorithmically
- Single-pass synthesis per layer, not iterative agent communication

### 6.2 Critical Drift Points

#### Drift 1: Agent Definition
- **Original Concept:** Autonomous agents with domain logic
- **Current Reality:** Retrieval concept sets in JSON
- **Impact:** Terminology mismatch causes confusion
- **Evidence:** `app/services/` directory is empty, no agent classes

#### Drift 2: Knowledge Source
- **Original Concept:** Agents generate knowledge through algorithms
- **Current Reality:** Knowledge retrieved from pre-indexed vectors
- **Impact:** System is retrieval-dependent, not algorithmic
- **Evidence:** All orchestrators call retrieval service before LLM

#### Drift 3: Processing Model
- **Original Concept:** Agent-to-agent communication and negotiation
- **Current Reality:** Linear orchestrator pipeline with parent-child context passing
- **Impact:** No iterative refinement, single-pass only
- **Evidence:** Orchestrators run sequentially: HTF → ITF → LTF → Master

#### Drift 4: Responsibility Boundaries
- **Original Concept:** Each agent owns specific domain knowledge
- **Current Reality:** Orchestrators own synthesis, "agents" are just query templates
- **Impact:** Unclear where logic lives (retrieval vs synthesis)
- **Evidence:** Logic is in orchestrators, not in agent files

### 6.3 Object Flow Drift

#### Expected Flow
```
SessionAgent.execute() → SessionContext
DailyAgent.execute(SessionContext) → DailyContext
HTFStructureAgent.execute() → HTFStructureOutput
```

#### Actual Flow
```
runHTFOrchestrator(input, hydration)
  → retrieveKnowledge(htf.structure concepts)
  → callLLM(images + retrieved_chunks)
  → HTFStructureOutput
```

### 6.4 Responsibility Overlap

#### Orchestrators Do Everything
- Retrieval query execution
- Context assembly
- LLM prompting
- Response validation
- Output structuring
- Artifact persistence

#### "Agents" Do Nothing
- Only exist as JSON configurations
- No executable code
- No domain logic
- No reasoning capability

### 6.5 Responsibility Gaps

#### No Traditional Agent Behaviors
- No goal-driven planning
- No environment interaction
- No action selection
- No learning or adaptation
- No inter-agent communication
- No negotiation or coordination

#### What Exists Instead
- Retrieval-augmented generation
- LLM-based synthesis
- Hierarchical context passing
- Schema-driven validation

---

## 7. CRITICAL FINDINGS

### 7.1 Architecture Mismatch

**Finding:** System architecture does not match its naming conventions.

**Evidence:**
1. Directory structure suggests agent-based architecture (app/services/, shared/contracts/htf-agents.ts)
2. Actual implementation is orchestrator-based RAG system
3. No agent classes exist
4. All "agents" are JSON retrieval configurations

**Impact:**
- Developer confusion
- Documentation mismatch
- Maintenance difficulty
- Onboarding friction

### 7.2 Single Responsibility Violation

**Finding:** Orchestrators violate single responsibility principle.

**Evidence:**
- HTF orchestrator handles: retrieval, prompting, LLM calls, validation, persistence
- No separation between retrieval logic and synthesis logic
- Orchestrators are 200+ line functions doing multiple jobs

**Impact:**
- Hard to test individual components
- Difficult to modify retrieval strategy without touching LLM logic
- Coupling between storage and execution

### 7.3 Knowledge Flow Opacity

**Finding:** Knowledge transformation path is unclear.

**Evidence:**
- Retrieved chunks → LLM prompt (how?)
- LLM response → Structured output (validation where?)
- Orchestrator outputs → PMSO (reconciliation logic where?)

**Impact:**
- Debugging difficulty
- Observability gaps
- Trust issues (black box transformations)

### 7.4 Retrieval Dependency Risk

**Finding:** System is critically dependent on vector store quality.

**Evidence:**
- All knowledge comes from retrieval
- No fallback algorithms
- No domain logic in code
- If retrieval fails, system has no knowledge

**Impact:**
- Vector store is single point of failure
- Knowledge quality = retrieval quality
- No graceful degradation

### 7.5 Schema Drift Potential

**Finding:** Multiple schema definitions for same concepts across files.

**Evidence:**
- `shared/contracts/htf/structure.ts` - HTFStructureInput/Output
- `shared/contracts/canonical.ts` - HTFOrchestratorOutput
- `data/htf_pipeline.json` - concept lists
- No single source of truth

**Impact:**
- Schema inconsistencies
- Validation failures
- Integration issues

---

## 8. SYSTEM ROLE MAP SUMMARY

### 8.1 Actual System Roles

| Component | Role | Responsibility |
|-----------|------|----------------|
| **Pipeline JSONs** | Knowledge Maps | Define retrieval concept sets per domain |
| **Retrieval Core** | Knowledge Retriever | Execute vector searches, return grounded chunks |
| **Orchestrators** | Synthesis Engines | Retrieve + prompt + validate + persist |
| **LLM Calls** | Knowledge Synthesizers | Transform retrieval + images → structured insights |
| **Master Orchestrator** | Decision Consolidator | Combine all layers → final decision |
| **Storage Service** | Persistence Layer | Save artifacts for replay and analysis |

### 8.2 What This System Is NOT

- ❌ Multi-agent system with agent classes
- ❌ Algorithmic trading logic system  
- ❌ Rule-based expert system
- ❌ Agent communication framework
- ❌ Autonomous agent network

### 8.3 What This System IS

- ✅ RAG-powered analysis pipeline
- ✅ Hierarchical orchestrator system
- ✅ LLM-based synthesis framework
- ✅ Knowledge retrieval + vision analysis hybrid
- ✅ Multi-timeframe decision consolidator

---

## 9. RECOMMENDATIONS (AUDIT ONLY - NOT IMPLEMENTATION)

### 9.1 Terminology Alignment

**Current Mismatch:**
- Code uses "agent" for JSON retrieval configs
- Architecture suggests agent-based system
- No actual agents exist

**Recommendation:**
- Rename "agents" to "retrieval_profiles" or "concept_sets"
- Rename orchestrators to "synthesizers" or "analyzers"
- Update documentation to reflect RAG architecture

### 9.2 Responsibility Clarification

**Current Confusion:**
- Orchestrators do too much
- No clear separation of concerns

**Recommendation:**
- Extract retrieval logic to dedicated service
- Extract LLM prompting to prompt service
- Extract validation to validator service
- Keep orchestrators for coordination only

### 9.3 Schema Consolidation

**Current Issue:**
- Multiple schema definitions
- Inconsistent typing

**Recommendation:**
- Single source of truth for each domain schema
- Generate types from canonical schemas
- Validate at boundaries

### 9.4 Knowledge Flow Visibility

**Current Problem:**
- Black box transformations
- No intermediate artifact visibility

**Recommendation:**
- Log retrieval results
- Log prompt construction
- Log LLM responses (pre-validation)
- Log validation steps
- Create knowledge flow trace artifacts

---

## 10. CONCLUSION

This system is **NOT** what its directory structure suggests. It is a sophisticated RAG-powered orchestration system that uses retrieval + LLM synthesis to generate trading analysis, not a traditional multi-agent system.

The "agents" referenced throughout the codebase are **retrieval configuration sets**, not executable agent classes. The actual intelligence lives in:
1. Vector store knowledge quality
2. Retrieval algorithms
3. LLM synthesis capabilities
4. Orchestrator consolidation logic

**No responsibility drift occurred** because there were never traditional agents to begin with. The drift is in **naming and documentation**, not in actual system behavior.

The system functions as designed - as a RAG pipeline - but is documented and structured as if it were an agent system.

---

**END OF AUDIT**

*Generated from comprehensive codebase analysis including: contract schemas, pipeline JSONs, orchestrator implementations, and directory structure inspection.*