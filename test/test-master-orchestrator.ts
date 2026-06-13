import { runMasterOrchestrator } from "../core/3.query/orchestrators/master-orchestrator.js";

async function runTests() {
  console.log("=== Testing Master Orchestrator ===\n");

  // TEST 1: Perfect Alignment
  console.log("--- TEST 1: Perfect Alignment ---");
  const perfectInput = {
    time: {
      trading_window: "active",
      timing_bias: "favorable",
      expectation: "expansion",
      narrative: "Session is active and aligned."
    },
    htf: {
      htf_bias: "bullish",
      next_candle_bias: "bullish",
      confidence: "high"
    },
    itf: {
      itf_bias: "bullish",
      entry_bias: "bullish",
      setup_type: "continuation",
      valid: true
    },
    ltf: {
      execute: true,
      direction: "bullish",
      entry: "1.0500 FVG",
      confluence_score: 3
    }
  };

  let res1 = await runMasterOrchestrator(perfectInput);
  console.log("Execute:", res1.execute);
  console.log("Direction:", res1.direction);
  console.log("Notes:\n", res1.notes, "\n");

  // TEST 2: Time Gate Override
  console.log("--- TEST 2: Time Inactive (Soft Override Test) ---");
  const inactiveInput = {
    ...perfectInput,
    time: {
      trading_window: "inactive",
      narrative: "Outside of killzones."
    }
  };

  let res2 = await runMasterOrchestrator(inactiveInput);
  console.log("Execute:", res2.execute);
  console.log("State:", res2.state);
  console.log("Notes:\n", res2.notes, "\n");

  // TEST 3: Conflict (HTF Bearish, LTF Bullish)
  console.log("--- TEST 3: Conflict (HTF vs LTF) ---");
  const conflictInput = {
    time: {
      trading_window: "active"
    },
    htf: {
      htf_bias: "bearish"
    },
    itf: {
      itf_bias: "bearish",
      setup_type: "none"
    },
    ltf: {
      execute: true,
      direction: "bullish",
      entry: "1.0450 MSS"
    }
  };

  let res3 = await runMasterOrchestrator(conflictInput);
  console.log("Execute:", res3.execute);
  console.log("State:", res3.state);
  console.log("Notes:\n", res3.notes, "\n");
}

runTests().catch(console.error);