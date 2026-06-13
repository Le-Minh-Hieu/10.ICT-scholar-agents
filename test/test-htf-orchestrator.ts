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

  const dxy = {
    d: `${session}/DXY/1D.jpg`,
    w: `${session}/DXY/1W.jpg`,
    m: `${session}/DXY/1MO.jpg`
  };

  const us10y = {
    d: `${session}/US10Y/1D.jpg`,
    w: `${session}/US10Y/1W.jpg`,
    m: `${session}/US10Y/1MO.jpg`
  };

  const us20y = {
    d: `${session}/US20Y/1D.jpg`,
    w: `${session}/US20Y/1W.jpg`,
    m: `${session}/US20Y/1MO.jpg`
  };

  // 🔥 VALIDATION
  if (!fs.existsSync(eurusd.d)) {
    console.error("❌ Primary image not found:", eurusd.d);
    return;
  }

  console.log("====================================");
  console.log("🚀 STARTING HTF PIPELINE TEST");
  console.log("====================================");

  try {

    const result = await runHTFOrchestrator({
      eurusd: {
        d: eurusd.d,
        w: eurusd.w,
        m: eurusd.m
      },
      gbpusd: fs.existsSync(gbpusd.d) ? gbpusd : undefined,
      dxy: fs.existsSync(dxy.d) ? dxy : undefined,
      us10y: fs.existsSync(us10y.d) ? us10y : undefined,
      us20y: fs.existsSync(us20y.d) ? us20y : undefined
    }, {} as any);

    console.log("\n================ FINAL OUTPUT ================");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("❌ Error during HTF pipeline test:", error);
  }

  console.log("\n====================================");
  console.log("✅ TEST FINISHED");
  console.log("====================================");
}

runTest().catch(console.error);
