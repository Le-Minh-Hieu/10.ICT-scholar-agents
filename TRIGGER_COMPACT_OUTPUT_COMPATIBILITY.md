# TRIGGER_COMPACT_OUTPUT_COMPATIBILITY (READ ONLY, NO IMPLEMENTATION)

## Goal
Determine whether LTF Trigger can safely consume:

- `sanitizeForOrchestration(structureResult.data)`
- `sanitizeForOrchestration(liquidityResult.data)`
- `sanitizeForOrchestration(pdArrayResult.data)`

instead of:

- `structureResult.data`
- `liquidityResult.data`
- `pdArrayResult.data`

## Background (code facts)

### 1) What `sanitizeForOrchestration()` does
**File:** `core/3.query/agents/shared/base-agent.ts`

- If the passed object has `obj.compact_output`, `sanitizeForOrchestration(obj)` returns `sanitizeForOrchestration(obj.compact_output)`.
- Otherwise it recursively removes internal/debug keys (e.g. `_debug`, `_raw`, etc.) and keeps other fields.

### 2) LTF independent agents `.data` do NOT include `compact_output`
**File:** `core/3.query/orchestrators/ltf-orchestrator.ts` (usage)

It passes `structureResult.data`, `liquidityResult.data`, `pdArrayResult.data` directly into trigger.

**Agent return behavior (common):**
Each LTF agent does:

```ts
const { _debug, ...rest } = result;
return rest;
```

Therefore, unless `compact_output` is part of `rest` (it is not in the return object as used for `.data`), `structureResult.data` does not contain `compact_output`.

**This repository also shows:**
No explicit `compact_output` key handling inside the LTF mapped outputs.

## Step 1 — Trigger agent field access audit
**File:** `core/3.query/agents/ltf/ltf-trigger-agent.ts`

Trigger accesses input fields as follows:

### A) Explicit property access
- None for `input.structure`, `input.liquidity`, `input.pd_array`.
  - Trigger checks only presence:
    - `if (!input.structure) throw ...`
    - `if (!input.liquidity) throw ...`
    - `if (!input.pd_array) throw ...`

### B) Optional chaining access
- None on `input.structure.*`, `input.liquidity.*`, `input.pd_array.*`.

### C) Only JSON.stringify whole object
YES.
The trigger prompt constraints contain:

- `
