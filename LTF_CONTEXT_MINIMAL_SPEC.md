# LTF_CONTEXT_MINIMAL_SPEC.md

READ ONLY — NO CODE CHANGES.

## Source evidence used
- `shared/contracts/ltf/liquidity.ts`
- `shared/contracts/ltf/pd-array.ts`
- `core/3.query/agents/ltf/ltf-liquidity-agent.ts`
- `core/3.query/agents/ltf/ltf-pd-array-agent.ts`

---

## What context is currently passed (as evidenced by prompt constraints)
Both **Liquidity** and **PDArray** agents inject:
- HTF context via:
  - `JSON.stringify({ ...input.htf, confidence: input.htf.confidence })`
- ITF context via:
  - `JSON.stringify(input.itf)`

So, “currently passed fields” are effectively **all properties present** on `input.htf` / `input.itf` at runtime (including optional nested states), not only the bias fields.

Additionally, each agent’s *type contracts* show which HTF/ITF fields may exist.

---

# Liquidity Agent — minimal required/useful/redundant

## Liquidity contract schemas
From `shared/contracts/ltf/liquidity.ts`:

### HTF fields available in the input type
- REQUIRED by type:
  - `htf_bias`
  - `next_candle_bias`
  - `confidence`
  - `reasoning`
- OPTIONAL by type:
  - `structure_state?`
  - `macro_state?`
  - `liquidity_state?`
  - `pd_array_state?`

### ITF fields available in the input type
- REQUIRED by type:
  - `structure_trend`
  - `structure_strength`
  - `smt_signal`
- OPTIONAL by type:
  - `structure?`
  - `liquidity?`
  - `pd_array?`
  - `setup?`

## Liquidity prompt evidence
In `ltf-liquidity-agent.ts`, the only explicit references to HTF/ITF are the JSON-stringified blocks:
- “HTF CONTEXT (HARD BIAS)” + spread of all HTF
- “ITF CONTEXT (NARRATIVE)” + full ITF

The task itself is: identify **micro liquidity** (sweeps/inducement) and validate with HTF.

### Field classification for Liquidity Agent
Classification meaning:
- **REQUIRED**: likely necessary to perform/validate sweep+inducement classification under the agent’s task.
- **USEFUL**: helps consistency/wording but can be omitted with small impact.
- **REDUNDANT**: not required for sweep/inducement inference; safe to prune.

| Field (Liquidity Agent input) | Classification | Reason required |
|---|---|---|
| htf_bias | REQUIRED | Used as “HARD BIAS” directional constraint (“validate with HTF”). |
| next_candle_bias | USEFUL | Helps execution-direction alignment with next-candle regime; not strictly needed to label sweeps/inducement mechanics, but improves validation consistency. |
| confidence | USEFUL | Helps weigh bias strength; agent also outputs its own confidence, so HTF confidence is supportive. |
| reasoning (HTF) | USEFUL | The constraints say to “apply HTF + ITF context” and “alignment”; reasoning may be helpful narrative justification but not structurally required for sweep mechanics. |
| structure_state | REDUNDANT (likely) | Agent is micro liquidity focused; structure_state is upstream HTF aggregation and not directly referenced elsewhere in this file. |
| macro_state | REDUNDANT (likely) | Not directly needed to detect micro sweeps/inducement beyond directional bias. |
| liquidity_state | USEFUL / REDUNDANT (borderline) | Could contain higher-level liquidity regime, but likely overlaps with what `htf_bias` already conveys. Since agent still validates with HTF, keeping it may be useful but not strictly required. |
| pd_array_state | REDUNDANT | Likely irrelevant to micro liquidity sweeps/inducement classification. |
| structure_trend (ITF) | USEFUL | Provides narrative about structure context; can help reconcile sweep interpretation. |
| structure_strength (ITF) | USEFUL | Affects conviction about how likely sweeps/inducement are to occur. |
| smt_signal (ITF) | USEFUL | Might inform whether liquidity events are aligned with delivery/structure shifts. |
| reasoning (ITF) | USEFUL (if present) | Included inside full `input.itf` stringify; can improve narrative validation but not required for the sweep/inducement extraction. |
| structure (ITF optional) | REDUNDANT | The liquidity agent does not appear to use ITF nested `structure` in any targeted way; prompt only says to apply ITF context. |
| liquidity (ITF optional) | USEFUL / REDUNDANT (borderline) | Could directly describe ITF liquidity, which is conceptually adjacent to LTF sweeps/inducement; keep might reduce ambiguity. Still, LTF chart grounding is primary. |
| pd_array (ITF optional) | REDUNDANT | Likely irrelevant to sweeps/inducement mechanics. |
| setup (ITF optional) | REDUNDANT (likely) | Setup type could correlate with expected liquidity events, but the agent already requests “identify sweeps/inducement” from LTF chart; type evidence suggests it’s not required. |

