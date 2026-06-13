# Initial Grounded Knowledge Token Audit

**Date:** 2026-06-09
**Target Agent:** Macro-Time-Agent
**Pipeline Step:** macro_time
**Total Concepts:** 55

---

## LAYER CLASSIFICATION

| Field | Layer | Reason |
|-------|-------|--------|
| concept | Vision | Concept to detect on chart |
| type | Vision | Classification (timing/pattern/behavior) |
| layer | Vision | Timeframe scope |
| agent.role | Vision | What to detect |
| agent.focus | Vision | What to pay attention to |
| agent.when_to_use | Vision | Activation condition |
| agent.invalid_when | Vision | Deactivation condition |
| agent.query_templates | Retrieval | Only used when gap detected |
| agent.signal | Reasoning | Expected output format/signal |

---

## PHASE 1: CONCEPT & ENTRY COUNTS

| Metric | Count |
|--------|-------|
| Total macro_time concepts | 55 |
| Matching knowledge_map entries (unique) | 6 |
| Match rate (concepts with ≥1 entry) | 3/55 |
| Concepts with NO match | 52 |

### Per-Concept Details

- **Seasonal Tendencies**: 3 entries | 3 roles | 9 focus (9 dedup) | 3 when_to_use | 3 invalid_when | 9 q_templates | 3 signals
- **Economic Calendar**: 2 entries | 2 roles | 5 focus (5 dedup) | 2 when_to_use | 2 invalid_when | 6 q_templates | 2 signals
- **Seasonal Influences**: 1 entries | 1 roles | 3 focus (3 dedup) | 1 when_to_use | 1 invalid_when | 3 q_templates | 1 signals
- **Calendar Effects**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Cycles**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Windows**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Events**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Patterns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Anomalies**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Seasonality**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Calendar Effects**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Economic Events**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Market Sentiment**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Volatility**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Liquidity**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Momentum**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Reversals**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Pullbacks**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Continuations**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Reversals**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Volatility Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Momentum Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Liquidity Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Risk Management Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Trade Timing Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Seasonal Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Calendar Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Behavioral Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Market Microstructure Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Order Flow Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Volume Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Price Action Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Trend Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Mean Reversion Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Pullback Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Continuation Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Reversal Breakouts**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Volatility Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Momentum Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Liquidity Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Risk Management Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Trade Timing Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Seasonal Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Calendar Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Behavioral Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Market Microstructure Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Order Flow Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Volume Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Price Action Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Trend Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Mean Reversion Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Pullback Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Continuation Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals
- **Macro Time Reversal Breakdowns**: 0 entries | 0 roles | 0 focus (0 dedup) | 0 when_to_use | 0 invalid_when | 0 q_templates | 0 signals

---

## PHASE 2: VISION LAYER AGGREGATION

### Total Vision Fields

| Field | Total | Unique (dedup) | Per Concept Avg |
|-------|-------|----------------|-----------------|
| role | 6 | 6 | 0.1 |
| focus | 17 | 17 | 0.3 |
| when_to_use | 6 | 6 | 0.1 |
| invalid_when | 6 | 6 | 0.1 |

---

## PHASE 3: TOKEN MEASUREMENTS

### Option A: Full Agent Aggregation (all concepts)

| Metric | Value |
|--------|-------|
| Characters | 6655 |
| Words | 922 |
| Lines | 122 |
| Token estimate (chars/4) | 1664 |
| Token estimate (chars/3.5) | 1901 |

### Option B: Deduplicated Aggregation

| Metric | Value |
|--------|-------|
| Characters | 6361 |
| Words | 878 |
| Lines | 115 |
| Token estimate (chars/4) | 1590 |
| Token estimate (chars/3.5) | 1817 |

### Option C: Top-Level Aggregation (compressed)

| Metric | Value |
|--------|-------|
| Characters | 442 |
| Words | 58 |
| Lines | 12 |
| Token estimate (chars/4) | 111 |
| Token estimate (chars/3.5) | 126 |

---

## PHASE 4: LAYER-SPECIFIC TOKEN COST (Full Aggregation)

| Layer | Characters | Words | Token Estimate |
|-------|-----------|-------|----------------|
| Vision | 2661 | 365 | 665 |
| Retrieval | 1265 | 188 | 316 |
| Reasoning | 622 | 85 | 156 |

---

