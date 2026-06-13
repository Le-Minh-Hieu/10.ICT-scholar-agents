# LTF_AGENT_CONTEXT_AUDIT.md

## Phase 2 — Audit remaining LTF agents (read-only)

### Files inspected
- `core/3.query/agents/ltf/ltf-structure-agent.ts`
- `core/3.query/agents/ltf/ltf-liquidity-agent.ts`
- `core/3.query/agents/ltf/ltf-pd-array-agent.ts`

---

## Important note about “receiving full HTF/ITF context”
These agents accept a single `input` object. The **only confirmed in-repo compaction we saw** is in `ltf-orchestrator.ts` for `triggerInput` (not for the independent agents). Therefore:
- This audit can **prove** whether an agent stringifies/injects `input.htf` / `input.itf` into its prompt.
- It cannot 100% prove whether upstream `input.htf` / `input.itf` are full or already compact at runtime (that depends on the orchestrator’s input shape before calling these agents).

So classification below is based on **what each agent does in its prompt constraints**.

---

# Agent 1 — ltfStructureAgent (`ltf-structure-agent.ts`)

## Input fields consumed
- `input.eurusd.m15`
- `input.eurusd.m5`
- `input.eurusd.m1`
- `minimal_context` is passed to `runBaseAgent`

## Prompt fields injected (stringified)
- No explicit `JSON.stringify(input.htf)` or `JSON.stringify(input.itf)` found in this file.

## JSON.stringify locations
- None found for `input.htf` / `input.itf`.

## Largest context blobs likely entering prompt
- Image payloads via `pushImage(parts, input.eurusd.*)`
- Whatever `runBaseAgent` injects from `minimal_context` (unknown here)

## Classification (KEEP / REMOVE / UNKNOWN)
| Field | Classification | Reason required |
|---|---|---|
| reasoning | UNKNOWN | Not injected via JSON.stringify in this file; model output only. |
| reasoning_summary | UNKNOWN | Not referenced in this file. |
| structure_state | UNKNOWN | No explicit HTF stringify; cannot confirm. |
| macro_state | UNKNOWN | No explicit HTF stringify; cannot confirm. |
| liquidity_state | UNKNOWN | No explicit HTF stringify; cannot confirm. |
| pd_array_state | UNKNOWN | No explicit HTF stringify; cannot confirm. |
| structure | UNKNOWN | No explicit ITF stringify; cannot confirm. |
| liquidity | UNKNOWN | No explicit ITF stringify; cannot confirm. |
| pd_array | UNKNOWN | No explicit ITF stringify; cannot confirm. |
| setup | UNKNOWN | No explicit ITF stringify; cannot confirm. |

---

# Agent 2 — ltfLiquidityAgent (`ltf-liquidity-agent.ts`)

## Input fields consumed
- `input.eurusd.m15`, `input.eurusd.m5`, `input.eurusd.m1` (pushImage)
- `input.htf` (existence check + spread)
- `input.itf` (existence check)

## Prompt fields injected (stringified)
In `constraints`:
- `HTF CONTEXT (HARD BIAS): " + JSON.stringify({ ...input.htf, confidence: input.htf.confidence })`
- `ITF CONTEXT (NARRATIVE): " + JSON.stringify(input.itf)`

## JSON.stringify locations (largest context blobs likely)
1. `JSON.stringify({ ...input.htf, confidence: input.htf.confidence })` (can include full HTF nested states if present on `input.htf`)
2. `JSON.stringify(input.itf)` (can include full ITF nested structure/liquidity/pd_array/setup if present)

## Largest context blobs likely entering prompt
- Entire HTF object (spread) and entire ITF object (direct stringify), if they are “full”.

## Classification (KEEP / REMOVE / UNKNOWN)
| Field | Classification | Reason required |
|---|---|---|
| reasoning | KEEP | `input.itf` is fully stringified; if `itf.reasoning` exists, it will be included. |
| reasoning_summary | UNKNOWN | Could be included if present on `input.htf` or `input.itf`, but not explicitly referenced. |
| structure_state | KEEP | `...input.htf` spread includes it if present. |
| macro_state | KEEP | `...input.htf` spread includes it if present. |
| liquidity_state | KEEP | `...input.htf` spread includes it if present. |
| pd_array_state | KEEP | `...input.htf` spread includes it if present. |
| structure | KEEP | `JSON.stringify(input.itf)` includes `itf.structure` if present. |
| liquidity | KEEP | `JSON.stringify(input.itf)` includes `itf.liquidity` if present. |
| pd_array | KEEP | `JSON.stringify(input.itf)` includes `itf.pd_array` if present. |
| setup | KEEP | `JSON.stringify(input.itf)` includes `itf.setup` if present. |

---

# Agent 3 — ltfPDArrayAgent (`ltf-pd-array-agent.ts`)

## Input fields consumed
- `input.eurusd.m15`, `input.eurusd.m5`, `input.eurusd.m1` (pushImage)
- `input.htf` (existence check + spread)
- `input.itf` (existence check)

## Prompt fields injected (stringified)
In `constraints`:
- `HTF CONTEXT (HARD BIAS): " + JSON.stringify({ ...input.htf, confidence: input.htf.confidence })`
- `ITF CONTEXT (NARRATIVE): " + JSON.stringify(input.itf)`

## JSON.stringify locations
1. `JSON.stringify({ ...input.htf, confidence: input.htf.confidence })`
2. `JSON.stringify(input.itf)`

## Largest context blobs likely entering prompt
- Entire HTF object (spread) and entire ITF object (direct stringify), if upstream `input.htf` / `input.itf` are “full”.

## Classification (KEEP / REMOVE / UNKNOWN)
| Field | Classification | Reason required |
|---|---|---|
| reasoning | KEEP | Included if present because `JSON.stringify(input.itf)` is used. |
| reasoning_summary | UNKNOWN | Could be included if present on `input.htf` or `input.itf`. |
| structure_state | KEEP | `...input.htf` spread includes if present. |
| macro_state | KEEP | `...input.htf` spread includes if present. |
| liquidity_state | KEEP | `...input.htf` spread includes if present. |
| pd_array_state | KEEP | `...input.htf` spread includes if present. |
| structure | KEEP | Included if present because `input.itf` is fully stringified. |
| liquidity | KEEP | Included if present because `input.itf` is fully stringified. |
| pd_array | KEEP | Included if present because `input.itf` is fully stringified. |
| setup | KEEP | Included if present because `input.itf` is fully stringified. |

---

## Most important — next highest ROI pruning target after Trigger (evidence only)

### Evidence basis
- `ltfTriggerAgent` now receives compact HTF/ITF from `ltf-orchestrator.ts` (verified in Phase 1).
- Remaining LTF agents still embed HTF/ITF using `JSON.stringify({ ...input.htf ... })` and/or `JSON.stringify(input.itf)`.

### Rank (largest unnecessary HTF/ITF payload likely entered into prompt)
1. **ltfLiquidityAgent** — stringifies `input.htf` via spread and `input.itf` fully.
2. **ltfPDArrayAgent** — stringifies `input.htf` via spread and `input.itf` fully.
3. **ltfStructureAgent** — no HTF/ITF stringification in this file; likely dominated by image/minimal_context instead.

(Do NOT implement; evidence-only.)

---

## Failsafes / limitations
- This audit does not instrument runtime payload sizes; it classifies based on static prompt constraint construction.
- The actual presence of “full nested HTF/ITF states” depends on the orchestrator’s upstream `input` shape when these agents are called.

