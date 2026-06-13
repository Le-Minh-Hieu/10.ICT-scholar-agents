# Task A — Input / Output Alignment Audit

This audit evaluates the semantic alignment between input pipeline concepts, vision-extracted facts, and output schemas for each agent in the system hierarchy.

---

## Agent-by-Agent Alignment Analysis

### 1. Quarterly Agent
* **Current Inputs (19 concepts)**: Quarterly Bias, Quarterly Seasonality, Quarterly profile, End-of-Quarter Effect, Turn-of-Quarter Effect, First Trading Day Effect, Last Trading Day Effect, Options Expiry Effect, Quarterly Market Sentiment Shifts, Quarterly Economic Data Releases, Quarterly Options Expiry, Quarterly Buy Day Bias, Quarterly Sell Day Bias, End-of-Quarter Reversal, Turn-of-Quarter Reversal, First Trading Day Reversal, Last Trading Day Reversal, Options Expiry Reversal, NFP Reversal.
* **Current Vision Facts**: Quarterly Shift, Dealing Range, IPDA Range, HTF FVG, Monthly FVG, Order Block, Premium / Discount / Equilibrium, Opening Range.
* **Current Outputs (timing_bias, trading_window, expectation, confidence, notes)**: Accumulation, Re-accumulation, Consolidation, Manipulation, Reversal, Expansion, Distribution, Re-distribution, Retracement.
* **Vocabulary Overlap %**: **15.4%**
* **Dead Concepts (Input but never used/referenced)**: Options Expiry Effect, Quarterly Options Expiry, Last Trading Day Effect, Turn-of-Quarter Effect, First Trading Day Effect.
* **Concepts Present in Output but Missing in Input**: Accumulation, Re-accumulation, Manipulation, Distribution, Re-distribution, Retracement, Premium / Discount.
* **Concepts Present in Input but Missing in Output**: Seasonality, Options Expiry, NFP Event, Economic Data.
* **Alignment Score Calculation**:
  * Shared Concepts: `Reversal` (from "End-of-Quarter Reversal"), `Bias` (from "Quarterly Bias" and "timing_bias"), `profile` (from "Quarterly profile"). (3 shared concepts)
  * Total Unique Concepts: 19 (input) + 10 (output unique) = 29.
  * **Alignment Score**: $3 / 29 \approx \mathbf{0.103}$ (**10.3%**)

### 2. Monthly Agent
* **Current Inputs (18 concepts)**: Monthly Bias, Monthly Seasonality, Monthly profile, End-of-Month Effect, Turn-of-Month Effect, First Trading Day Effect, Last Trading Day Effect, Options Expiry Effect, Monthly Market Sentiment Shifts, Monthly Economic Data Releases, Monthly Options Expiry, Monthly Buy Day Bias, Monthly Sell Day Bias, End-of-Month Reversal, Turn-of-Month Reversal, First Trading Day Reversal, Last Trading Day Reversal, Options Expiry Reversal.
* **Current Vision Facts**: Monthly Range, Monthly Dealing Range, Monthly FVG, Weekly Order Block, Premium / Discount / Equilibrium, Opening Range, Seasonal Tendency.
* **Current Outputs**: Accumulation, Re-accumulation, Consolidation, Manipulation, Reversal, Expansion, Distribution, Re-distribution, Retracement.
* **Vocabulary Overlap %**: **14.8%**
* **Dead Concepts**: Options Expiry Effect, Monthly Options Expiry, Last Trading Day Effect, Turn-of-Month Effect, First Trading Day Effect.
* **Concepts Present in Output but Missing in Input**: Accumulation, Re-accumulation, Manipulation, Distribution, Re-distribution, Retracement, Premium / Discount.
* **Concepts Present in Input but Missing in Output**: Seasonality, Options Expiry, Economic Data.
* **Alignment Score Calculation**:
  * Shared Concepts: `Reversal`, `Bias`, `profile`. (3 shared concepts)
  * Total Unique Concepts: 18 (input) + 10 (output unique) = 28.
  * **Alignment Score**: $3 / 28 \approx \mathbf{0.107}$ (**10.7%**)

### 3. Weekly Agent
* **Current Inputs (61 concepts)**: Weekly Buy Day Bias, Weekly Sell Day Bias, Weekly profile, Weekend Effect, End-of-Week Effect, Weekly Options Expiry, Weekly Economic Data Releases, Weekly Market Sentiment Shifts, Weekly Volatility Patterns, Weekly Momentum Patterns, Weekly Reversal Patterns, Weekly Liquidity Patterns, Weekly Risk Management Patterns, Weekly Trade Timing Patterns, Weekly Seasonal Patterns, Weekly Calendar Effects, Weekly Behavioral Patterns, Weekly Market Microstructure Patterns, Weekly Order Flow Patterns, Weekly Volume Patterns, Weekly Price Action Patterns, Weekly Trend Patterns, Weekly Mean Reversion Patterns, Weekly Breakout Patterns, Weekly Pullback Patterns, Weekly Continuation Patterns, Weekly Reversal Patterns, Weekly Volatility Breakout/Breakdown, etc.
* **Current Vision Facts**: None (pure Lane 0).
* **Current Outputs**: Accumulation, Re-accumulation, Consolidation, Manipulation, Reversal, Expansion, Distribution, Re-distribution, Retracement.
* **Vocabulary Overlap %**: **4.8%**
* **Dead Concepts**: 46 of 61 concepts are truncated and never evaluated (due to `MAX_QUERY = 15` truncation).
* **Concepts Present in Output but Missing in Input**: Accumulation, Re-accumulation, Consolidation, Manipulation, Distribution, Re-distribution, Retracement.
* **Concepts Present in Input but Missing in Output**: Volatility Patterns, Momentum Patterns, Liquidity Patterns, Order Flow, Volume, Price Action.
* **Alignment Score Calculation**:
  * Shared Concepts: `Reversal` (from "Weekly Reversal Patterns"), `Bias` (from "Weekly Buy Day Bias" and "timing_bias"), `profile` (from "Weekly profile"). (3 shared concepts)
  * Total Unique Concepts: 61 (input) + 9 (output unique) = 70.
  * **Alignment Score**: $3 / 70 \approx \mathbf{0.043}$ (**4.3%**)

