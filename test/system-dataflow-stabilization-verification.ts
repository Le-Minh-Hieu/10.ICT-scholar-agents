import { runSystem } from "../core/4.output/run-system.js";
import fs from "fs";

async function main() {
  console.log("--- SYSTEM DATAFLOW STABILIZATION VERIFICATION ---");

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

  const input = {
    eurusd: {
      d: eurusd.d,
      w: eurusd.w,
      m: eurusd.m
    }
  };

  try {
    const result = await runSystem(input, { debug: true });
    console.log("\n--- VERIFICATION RUN COMPLETE ---");
    if (result.execute) {
      console.log("✅ PASS: System produced a trade decision.");
    } else {
      console.log("✅ PASS: System did not produce a trade decision.");
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ FAIL: System run failed.", error);
  }
}

main();
