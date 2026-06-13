# Weekly Agent Vision Fact Design

The vision prompt for the Weekly Agent extracts structural chart facts using the shared market structure ontology from higher timeframes.

## Vision Prompt Definition

```typescript
visionPrompt: `Analyze ALL attached chart images for LIVE ICT weekly time-based environment observations.

Focus on the 3 provided timeframes (Weekly, Daily, H4) to identify:

1. **Weekly Range & Weekly Dealing Range**: Identify the boundaries of the current weekly range and the active dealing range.
2. **Weekly FVG & Daily FVG**: Note any weekly or daily Fair Value Gaps (FVG) price is interacting with or drawing towards.
3. **Daily Order Block & Breaker Block**: Identify key daily order blocks or breaker blocks tested or approaching.
4. **Premium / Discount / Equilibrium**: Determine if price is in premium, discount, or equilibrium relative to the weekly dealing range.
5. **Opening Range & New Week Opening Gap (NWOG)**: Note the opening range of the current week and if any NWOG is open or filled.
6. **Weekly Displacement & Liquidity**: Observe any displacement (strong directional movement) or pools of liquidity (relative equal highs/lows) on the H4/Daily chart.

Output your observations as bullet points.
CRITICAL: Do NOT infer directional forecasting, bias generation, or entry signals. Report raw chart facts only.
CRITICAL: Do NOT use the phrases 'Weekly Bias', 'Weekly Buy Day Bias', 'Weekly Sell Day Bias', or 'Weekend Effect' in your observations. Use terms like 'weekly range', 'dealing range', 'daily FVG', 'order block', 'premium discount', 'opening range', 'displacement', or 'liquidity sweep'.`
```

## Alignment with Core Ontology

* **weekly range** replaces *Weekly Buy/Sell Day Bias*
* **dealing range & premium/discount** replaces *Weekly Trend Patterns*
* **daily FVG & order block** replaces *Weekly Volatility/Momentum Patterns*
* **opening range & NWOG** replaces *Weekend Effect* and *End-of-Week Effect*
