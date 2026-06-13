# Concept Utilization Audit

This audit tracks each concept originating from the **Vision Facts** layer (Lane 2) to determine if it was carried forward into Grounding, analyzed in Reasoning, and reflected in the Final Output schema.

---

## 1. Weekly-Agent Concept Utilization

| Concept (Vision Facts) | Vision | Grounding | Reasoning | Output | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Weekly Range (1.1680-1.1800)** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **Broader dealing range (1.1490-1.1830)** | YES | YES | YES | NO | **REASONING ONLY** |
| **Weekly FVG (1.1780-1.1820 / 1.1760-1.1780)** | YES | YES | NO | NO | **GROUNDING ONLY** |
| **Daily FVG (1.1700-1.1660)** | YES | YES | YES | NO | **REASONING ONLY** |
| **Daily Bearish OB (1.1800-1.1830)** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **Daily Bullish OB (1.1580-1.1600)** | YES | YES | NO | NO | **GROUNDING ONLY** |
| **Premium / Discount / Equilibrium** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **Opening Range** | YES | NO | NO | NO | **LOST** (No significant NWOG) |
| **H4 displacement** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **Swept Highs (1.1800-1.1820) / Lows (1.1680)** | YES | YES | YES | YES | **FULLY UTILIZED** |

---

## 2. Daily-Agent Concept Utilization

| Concept (Vision Facts) | Vision | Grounding | Reasoning | Output | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Daily Range (1.1670-1.1724)** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **Daily Dealing Range (1.1858-1.1666)** | YES | YES | YES | NO | **REASONING ONLY** |
| **Daily FVG (1.1820-1.1750)** | YES | YES | YES | NO | **REASONING ONLY** |
| **H4 FVG (1.1740-1.1770 / 1.1690-1.1715)** | YES | YES | YES | NO | **REASONING ONLY** |
| **Bullish H4 OB (1.1670-1.1680)** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **Bearish H4 Breaker (1.1780-1.1800)** | YES | YES | NO | NO | **GROUNDING ONLY** |
| **Premium / Discount (Discount Area)** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **NDOG / Opening Range (1.1680-1.1695)** | YES | YES | YES | NO | **REASONING ONLY** |
| **H1 Displacement ("energetic run")** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **Swept Highs (1.1700 / session highs)** | YES | YES | NO | NO | **GROUNDING ONLY** (No structure sweeps allowed) |

---

## 3. Session-Agent Concept Utilization

| Concept (Vision Facts) | Vision | Grounding | Reasoning | Output | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Intraday dealing range** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **London session dealing range** | YES | YES | YES | NO | **REASONING ONLY** |
| **M15 FVG (1.1670-1.1685 / 1.1700-1.1710)** | YES | YES | YES | NO | **REASONING ONLY** |
| **M5 FVG (displacement clusters)** | YES | YES | NO | NO | **GROUNDING ONLY** |
| **M15 OB (1.1670-1.1680 support)** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **M5 OB (1.1700-1.1705 retest)** | YES | YES | YES | NO | **REASONING ONLY** |
| **Premium / Discount (Premium zone)** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **Midnight Open (1.1680)** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **Asian Open range (1.1670-1.1700)** | YES | YES | YES | NO | **REASONING ONLY** |
| **London displacement (03:00-04:00 NY)** | YES | YES | YES | YES | **FULLY UTILIZED** |
| **Liquidity Sweeps (Asian highs/lows)** | YES | YES | NO | NO | **GROUNDING ONLY** (No liquidity sweeps allowed) |

---

## Utilization Summary Keys

*   **FULLY UTILIZED**: Present in Vision, referenced in Grounded RAG chunks, discussed in LLM Reasoning, and directly determined the Final Schema Output (e.g. Bias, Expectation).
*   **REASONING ONLY**: Present in Vision, RAG grounded, and used during the LLM's step-by-step notes reasoning, but does not map to a primary schema field.
*   **GROUNDING ONLY**: Present in Vision and Grounded context, but omitted during reasoning/output because other, higher-priority PD arrays dominated.
*   **LOST**: Bypassed or filtered out at early stages (e.g. due to absence of visual confirmation or constraints against trading logic).
