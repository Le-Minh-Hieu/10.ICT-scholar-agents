# Architectural Audit: macro_news_summary Analysis

This document presents the detailed architectural audit of the `macro_news_summary` artifact inside the Scholar system.

---

## 1. Producer of `macro_news_summary`

The primary producer of `macro_news_summary` is the function **`buildCompactMacroSummary`** located within [master-orchestrator.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/orchestrators/master-orchestrator.ts#L70-L94). 

It is constructed dynamically during the execution of **`runMasterOrchestrator`** at:
```typescript
const compactMacroSummary = buildCompactMacroSummary(validatedInput.hydration_context, newsModifier);
```
and then assigned to the downstream context:
```typescript
if (newsModifier) {
  validatedInput.hydration_context.minimal_context = {
    ...(validatedInput.hydration_context.minimal_context || {}),
    macro_news_summary: compactMacroSummary,
  };
}
```

---

## 2. Field-by-Field Source & Transformation Trace

| Field | Producer | Source Data | Transformation |
| :--- | :--- | :--- | :--- |
| **`persistent_macro_narrative`** | `buildMacroNarrative` | `hydrationContext.macro_profile.narrative_state` <br> `newsModifier.macro_context.phase` | Dynamic fallback coalescing: <br> `profile?.narrative_state ?? newsModifier?.macro_context?.phase ?? null` |
| **`macro_directional_alignment`** | `buildCompactMacroSummary` | `newsModifier.directional_alignment` | Raw selection with fallback: <br> `newsModifier?.directional_alignment ?? "NEUTRAL"` |
| **`intermarket_macro_state`** | `buildMacroNarrative` | `profile.macro_bias`, `newsModifier.macro_context.macro_bias`, `profile.regime`, `active_events` | Bundled object containing: <br> • `macro_bias`: `profile?.macro_bias ?? newsModifier?.macro_context?.macro_bias ?? "neutral"` <br> • `regime`: `profile?.regime ?? null` <br> • `active_event_count` |
| **`volatility_regime`** | `buildCompactMacroSummary` | `newsModifier.macro_ire.volatility_regime` | Extracted: <br> `newsModifier?.macro_ire?.volatility_regime ?? null` |
| **`continuation_retracement_expectation`** | `buildCompactMacroSummary` | `newsModifier.macro_ire.narrative_alignment` | Extracted: <br> `newsModifier?.macro_ire?.narrative_alignment ?? null` |
| **`execution_risk`** | `buildCompactMacroSummary` | `newsModifier.macro_ire.execution_risk` | Extracted: <br> `newsModifier?.macro_ire?.execution_risk ?? null` |
| **`embargo_sensitivity`** | `buildCompactMacroSummary` | `eventWindows.embargo` | Boolean determination: <br> `(eventWindows?.embargo?.length || 0) > 0` |
| **`execution_modifiers`** | `buildCompactMacroSummary` | `newsModifier.macro_ire.execution_modifier` <br> `newsModifier.macro_context.execution_modifier` | Coalesced execution controls: <br> `newsModifier?.macro_ire?.execution_modifier ?? newsModifier?.macro_context?.execution_modifier ?? null` |
| **`event_phase`** | `buildCompactMacroSummary` | `newsModifier.macro_ire.event_phase` <br> `newsModifier.macro_context.phase` | Coalesced string check: <br> `newsModifier?.macro_ire?.event_phase ?? newsModifier?.macro_context?.phase ?? null` |
| **`macro_catalysts`** | `buildCompactMacroSummary` | `narrative.active_events` | Maps up to 5 events to concise objects: <br> `{ id: event.id, category: event.category, phase: event.lifecycle_phase ?? event.window_state ?? null }` |
| **`macro_invalidation_hints`** | `buildCompactMacroSummary` | `newsModifier.macro_ire.why` | Enclosed string list: <br> `newsModifier?.macro_ire?.why ? [newsModifier.macro_ire.why] : []` |

---

## 3. Comparison Matrix: `macro_profile` vs `macro_news_summary`

| Field in `macro_news_summary` | `macro_profile` equivalent / source | Dynamic / Independent logic? | Removable? |
| :--- | :--- | :--- | :--- |
| **`persistent_macro_narrative`** | `narrative_state` | **No** (Directly projected, falls back to newsModifier phase only if profile is null) | **Yes** (If redundant) |
| **`macro_directional_alignment`** | *None* | **Yes** (Dynamically calculated based on `directional_pressure` of active news items) | **No** (Carries live direction) |
| **`intermarket_macro_state`** | `macro_bias`, `regime`, `active_events` | **No** (Combines static profile state and events, though falls back to `newsModifier` if profile is empty) | **Yes** |
| **`volatility_regime`** | `macro_ire.volatility_regime` | **Yes** (Dynamically derived from live event pressures: `volatility_pressure` + `uncertainty_pressure`) | **No** (Reflects live volatility) |
| **`continuation_retracement_expectation`** | *None* | **Yes** (Determined dynamically by narrative-alignment logic at runtime) | **No** |
| **`execution_risk`** | `macro_ire.execution_risk` | **Yes** (Dynamically determined based on current live event volatility/uncertainty) | **No** (Key runtime safe-guard) |
| **`embargo_sensitivity`** | *None* | **Yes** (Derived dynamically from active embargo windows) | **No** (Required for timing gates) |
| **`execution_modifiers`** | `macro_ire.execution_modifier` | **Yes** (Computed dynamically from `volatility_pressure` at runtime) | **No** (Drives sizing decisions) |
| **`event_phase`** | *None* | **Yes** (Derived dynamically from active lifecycle stage) | **No** |
| **`macro_catalysts`** | `active_events` | **No** (Filtered projection of the first 5 active events) | **Yes** |
| **`macro_invalidation_hints`** | *None* | **Yes** (Constructed dynamically to explain runtime deviations) | **No** |

---

## 4. Derived Entirely from `macro_profile`?

> [!IMPORTANT]
> **No.** `macro_news_summary` cannot be derived entirely from `macro_profile`. 

### Why?
1. **Dynamic News Pipeline Ingestion:** The `newsModifier` is calculated at runtime inside `runMasterOrchestrator` based on `groundedReasoning` (using LLM-driven event reasoners). This reads **live news evidence chunks** and computes dynamic uncertainty and volatility pressures.
2. **Real-time Safe-guards:** Fields such as `volatility_regime`, `execution_risk`, `execution_modifiers`, and `macro_directional_alignment` reflect **active market state changes and live news updates**.
3. **Temporal Sensitivity:** The static `macro_profile` represents a weekly snapshot, whereas `macro_news_summary` bridges this weekly anchor with real-time news shocks.

---

## 5. Architectural Verdict

### **Verdict: B. Independent Cognition Artifact**

`macro_news_summary` is **not** a redundant projection. It functions as a crucial real-time cognitive bridge, synthesising the long-term structural context (`macro_profile`) with short-term, dynamic, evidence-backed runtime updates (`newsModifier`). Consumed by downstream orchestrators (e.g. ITF and LTF orchestrators) via the LLM prompt context, it acts as a central transmission line for dynamic risk management, sizing adjustments, and timing-gate controls.
