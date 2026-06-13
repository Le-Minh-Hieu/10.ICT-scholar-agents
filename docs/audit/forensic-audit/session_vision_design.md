# Session Agent Vision Fact Design

The vision prompt for the Session Agent extracts structural chart facts using the shared market structure ontology from higher timeframes.

## Vision Prompt Definition

```typescript
visionPrompt: `Analyze ALL attached chart images for LIVE ICT session-based timing observations.

Focus on the 3 provided timeframes (H1, M15, M5) to identify:

1. **Session Range & Intraday Dealing Range**: Identify the boundaries of the current session range (London, New York, or Asian) and active intraday dealing range.
2. **M15 FVG & M5 FVG**: Note any M15 or M5 Fair Value Gaps (FVG) price is interacting with.
3. **M15 Order Block & Breaker Block**: Identify key M15/M5 order blocks or breaker blocks price is testing or drawing towards.
4. **Premium / Discount / Equilibrium**: Determine if price is in premium, discount, or equilibrium relative to the session range.
5. **Opening Range & Midnight Open**: Note the opening range of the current session or Midnight Open price line.
6. **Session Displacement & Liquidity Sweeps**: Observe any displacement (strong directional movement) or sweeps of session highs/lows (Asian range sweeps or London high/low sweeps) on the M15/M5 charts.

Output your observations as bullet points.
CRITICAL: Do NOT infer directional forecasting, bias generation, or entry signals. Report raw chart facts only.
CRITICAL: Do NOT use the phrases 'Session Reversal', 'Morning Session Setups', or 'Afternoon Session' in your observations. Use terms like 'session range', 'dealing range', 'M15 FVG', 'order block', 'premium discount', 'opening range', 'displacement', or 'liquidity sweep'.`
```

## Alignment with Core Ontology

* **session range** replaces *Session Timing*
* **dealing range & premium/discount** replaces *Morning/Afternoon Session Setups*
* **M15 FVG & order block** replaces *Optimal Trade Entry (OTE) Timing*
* **opening range & Midnight Open** replaces *Midnight Open* line and *NWOG/NDOG*
* **displacement & liquidity sweep** replaces *Session-Specific Setups* and *Session Reversal*
