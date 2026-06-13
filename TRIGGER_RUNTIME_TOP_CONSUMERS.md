# TRIGGER_RUNTIME_TOP_CONSUMERS (READ ONLY)

Source inspected: `core/3.query/orchestrators/ltf-orchestrator.ts` and the runtime path that builds `triggerInput`.

## Where `triggerInput` is created (in runtime code)
In `runLTFOrchestrator(...)`:

```ts
const triggerInput = {
  ...input,

  htf: sanitizeForOrchestration(input.htf),
  itf: sanitizeForOrchestration(input.itf),

  structure: structureResult.data,
  liquidity: liquidityResult.data,
  pd_array: pdArrayResult.data,
};

const triggerResult = await runSafeAgent(
  "ltfTriggerAgent",
  () => (ltfTriggerAgent as any)(triggerInput, {...})
);
```

So the payload that reaches `ltfTriggerAgent(triggerInput, ...)` is `triggerInput` above.

`sanitizeForOrchestration` is defined in `core/3.query/agents/shared/base-agent.ts` and removes certain keys (notably `_debug`, `_raw`, and context objects), but preserves everything else.

## How to read the “2.4M payload” question
- `original_payload_size = 2419479` was reported as coming from **LTF-Trigger-Agent** for its input payload.
- The only runtime fields that are *directly* passed into LTF-Trigger-Agent are the keys of `triggerInput`.
- In this code path, the largest risk fields are those that contain:
  - (a) the sanitized `htf` / `itf` structures
  - (b) the upstream agent outputs: `structure`, `liquidity`, `pd_array`
- Additionally, note: `ltfTriggerAgent`’s `runBaseAgent` builds an LLM prompt that includes `constraints` containing large `JSON.stringify(...)` fragments of `input.htf` and `input.itf` and also of `input.structure`, `input.liquidity`, `input.pd_array`.

Therefore, the fields most likely responsible for >90% of the payload size are the ones that get stringified into the trigger prompt: **`input.htf` and `input.itf`** and the three upstream outputs **`input.structure` / `input.liquidity` / `input.pd_array`**.

---

## triggerInput.htf
### Exact shape (from runtime code + schema)
`triggerInput.htf` comes from:

```ts
htf: sanitizeForOrchestration(input.htf)
```

So its runtime shape is whatever is present on `input.htf`, with keys filtered out by `sanitizeForOrchestration`.

From `shared/contracts/ltf/trigger.ts` (`LTFTriggerInput.htf`), the *required* fields are:

- `htf_bias`
- `next_candle_bias`
- `confidence`
- `reasoning`

and optional (if upstream provides them):

- `structure_state?`
- `macro_state?`
- `liquidity_state?`
- `pd_array_state?`

### Field list with source/type/size-risk
Because `sanitizeForOrchestration` removes these keys:
- `_debug`, `_raw`, `full_output`, `full_output_snapshot`
- `hydration_context`, `hydrationContext`
- `pmso_context`, `parent_thesis`
- `relational_context`, `scenario_context`, `minimal_context`

…the surviving shape is typically the “state” objects plus the narrative strings.

Below are the likely surviving fields for `triggerInput.htf` as passed to LTF-Trigger-Agent.

1. **`htf_bias`**
   - **source:** `input.htf.htf_bias` (propagated from HTF orchestration)
   - **type:** string enum-like (`"bullish" | "bearish"`) 
   - **size risk:** **LOW**

2. **`next_candle_bias`**
   - **source:** `input.htf.next_candle_bias` (propagated from HTF orchestration)
   - **type:** string enum-like
   - **size risk:** **LOW**

3. **`confidence`**
   - **source:** `input.htf.confidence` (from HTF orchestration; type is `Confidence` from `shared/contracts/pmso`)
   - **type:** object/number depending on `Confidence` definition
   - **size risk:** **LOW–MEDIUM** (typically small)

4. **`reasoning`**
   - **source:** `input.htf.reasoning` (from HTF orchestration output)
   - **type:** string
   - **size risk:** **MEDIUM**