### 4. Daily Agent
* **Current Inputs (73 concepts)**: intraday bias, intraday seasonality, intraday profile, daily_time_profile, 15M Chart, News Embargo Lift Timing, No-Trade Day, Kill Zones, Silver Bullet Hour, NY OTE Time Window, Optimal Trade Entry (OTE), Midnight-2AM Window, Time & Day Analysis, Temporal Projection Window, New York Expansion, PM Trend Timing, AM Decline PM Reversal, and 56 daily volatility/breakout/breakdown patterns.
* **Current Vision Facts**: None (pure Lane 0).
* **Current Outputs**: Accumulation, Re-accumulation, Consolidation, Manipulation, Reversal, Expansion, Distribution, Re-distribution, Retracement.
* **Vocabulary Overlap %**: **5.1%**
* **Dead Concepts**: 58 of 73 concepts are truncated and never evaluated (due to `MAX_QUERY = 15` truncation).
* **Concepts Present in Output but Missing in Input**: Accumulation, Re-accumulation, Consolidation, Manipulation, Distribution, Re-distribution, Retracement.
* **Concepts Present in Input but Missing in Output**: Kill Zones, Silver Bullet Hour, Optimal Trade Entry, 15M Chart, news embargo.
* **Alignment Score Calculation**:
  * Shared Concepts: `Reversal` (from "AM Decline PM Reversal"), `Bias` (from "intraday bias" and "timing_bias"), `profile` (from "intraday profile"), `OTE` / `Optimal Trade Entry` (in notes). (4 shared concepts)
  * Total Unique Concepts: 73 (input) + 9 (output unique) = 82.
  * **Alignment Score**: $4 / 82 \approx \mathbf{0.049}$ (**4.9%**)

### 5. Session Agent
* **Current Inputs (29 concepts)**: NWOG, NDOG, Morning Session Setups, London Open Kill Zone, London Session, Session Timing, Midnight Open, Morning Session, Afternoon Session, Asian Open, London Close Killzone, Market Open, New York Session, New York Close Killzone, Sydney Session, Tokyo Session, European Session, US Session, Overnight Session, Pre-Market Session, After-Hours Session, Intraday Session Timing, Session-Specific Setups, Session-Based Liquidity Patterns, Session-Specific Volatility Patterns, Session-Specific Market Behavior, Silver Bullet Hour, Kill Zones, Optimal Trade Entry (OTE) Timing.
* **Current Vision Facts**: None (pure Lane 0).
* **Current Outputs**: Accumulation, Re-accumulation, Consolidation, Manipulation, Reversal, Expansion, Distribution, Re-distribution, Retracement.
* **Vocabulary Overlap %**: **13.8%**
* **Dead Concepts**: 14 of 29 concepts are truncated and never evaluated (due to `MAX_QUERY = 15` truncation).
* **Concepts Present in Output but Missing in Input**: Accumulation, Re-accumulation, Consolidation, Manipulation, Distribution, Re-distribution, Retracement.
* **Concepts Present in Input but Missing in Output**: NWOG, NDOG, London Session, New York Session, Asian Open, Session Timing, Kill Zones.
* **Alignment Score Calculation**:
  * Shared Concepts: `Bias` (from "timing_bias" output matching input session context), `Reversal` (via note references to session reversals). (2 shared concepts)
  * Total Unique Concepts: 29 (input) + 10 (output unique) = 39.
  * **Alignment Score**: $2 / 39 \approx \mathbf{0.051}$ (**5.1%**)

---

## Alignment Score Rankings

Lower layer agents (Weekly, Daily, Session) rank significantly worse due to:
1. Massive concept inflation in the input pipeline (e.g. 61 and 73 concepts).
2. Hard query truncation at `MAX_QUERY = 15` which leaves 75%+ of inputs completely dead.
3. Persistent vocabulary mismatch where lower layers reason using outdated calendar terms, while output schemas expect structural market phases.

| Rank | Agent | Alignment Score | Status |
| :--- | :--- | :--- | :--- |
| **1** | **Monthly Agent** | **10.7%** (0.107) | Best Aligned |
| **2** | **Quarterly Agent** | **10.3%** (0.103) | Moderately Aligned |
| **3** | **Session Agent** | **5.1%** (0.051) | Poorly Aligned |
| **4** | **Daily Agent** | **4.9%** (0.049) | Poorly Aligned |
| **5** | **Weekly Agent** | **4.3%** (0.043) | Worst Aligned |
