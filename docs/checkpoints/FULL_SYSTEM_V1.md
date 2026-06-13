# FULL SYSTEM V1 (LOCKED)

## CORE PRINCIPLE

HTF = Bias  
ITF = Setup  
LTF = Execution  
SPECIAL = Context (Time / Swing)

---

## HTF (Bias Layer)

- pda-agent
- delivery-state-agent
- ote-agent

Output:
→ Market bias (Bullish / Bearish)
→ Context only (NOT entry)

---

## ITF (Setup Layer)

- market_structure
- smt_forex
- algo_gap
- amd_power_of_3
- short_term_ipda
- trading_plan

Output:
→ Trade idea
→ Setup context
→ Direction refinement

---

## LTF (Execution Layer)

- chart_models
- ote_entry
- risk_execution
- (optional) daytrade_setup

Output:
→ Entry
→ SL / TP
→ Execution decision

---

## SPECIAL (Context Layer)

- swing_trading
- time (macro / session / killzone)

Output:
→ Timing context
→ Higher-level positioning

---

## REMOVED / FUTURE

- live_review (VISION-based, discretionary)
→ Not used in V1

---

## RULES

- HTF NEVER decides entry
- LTF NEVER decides bias
- ITF bridges HTF → LTF
- SPECIAL never overrides core logic

---

## STATUS

STABLE V1
READY FOR ORCHESTRATION

---

## NEXT

- Build ITF orchestrator
- Then LTF execution orchestrator