5. **`structure_state` (optional)**
   - **source:** `input.htf.structure_state` (from HTF orchestration `finalOutput.structure_state = combinedInput.structure`)
   - **type:** object (likely facts/arrays)
   - **size risk:** **HIGH** (can contain large grounded structures)

6. **`macro_state` (optional)**
   - **source:** `input.htf.macro_state` (from HTF orchestration `finalOutput.macro_state = combinedInput.macro`)
   - **type:** object
   - **size risk:** **HIGH**

7. **`liquidity_state` (optional)**
   - **source:** `input.htf.liquidity_state` (from HTF orchestration `finalOutput.liquidity_state = combinedInput.liquidity`)
   - **type:** object
   - **size risk:** **HIGH**

8. **`pd_array_state` (optional)**
   - **source:** `input.htf.pd_array_state` (from HTF orchestration `finalOutput.pd_array_state = combinedInput.pd_array`)
   - **type:** object
   - **size risk:** **HIGH**

### Why this field likely dominates original payload size
In `ltf-trigger-agent.ts`, constraints include:

- `"HTF CONTEXT: " + JSON.stringify({ ...input.htf, confidence: input.htf.confidence })`

So everything inside `triggerInput.htf` that survives sanitization becomes part of a **single large JSON string** in the prompt.

---

## triggerInput.itf
### Exact shape (from runtime code + schema)
`triggerInput.itf` comes from:

```ts
itf: sanitizeForOrchestration(input.itf)
```

From `shared/contracts/ltf/trigger.ts` (`LTFTriggerInput.itf`), the *required* fields are:
- `structure_trend`
- `structure_strength`
- `smt_signal`

and optional (if present in upstream ITF orchestration):
- `structure?`
- `liquidity?`
- `pd_array?`
- `setup?`

### Field list with source/type/size-risk
1. **`structure_trend`**
   - **source:** `input.itf.structure_trend` (ITF orchestration result)
   - **type:** enum-like string
   - **size risk:** **LOW**

2. **`structure_strength`**
   - **source:** `input.itf.structure_strength`
   - **type:** enum-like string
   - **size risk:** **LOW**

3. **`smt_signal`**
   - **source:** `input.itf.smt_signal` (likely derived from structure facts)
   - **type:** enum-like string
   - **size risk:** **LOW**

4. **`structure` (optional)**
   - **source:** `input.itf.structure`
   - **type:** object (facts/anchors arrays)
   - **size risk:** **HIGH**

5. **`liquidity` (optional)**
   - **source:** `input.itf.liquidity`
   - **type:** object
   - **size risk:** **HIGH**

6. **`pd_array` (optional)**
   - **source:** `input.itf.pd_array`
   - **type:** object
   - **size risk:** **HIGH**

7. **`setup` (optional)**
   - **source:** `input.itf.setup`
   - **type:** object (setup classification + reasoning)
   - **size risk:** **HIGH**

### Why this field likely dominates original payload size
In `ltf-trigger-agent.ts`, constraints include:

- `"ITF CONTEXT: " + JSON.stringify(input.itf)`

So `triggerInput.itf` is also converted into a **single large JSON string** for the LLM prompt.

---

## Most likely top runtime payload consumers (>90% of 2.4M)
These are the **exact field names** inside `triggerInput` that are most likely responsible for the >90% contribution to `original_payload_size` (2,419,479 chars), because they are stringified into the LTF-Trigger-Agent prompt:

1. **`htf`**
2. **`itf`**
3. **`structure`**
4. **`liquidity`**
5. **`pd_array`**

### Exact answer (as requested)
**Which specific fields are likely responsible for >90% of `original_payload_size`?**

- `htf`
- `itf`
- `structure`
- `liquidity`
- `pd_array`

---

## Notes on sanitization and what is excluded (runtime-only)
Because `sanitizeForOrchestration` strips `_debug`, `_raw`, and various hydration/context fields, those keys should not contribute to `triggerInput.htf` / `triggerInput.itf` payload sizes.

However, the *state/data objects* that remain (e.g., `structure_state`, `macro_state`, `setup`, etc.) can still be very large.

