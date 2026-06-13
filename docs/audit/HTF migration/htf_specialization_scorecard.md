# HTF SPECIALIZATION SCORECARD — POST-MIGRATION

**Auditor Role:** Senior Systems Auditor  
**Date:** 2026-06-12  
**Scope:** Computation of specialization scores and classification for the 4 HTF agents.  
**Mandate:** EVIDENCE ONLY.

---

## 1. SPECIALIZATION SCORE FORMULA

$$\text{Specialization Score} = \frac{\text{Unique Agent-Owned Concepts Used}}{\text{Total Concepts Used}}$$

### Classification Scale:
*   **0% – 30%:** Generic Price Agent (Fails to establish specialized identity)
*   **31% – 60%:** Partially Specialized (Domain-aware but exhibits concept drift)
*   **61% – 100%:** Strongly Specialized (Clear domain isolation and ownership)

---

## 2. AGENT SCORECARDS

### 1. HTF Macro Agent
*   **Agent-Owned Concepts Used:** DXY displacement, Yield displacement, Yield correlation, EURUSD inverse correlation, intermarket confirmation. (5 concepts)
*   **Total Concepts Used:** DXY/Yield displacement, correlation, EURUSD inverse correlation, intermarket confirmation, swing highs/lows (as reference), FVG (as reference). (7 concepts)
*   **Specialization Score:** 5 / 7 = **71.4%**
*   **Classification:** **Strongly Specialized**
*   **Assessment:** Effectively isolates macro-economic and intermarket variables from standard candle patterns.

### 2. HTF Structure Agent
*   **Agent-Owned Concepts Used:** MSS, BOS, SMT divergence, breaker block. (4 concepts)
*   **Total Concepts Used:** MSS, BOS, SMT, breaker block, swing highs/lows, order_block, FVG. (7 concepts)
*   **Specialization Score:** 4 / 7 = **57.1%**
*   **Classification:** **Partially Specialized**
*   **Assessment:** Minor dilution occurs due to the extraction of FVG and Order Blocks as structural facts. While MSS/BOS and Breakers dominate, FVG and OB are technically PD Arrays owned by the PD Array Agent.

### 3. HTF Liquidity Agent
*   **Agent-Owned Concepts Used:** Buy-side Liquidity (BSL), Sell-side Liquidity (SSL), Sweeps, Liquidity Voids, Imbalance Zones, Delivery Gaps. (6 concepts)
*   **Total Concepts Used:** BSL, SSL, sweeps, voids, imbalances, gaps, swing highs/lows (as reference). (7 concepts)
*   **Specialization Score:** 6 / 7 = **85.7%**
*   **Classification:** **Strongly Specialized**
*   **Assessment:** Extremely focused on locating resting liquidity and sweeps. It does not attempt to analyze MSS or calculate Equilibrium.

### 4. HTF PD Array Agent
*   **Agent-Owned Concepts Used:** Dealing range boundaries, Equilibrium calculation, Premium, Discount, PD Matrix Hierarchy. (5 concepts)
*   **Total Concepts Used:** Range boundaries, equilibrium, premium, discount, PD matrix hierarchy, OB, FVG, VI. (8 concepts)
*   **Specialization Score:** 5 / 8 = **62.5%**
*   **Classification:** **Strongly Specialized**
*   **Assessment:** Successfully calculated equilibrium and mapped zone status. The presence of OB, FVG, and VI as secondary references causes minor score reduction, but this is mathematically expected and structurally valid as they serve only to confirm zone position.

---

## 3. SUMMARY SCORECARD TABLE

| Agent | Domain | Specialization Score | Classification |
| :--- | :--- | :--- | :--- |
| **HTF Macro Agent** | Macro / Intermarket | **71.4%** | Strongly Specialized |
| **HTF Structure Agent** | MSS / BOS / SMT | **57.1%** | Partially Specialized |
| **HTF Liquidity Agent** | BSL / SSL / Sweeps | **85.7%** | Strongly Specialized |
| **HTF PD Array Agent** | Dealing Range / Equilibrium | **62.5%** | Strongly Specialized |
