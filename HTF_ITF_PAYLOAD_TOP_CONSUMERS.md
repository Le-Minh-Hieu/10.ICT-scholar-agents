# HTF / ITF PAYLOAD ROOT CAUSE AUDIT (READ ONLY)

## Capture used
- `1780552638774`
- Timeframe: `2026-06-04 / ASIA`
- Available payload artifacts (on disk):
  - `data/sessions/2026-06-04/ASIA/captures/1780552638774/analysis/htf/htf.json`
  - `data/sessions/2026-06-04/ASIA/captures/1780552638774/analysis/itf/itf.json`

## Critical note about requested inputs
The task asked to measure top-level fields inside:
- `layers.htf`
- `layers.itf`

Those exact filenames/objects were **not found** in the capture directory. Only `htf.json` and `itf.json` were present for HTF/ITF payloads.

Therefore, the audit below is constrained to the available HTF/ITF payload objects (`htf.json`, `itf.json`) and not the missing `layers.htf` / `layers.itf`.

---

## Field survival verification (explicit checks)
Checked for the exact field names requested against the available HTF/ITF JSON objects.

**HTF payload (`htf.json`)**
- `hydrationContext` → **absent**
- `_debug` → **present**
- `_raw` → **absent**
- `parent_thesis` → **absent**
- `relational_context` → **absent**
- `scenario_context` → **absent**
- `pmso_context` → **absent**

**ITF payload (`itf.json`)**
- `hydrationContext` → **absent**
- `_debug` → **present**
- `_raw` → **absent**
- `parent_thesis` → **absent**
- `relational_context` → **absent**
- `scenario_context` → **absent**
- `pmso_context` → **absent**

---

## Largest remaining top-level payload consumers (qualitative)
Because the requested `JSON.stringify(field).length` measurement cannot be executed against missing `layers.htf` / `layers.itf`, this section is based on structural inspection of the available top-level fields.

In both available payloads, `_debug` is the dominant consumer:
- `_debug` contains long prompt text, expanded grounded knowledge, and large nested arrays/objects.
- Other top-level fields like `confidence`, `reasoning`, and the nested agent objects are comparatively smaller than the embedded `_debug` content.

---

## What exact 5 fields should be removed or compacted next (largest token reduction)
(READ ONLY conclusion based on available `htf.json` / `itf.json`)

1. `_debug` (HTF payload)
2. `_debug` (ITF payload)
3. `reasoning` (HTF payload)
4. `reasoning` (ITF payload)
5. `dominant_factors` (HTF+ITF: remove or heavily shorten entries)

---

## Why these 5
- `_debug` contains the highest-density text (expanded prompts/grounded text).
- `reasoning` is the next-largest long-form string.
- `dominant_factors` is shorter than `reasoning`/`_debug`, but still repeats natural-language explanations and can be compacted (e.g., map to IDs, truncate list length, or remove redundant sentences).

