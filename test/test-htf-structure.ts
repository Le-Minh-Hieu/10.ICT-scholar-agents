import { htfStructureAgent } from "../core/3.query/agents/htf/htf-structure-agent.js";
import fs from "fs";

async function runTest() {

  const session = "data/session_1777142030934";
  const eurusd = {
    d: `${session}/EURUSD/1D.jpg`,
    w: `${session}/EURUSD/1W.jpg`,
    m: `${session}/EURUSD/1MO.jpg`
  };

  const gbpusd = {
    d: `${session}/GBPUSD/1D.jpg`,
    w: `${session}/GBPUSD/1W.jpg`,
    m: `${session}/GBPUSD/1MO.jpg`
  };

  // 🔥 VALIDATION
  if (!fs.existsSync(eurusd.d)) {
    console.error("Primary image not found:", eurusd.d);
    return;
  }

  console.log("Starting HTF Structure Agent Test...");

  try {
    const result = await htfStructureAgent({
      eurusd,
      gbpusd: fs.existsSync(gbpusd.d) ? gbpusd : undefined
    }, {} as any);

    console.log("\n[FINAL AGENT OUTPUT]");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error during test execution:", error);
  }
}

runTest().catch(console.error);
