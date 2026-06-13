
import { runMasterOrchestrator } from '../core/3.query/orchestrators/master-orchestrator';
import fs from 'fs';

async function runTest() {
  const session = "D:\\10. ict-scholar-agents-V1\\data\\session_1777142030934";

  const eurusd = {
    d: `${session}\\EURUSD\\1D.jpg`,
    w: `${session}\\EURUSD\\1W.jpg`,
    m: `${session}\\EURUSD\\1MO.jpg`,
    h4: `${session}\\EURUSD\\4H.jpg`,
    h1: `${session}\\EURUSD\\1H.jpg`,
    m15: `${session}\\EURUSD\\15M.jpg`,
    m5: `${session}\\EURUSD\\5M.jpg`,
    m1: `${session}\\EURUSD\\1M.jpg`
  };

  const gbpusd = {
    d: `${session}\\GBPUSD\\1D.jpg`,
    w: `${session}\\GBPUSD\\1W.jpg`,
    m: `${session}\\GBPUSD\\1MO.jpg`,
    h4: `${session}\\GBPUSD\\4H.jpg`,
    h1: `${session}\\GBPUSD\\1H.jpg`,
    m15: `${session}\\GBPUSD\\15M.jpg`,
    m5: `${session}\\GBPUSD\\5M.jpg`,
    m1: `${session}\\GBPUSD\\1M.jpg`
  };

  console.log("Starting Full System Stabilization Test...");

  try {
    const result = await runMasterOrchestrator({
      eurusd,
      gbpusd,
      query: "Analyze EURUSD for a potential long setup based on the current price action and confluence."
    });

    console.log("\n👑 [MASTER ORCHESTRATOR OUTPUT]");
    console.log(JSON.stringify(result, null, 2));

    // Specific Checks
    console.log("\n--- VERIFICATION ---");
    if (result.layers?.htf?.pdArray) {
        console.log("✅ Track A: HTF PD Array correctly mapped:", result.layers.htf.pdArray);
    } else {
        console.log("❌ Track A: HTF PD Array missing in public schema");
    }

    if (result.layers?.confluence?.strength !== undefined) {
        console.log("✅ Track C: Confluence Strength mapped:", result.layers.confluence.strength);
    } else {
        console.log("❌ Track C: Confluence Strength missing");
    }

    if (result._debug?.score_details) {
        console.log("✅ Track D: Scoring Traceability present.");
    } else {
        console.log("❌ Track D: Scoring Traceability missing.");
    }

  } catch (error) {
    console.error("Error during full system test:", error);
  }
}

runTest().catch(console.error);