---

# PDArray Agent — minimal required/useful/redundant

## PDArray contract schemas
From `shared/contracts/ltf/pd-array.ts`:

### HTF fields available in the input type
- REQUIRED:
  - `htf_bias`
  - `next_candle_bias`
  - `confidence`
  - `reasoning`
- OPTIONAL:
  - `structure_state?`
  - `macro_state?`
  - `liquidity_state?`
  - `pd_array_state?`

### ITF fields available in the input type
- REQUIRED:
  - `structure_trend`
  - `structure_strength`
  - `smt_signal`
- OPTIONAL:
  - `structure?`
  - `liquidity?`
  - `pd_array?`
  - `setup?`

## PDArray prompt evidence
In `ltf-pd-array-agent.ts`, it stringifies:
- HTF context (spread) and ITF context (full stringify) as “HARD BIAS” and “NARRATIVE”.

The task is: classify LTF **zone** (premium/discount/equilibrium) and list **PD arrays**.

### Field classification for PDArray Agent

| Field (PDArray Agent input) | Classification | Reason required |
|---|---|---|
| htf_bias | REQUIRED | “HARD BIAS” used to validate PD array zone classification. |
| next_candle_bias | USEFUL | Likely used for direction/regime alignment; improves validation but can be pruned if htf_bias already captures directionality. |
| confidence | USEFUL | Helps weigh HTF validation strength; not required for identifying LTF PD arrays themselves. |
| reasoning (HTF) | USEFUL | Narrative justification; helps explain classification alignment. Not essential for zone mechanics. |
| structure_state | REDUNDANT (likely) | PD array zone is typically derived from LTF chart FVG/OB/discount/premium mechanics; HTF structure_state aggregation is not explicitly needed by this agent. |
| macro_state | REDUNDANT (likely) | Macro aggregation not required for LTF PD array extraction. |
| liquidity_state | USEFUL / REDUNDANT (borderline) | May help validate PD arrays via liquidity regime, but can overlap with htf_bias. |
| pd_array_state | USEFUL (borderline) | Potentially relevant because PD arrays are explicitly referenced; however the agent already grounds PD arrays from chart and validates with HTF, so keeping only bias+confidence might suffice. |
| structure_trend (ITF) | USEFUL | Helps contextualize whether premium/discount alignment is consistent with broader structure delivery. |
| structure_strength (ITF) | USEFUL | Confidence/likelihood modifier for zone classification. |
| smt_signal (ITF) | USEFUL | SMT relates to delivery/structure shifts that often correlate with PD array behavior. |
| reasoning (ITF) | USEFUL | Present if included in full ITF stringify; can improve “narrative validation”. |
| structure (ITF optional) | REDUNDANT | No explicit use; agent only asks to apply ITF context generally. |
| liquidity (ITF optional) | REDUNDANT | Likely not directly needed for premium/discount classification. |
| pd_array (ITF optional) | REDUNDANT / USEFUL (borderline) | If present, could mirror PD array conclusions from ITF; but LTF chart grounding is primary. |
| setup (ITF optional) | REDUNDANT | Setup type may correlate but not explicitly required for the mechanics of PD array zoning. |

---

## Summary: minimal HTF/ITF fields (pruning target-ready)

Because both agents stringify full `input.htf` and `input.itf`, the minimal spec should be interpreted as the set of fields that are **most likely required** for correctness:

### Liquidity Agent
- Minimal HTF: `htf_bias` (+ optionally `confidence`, possibly `next_candle_bias`)
- Minimal ITF: `structure_trend`, `structure_strength`, `smt_signal`

### PDArray Agent
- Minimal HTF: `htf_bias` (+ optionally `confidence`, possibly `next_candle_bias`)
- Minimal ITF: `structure_trend`, `structure_strength`, `smt_signal`

(Everything else is likely removable as **REDUNDANT** unless runtime evidence shows otherwise.)

