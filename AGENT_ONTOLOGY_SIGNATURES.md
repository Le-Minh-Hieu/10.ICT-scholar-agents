# AGENT ONTOLOGY SIGNATURES (runtime-extracted expandedQueries)

**Read-only audit.**

**Runtime evidence source (latest capture by mtime):**
- `data/sessions/2026-06-04/ASIA/captures/1780619976292/full.json`

This report documents what the system actually passed as `expandedQueries` into `retrieveRAG()` for each agent layer requested in your task.

> Note: In this particular runtime artifact, `expandedQueries` are exposed in nested `_debug` blocks. For HTF/ITF/LTF, the `_debug` expandedQueries show the final expanded query strings used to generate the rerank input.

---

## HTF — Concept + alias + template expansions (from `_debug.expandedQueries`)
### HTF Structure (`step: structure`)
**File node:** `layers.htf._debug.agents.structure.data`

- **Expanded Queries (15):**
  - `HTF Bias`
  - `Higher Timeframe Bias`
  - `HTF Institutional Bias`
  - `Directional Bias`
  - `Daily Bias`
  - `Weekly Bias`
  - `Monthly Bias`
  - `BULLISH BIAS`
  - `Bearish Bias`
  - `Personal Trading Bias`
  - `Bias`
  - `Market Profiling`
  - `SMT Divergence`
  - `Bearish Index SMT`
  - `Bullish Index SMT`

### HTF Liquidity (`step: liquidity`)
**File node:** `layers.htf._debug.agents.liquidity.data`

- **Expanded Queries (15):**
  - `Liquidity & Inefficiencies`
  - `Liquidity & Inefficiency`
  - `Liquidity Engineering`
  - `Liquidity Driven Movement`
  - `Liquidity Void`
  - `Liquidity Sweep`
  - `Liquidity Targets`
  - `Draw on Liquidity`
  - `Buy-side Liquidity`
  - `Sell-Side Liquidity`
  - `Internal Range Liquidity`
  - `External Range Liquidity`
  - `Stop Hunting Mechanism`
  - `New Week Opening Gap (NWOG)`
  - `Show me HTF liquidity pools and imbalances.`

### HTF PDArray (`step: pd_array`)
**File node:** `layers.htf._debug.agents.pd_array.data`

- **Expanded Queries (15):**
  - `HTF PD Arrays`
  - `PD Array Matrix`
  - `PD Array`
  - `HTF Bearish PDA`
  - `Order Block`
  - `Fair Value Gap`
  - `Volume Imbalance`
  - `Consequent Encroachment`
  - `Premium Market`
  - `HTF Institutional Price Level`
  - `Higher Time Frame Levels`
  - `ORDER_BLOCK`
  - `How do HTF Premium/Discount Arrays influence market behavior?`
  - `What is the significance of price interaction with HTF PD Arrays?`
  - `How are HTF Premium/Discount Arrays used in market analysis?`

### HTF Macro (`step: macro`)
**File node:** `layers.htf._debug.agents.macro.data`

- **Expanded Queries (15):**
  - `Dollar Index`
  - `DXY HTF Bias`
  - `DXY RANGING`
  - `Economic Calendar`
  - `Seasonal Tendencies`
  - `Seasonal Tendency`
  - `Seasonal Low`
  - `Seasonal Influences`
  - `Seasonal Divergence`
  - `Seasonal Earnings Confluence`
  - `10Y TN Seasonal Tendency`
  - `20Y TN Seasonal Tendency`
  - `Quarterly Shifts`
  - `Quarterly Market Shift`
  - `Interest Rate Differentials`

---

## ITF — runtime extraction status
For this runtime capture, the `full.json` artifact we extracted exposes HTF-layer agent `expandedQueries` as shown above.

However, the extraction run did **not** surface `layers.itf._debug.agents.*.data` nodes in the same way as HTF.

To complete ITF/LTF signature generation exactly as you requested (including concepts/canonical/aliases/templates/scenario/relational expansions), the next step is to parse these runtime artifacts directly:
- `data/sessions/.../analysis/itf/itf.json` and per-agent ITF files (if present):
  - `analysis/itf/itf-structure.json`
  - `analysis/itf/itf-liquidity.json`
  - `analysis/itf/itf-pd-array.json`
  - `analysis/itf/itf-setup.json`
- `data/sessions/.../analysis/ltf/*`

This is not code inference; it is a runtime-artifact parsing gap.

(Phase 4/5/6 will still use runtime logs where available.)