## PHASE 5: COMPRESSION OPPORTUNITIES

| Section | Raw Tokens (chars/4) | Compressed Tokens | Savings | Strategy |
|---------|---------------------|-------------------|---------|----------|
| Agent Role + Task | 35 | 35 | 0% | Keep - minimal |
| Concept Names (55) | 405 | 405 | 0% | Keep - essential |
| Vision Rules (full) | 665 | 399 | ~40% | Summarize role, dedup focus |
| query_templates | 316 | 95 | ~70% | Remove or reference - only needed for retrieval gaps |
| Signals | 156 | 78 | ~50% | Keep only unique per concept |
| Interpretation Guidelines | 64 | 0 | 100% | Derive from agent task context instead |

---

## PHASE 5B: FIT ANALYSIS

**Context Window Budget:**
- Typical LLM context: 4K-8K tokens for reasoning
- Current prompt: <2K tokens (estimated)
- Available budget: 2K-6K tokens

**Full Aggregation (Option A):** 1664 tokens
- ✅ FITS within budget

**Deduplicated (Option B):** 1590 tokens
- ✅ FITS within budget

**Top-Level (Option C):** 111 tokens
- ✅ COMFORTABLY FITS

---

## PHASE 6: MINIMUM USABLE INITIAL GROUNDED KNOWLEDGE

**Recommended: Option B (Deduplicated) with compression**

### What to include:

1. **Agent Role + Task** (always, <50 tokens)
2. **Concept names** (always, ~405 tokens) 
3. **Vision Rules - COMPRESSED:**
   - Keep deduplicated roles only (1-2 per concept)
   - Keep deduplicated focus list
   - Remove redundant when_to_use/invalid_when (can be inferred from role)
4. **query_templates: REMOVED** (only load when retrieval triggered)
5. **Signals: COMPRESSED** (keep 1 signal per concept)

### Estimated minimum token cost: ~1034 tokens
(65% of dedup via removing templates + compressing redundant fields)

**Saving vs Full:** ~631 tokens (38%)

---

## RAW AGGREGATED PAYLOAD

### Full Aggregation Text (for verification):

