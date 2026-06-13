import { htfPDArrayAgent } from "../core/3.query/agents/htf/htf-pd-array-agent.js";
import fs from "fs";

async function runTest() {
  const session = "data/session_1777142030934";

  const eurusd = {
    d: `${session}/EURUSD/1D.jpg`,
    w: `${session}/EURUSD/1W.jpg`,
    m: `${session}/EURUSD/1MO.jpg`
  };

  if (!fs.existsSync(eurusd.d)) {
    console.error("EURUSD primary image not found:", eurusd.d);
    return;
  }

  console.log("Starting HTF PD Array Agent Test...");

  try {
    const result = await htfPDArrayAgent({
      eurusd: {
        d: eurusd.d,
        w: eurusd.w,
        m: eurusd.m
      }
    }, {} as any);

    console.log("\n[FINAL PD ARRAY OUTPUT]");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error during PD array test execution:", error);
  }
}

runTest().catch(console.error);
