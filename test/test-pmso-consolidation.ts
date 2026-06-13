import { runMasterOrchestrator } from "../core/3.query/orchestrators/master-orchestrator.js";

async function runTests() {
  console.log("=== Testing Consolidated PMSO Architecture ===\n");

  // TEST 1: Facts aggregation and PMSO build
  console.log("--- TEST 1: Facts aggregation ---");
  const factInput = {
    time: { trading_window: "active" },
    htf: {
      facts: [
        { type: "confirmed_sweep", confidence: 0.9, anchor: "Previous Day High", timeframe: "DAILY" },
        { type: "observed_fvg", confidence: 0.85, anchor: "Daily Premium FVG", timeframe: "DAILY" },
        { type: "possible_bearish_mss", confidence: 0.6, anchor: "H4 Structure", timeframe: "DAILY" }
      ]
    },
    itf: { facts: [] },
    ltf: { 
      facts: [
        { type: "possible_mss", confidence: 0.7, anchor: "M15 Swing High", timeframe: "M15" }
      ]
    },
    memory: { theses: {} }
  };

  let res1 = await runMasterOrchestrator(factInput as any);
  console.log("PMSO HTF Bias:", (res1 as any)._pmso.market_context.htf_bias.value);
  console.log("PMSO HTF Confidence:", (res1 as any)._pmso.market_context.htf_bias.confidence.toFixed(2));
  console.log("Notes:\n", res1.notes, "\n");

  // TEST 2: Tension/Contradiction Handling
  console.log("--- TEST 2: High Tension (Bullish HTF vs Bearish Facts) ---");
  const tensionInput = {
    time: { trading_window: "active" },
    htf: {
      facts: [
        { type: "bullish_displacement", confidence: 0.9, anchor: "Weekly Low", timeframe: "DAILY" },
        { type: "bearish_sweep", confidence: 0.8, anchor: "Daily High", timeframe: "DAILY" }
      ]
    },
    itf: { facts: [] },
    ltf: { facts: [] },
    memory: { theses: {} }
  };

  let res2 = await runMasterOrchestrator(tensionInput as any);
  console.log("PMSO Contradiction Score:", (res2 as any)._pmso.tensions.contradiction_score.toFixed(2));
  console.log("PMSO HTF Bias:", (res2 as any)._pmso.market_context.htf_bias.value);
  console.log("Notes:\n", res2.notes, "\n");
}

runTests().catch(console.error);
