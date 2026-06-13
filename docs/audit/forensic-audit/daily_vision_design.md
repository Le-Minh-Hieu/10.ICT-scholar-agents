# Daily Agent Vision Fact Design

The vision prompt for the Daily Agent extracts structural chart facts using the shared market structure ontology from higher timeframes.

## Vision Prompt Definition

```typescript
visionPrompt: `Analyze ALL attached chart images for LIVE ICT daily time-based observations.

Focus on the 3 provided timeframes (Daily, H4, H1) to identify:

1. **Daily Range & Daily Dealing Range**: Identify the boundaries of the current daily range and active daily dealing range.
2. **Daily FVG & H4 FVG**: Note any daily or H4 Fair Value Gaps (FVG) price is interacting with.
3. **H4 Order Block & Breaker Block**: Identify key H4/H1 order blocks or breaker blocks price is testing or approaching.
4. **Premium / Discount / Equilibrium**: Determine if price is in premium, discount, or equilibrium relative to the daily range.
5. **Opening Range & New Day Opening Gap (NDOG)**: Note the opening range of the current day and if any NDOG is open or filled.
6. **Intraday Displacement & Liquidity**: Identify displacement legs or sweeps of intraday liquidity (e.g. previous daily high/low sweeps) on the H1 chart.

Output your observations as bullet points.
CRITICAL: Do NOT infer directional forecasting, bias generation, or entry signals. Report raw chart facts only.
CRITICAL: Do NOT use the phrases 'Daily Bias', 'intraday bias', or 'Daily Buy Day Bias' in your observations. Use terms like 'daily range', 'dealing range', 'H4 FVG', 'order block', 'breaker block', 'premium discount', 'opening range', or 'liquidity sweep'.`
```

## Alignment with Core Ontology

* **daily range** replaces *intraday bias* / *daily bias*
* **dealing range & premium/discount** replaces *intraday seasonality*
* **H4 FVG & order block** replaces *News Embargo Lift Timing*
* **opening range & NDOG** replaces *No-Trade Day*
* **displacement & liquidity sweep** replaces *Silver Bullet Hour* and *Optimal Trade Entry (OTE)*
