import { runHTFOrchestrator } from "../core/3.query/orchestrators/htf-orchestrator.js";
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

  if (!fs.existsSync(eurusd.d)) {
    console.error("EURUSD primary image not found:", eurusd.d);
    return;
  }

  console.log("Starting HTF FULL System Test...");

  try {
    const result = await runHTFOrchestrator({
      eurusd: {
        d: eurusd.d,
        w: eurusd.w,
        m: eurusd.m
      },
      gbpusd: fs.existsSync(gbpusd.d) ? gbpusd : undefined
    }, {} as any);

    console.log("\n[HTF FULL OUTPUT]");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error during HTF Full test execution:", error);
  }
}

runTest().catch(console.error);