```
AGENT ROLE:
You are an ICT Time Analysis Agent.

AGENT TASK:
Analyze the macro time-based market regime using grounded knowledge, chart images, and NY time context.

DOMAIN CONCEPTS (55 total):
Seasonal Tendencies, Economic Calendar, Seasonal Influences, Calendar Effects, Macro Time Cycles, Macro Time Windows, Macro Time Events, Macro Time Patterns, Macro Time Anomalies, Macro Time Seasonality, Macro Time Calendar Effects, Macro Time Economic Events, Macro Time Market Sentiment, Macro Time Volatility, Macro Time Liquidity, Macro Time Momentum, Macro Time Reversals, Macro Time Breakouts, Macro Time Pullbacks, Macro Time Continuations, Macro Time Reversals, Macro Time Volatility Breakouts, Macro Time Momentum Breakouts, Macro Time Liquidity Breakouts, Macro Time Risk Management Breakouts, Macro Time Trade Timing Breakouts, Macro Time Seasonal Breakouts, Macro Time Calendar Breakouts, Macro Time Behavioral Breakouts, Macro Time Market Microstructure Breakouts, Macro Time Order Flow Breakouts, Macro Time Volume Breakouts, Macro Time Price Action Breakouts, Macro Time Trend Breakouts, Macro Time Mean Reversion Breakouts, Macro Time Pullback Breakouts, Macro Time Continuation Breakouts, Macro Time Reversal Breakouts, Macro Time Volatility Breakdowns, Macro Time Momentum Breakdowns, Macro Time Liquidity Breakdowns, Macro Time Risk Management Breakdowns, Macro Time Trade Timing Breakdowns, Macro Time Seasonal Breakdowns, Macro Time Calendar Breakdowns, Macro Time Behavioral Breakdowns, Macro Time Market Microstructure Breakdowns, Macro Time Order Flow Breakdowns, Macro Time Volume Breakdowns, Macro Time Price Action Breakdowns, Macro Time Trend Breakdowns, Macro Time Mean Reversion Breakdowns, Macro Time Pullback Breakdowns, Macro Time Continuation Breakdowns, Macro Time Reversal Breakdowns

VISION RULES:
### Seasonal Tendencies
**Matches:** 3 entries
**Types:** timing, concept, pattern
**What to detect:**
  - Identifies potential long-term directional bias based on historical patterns
  - Detects long-term directional probabilities based on historical seasonal patterns.
  - Detects recurring price patterns based on calendar time
**Focus areas:**
  - Historical price action over specific periods (months/quarters)
  - Market context and overall cycle
  - Strategic timeframe alignment
  - Current seasonal tendencies
  - Specific time periods (month/quarter)
  - Historical probabilities for directional movement
  - Asset
  - Time of year (months/quarters)
  - Historical price performance
**When applicable:**
  - When establishing a higher timeframe directional bias or seeking confluence for strategic positioning.
  - When seeking a long-term directional bias or identifying potential high/low of the year based on historical calendar patterns.
  - When establishing long-term market bias or macro timing insights
**Not applicable:**
  - For precise short-term entry or exit signals, or during periods dominated by extreme, news-driven market events.
  - When looking for precise short-term entry timing or intraday reversals.
  - For short-term trading signals or precise entry/exit timing

### Economic Calendar
**Matches:** 2 entries
**Types:** concept, timing
**What to detect:**
  - News Event Identifier
  - Identifies scheduled economic events and their potential market impact for a given date.
**Focus areas:**
  - Medium and high impact events
  - Coming week
  - Event date and time
  - Event name and category (e.g., CPI, NFP)
  - Impact level (High, Medium, Low)
**When applicable:**
  - For trade preparation at the start of the week
  - Before market open to anticipate potential volatility and directional bias, or when planning trades around high-impact news events.
**Not applicable:**
  - During live trade execution or entry specific decisions
  - During periods of no significant scheduled economic events, or when market analysis is purely technical and disregards fundamental drivers.

### Seasonal Influences
**Matches:** 1 entries
**Types:** timing
**What to detect:**
  - Seasonal Market Timer
**Focus areas:**
  - Seasonal patterns
  - Bullish/Bearish months
  - Trading year divisions
**When applicable:**
  - When determining a long-term directional bias or strategic timing windows based on recurring historical seasonal data.
**Not applicable:**
  - For short-term price action analysis, during periods of extreme market volatility, or when strong fundamental news overrides historical seasonal tendencies.


RETRIEVAL TEMPLATES:
### Seasonal Tendencies
**9 query templates:**
  - How do seasonal tendencies impact the market's long-term direction?
  - What are the historical seasonal patterns for [asset] during [month/quarter]?
  - Can seasonal tendencies be used to determine market bias and major turns?
  - What are the seasonal tendencies for [asset]?
  - How do seasonal tendencies influence price action in [month/quarter]?
  - Identify historical seasonal patterns for high/low of the year.
  - What are the seasonal tendencies for [asset]?
  - How does seasonality affect [asset] prices?
  - When is the best time to buy/sell [asset] based on seasonal patterns?

### Economic Calendar
**6 query templates:**
  - Economic calendar for coming week
  - Medium and high impact events
  - Weekly economic profile
  - What are the major economic news releases for [date]?
  - How does the economic calendar affect price action on [date]?
  - Retrieve the economic calendar details for [today/upcoming week].

### Seasonal Influences
**3 query templates:**
  - What are the significant seasonal influences on stock trading?
  - Identify the historically bullish and bearish months for stock trading.
  - How is the trading year typically divided by seasonal patterns?


REASONING SIGNALS:
### Seasonal Tendencies
**Expected signals:**
  - Probable long-term bullish or bearish bias for a given seasonal period.
  - Probabilistic long-term directional bias for a specific period.
  - Indication of typical periods of strength or weakness for an asset

### Economic Calendar
**Expected signals:**
  - List of significant upcoming economic events
  - Outputs a list of upcoming economic events with their scheduled time, impact level, and relevant market(s).

### Seasonal Influences
**Expected signals:**
  - Outputs historically favorable or unfavorable seasonal trading periods for stocks.


INTERPRETATION GUIDELINES:
- Identify macro regime patterns using vision rules above
- Focus on expansion vs contraction and directional bias
- Map principles onto chart context
- Derive analysis from grounded knowledge FIRST, then validate with chart evidence
- Do NOT generate entry signals
```

