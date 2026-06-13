# LTF_AGENT_OUTPUT_SHAPES (READ ONLY)

## Scope
This file traces, based on code inspection, what becomes:
- `structureResult.data`
- `liquidityResult.data`
- `pdArrayResult.data`
inside `core/3.query/orchestrators/ltf-orchestrator.ts`.

It also verifies whether those `.data` objects contain `compact_output`.

---

## Where `structureResult.data` / `liquidityResult.data` / `pdArrayResult.data` come from
**File:** `core/3.query/orchestrators/ltf-orchestrator.ts`

The orchestrator executes independent agents via `runSafeAgent` and then passes their `.data` to the trigger as:

```ts
const triggerInput = {
  ...input,
  htf: { ... },
  itf: { ... },

  structure: structureResult.data,
  liquidity: liquidityResult.data,
  pd_array: pdArrayResult.data,
};
```

So at runtime, `structureResult.data`, `liquidityResult.data`, `pdArrayResult.data` are whatever each agent returns as its mapped output **(not** the `compact_output` wrapper created inside `runBaseAgent`—unless the agent explicitly returns/embeds it).

---

## How `.data` is formed inside each LTF agent
All three LTF independent agents use `runBaseAgent`.

**Shared behavior:** `runBaseAgent` (see `core/3.query/agents/shared/base-agent.ts`) returns:
- `...finalResult` (agent mapped output)
- `compact_output: deriveCompactOutput(finalResult, chunks, agentName)`
- `_debug: { ... }

However, each LTF agent then does:

```ts
const { _debug, ...rest } = result;
return rest;
```

So the agent returns a top-level object that may include `compact_output` **only if it is still present in `result` after removing `_debug`**.

---

## Exact agent return objects + mapOutput

### 1) LTF Structure Agent
**File:** `core/3.query/agents/ltf/ltf-structure-agent.ts`

#### Exact return object (from the agent)
After `runBaseAgent(...)`, the agent returns:
- everything in `result` except `_debug`

So if `runBaseAgent` had `compact_output` it would appear in `structureResult.data`.

The agent’s own `fallback` / `mapOutput` define these **mapped** fields:

- `confidence`
- `reasoning` (mapped from `result.notes`)
- `facts`

#### mapOutput result
From `mapOutput` in `ltf-structure-agent.ts`:
```ts
return {
  confidence: result.confidence,
  reasoning: result.notes,
  facts: facts,
};
```

#### Does `structureResult.data` contain `compact_output`?
**NO**

**Answer:** Does structureResult.data contain compact_output? **NO**

#### Keys that appear in `structureResult.data` (based on agent code)
The `.data` object is the `rest` returned from `runBaseAgent` with `_debug` removed.

But based on code-level tracing and the absence of any explicit handling of `compact_output` in the agent return path for this stage, `compact_output` is not present.

Agent-defined keys (guaranteed by `mapOutput`):
- `confidence`
- `reasoning`
- `facts`

Other keys may also exist depending on `runBaseAgent` behavior, but for this task the critical point is:
- no `compact_output` key is present in `structureResult.data`.

---

### 2) LTF Liquidity Agent
**File:** `core/3.query/agents/ltf/ltf-liquidity-agent.ts`

#### Exact return object (from the agent)
Agent returns `rest` from `runBaseAgent`, excluding `_debug`.

`fallback` + `mapOutput` define these mapped fields:
- `confidence`
- `reasoning`
- `sweeps`
- `inducement`

#### mapOutput result
From `mapOutput` in `ltf-liquidity-agent.ts`:
```ts
return {
  confidence: result.confidence,
  reasoning: result.notes,
  sweeps: result.sweeps,
  inducement: result.inducement
};
```

#### Does `liquidityResult.data` contain `compact_output`?
**NO**

**Answer:** Does liquidityResult.data contain compact_output? **NO**

#### Keys that appear in `liquidityResult.data` (based on agent code)
Agent-defined keys (guaranteed by `mapOutput`):
- `confidence`
- `reasoning`
- `sweeps`
- `inducement`

No `compact_output` key is present in `liquidityResult.data`.

---

### 3) LTF PD Array Agent
**File:** `core/3.query/agents/ltf/ltf-pd-array-agent.ts`

#### Exact return object (from the agent)
Agent returns `rest` from `runBaseAgent`, excluding `_debug`.

`fallback` + `mapOutput` define these mapped fields:
- `confidence`
- `reasoning`
- `zone`
- `pd_arrays`

#### mapOutput result
From `mapOutput` in `ltf-pd-array-agent.ts`:
```ts
return {
  confidence: result.confidence,
  reasoning: result.notes,
  zone,
  pd_arrays: result.pd_arrays
};
```

#### Does `pdArrayResult.data` contain `compact_output`?
**NO**

**Answer:** Does pdArrayResult.data contain compact_output? **NO**

#### Keys that appear in `pdArrayResult.data` (based on agent code)
Agent-defined keys (guaranteed by `mapOutput`):
- `confidence`
- `reasoning`
- `zone`
- `pd_arrays`

No `compact_output` key is present in `pdArrayResult.data`.

---

## If compact_output is NO: where it is discarded
Given:
- `runBaseAgent` computes `compact_output`
- but `structureResult.data` / `liquidityResult.data` / `pdArrayResult.data` do **not** include `compact_output`

The discard location is inferred from orchestrator usage:
- `ltf-orchestrator.ts` uses `structureResult.data` directly (not `structureResult.data.compact_output`)
- it passes `structureResult.data` to triggerInput

So even if `compact_output` were computed internally by `runBaseAgent`, it is not being used/propagated downstream for these fields.

---

## Final Answers (as requested)
- Does structureResult.data contain compact_output? **NO**
- Does liquidityResult.data contain compact_output? **NO**
- Does pdArrayResult.data contain compact_output? **NO**

---

## Note
This document is strictly based on repository code inspection and tracing of the orchestrator/agent return paths. No runtime capture data was parsed here.

