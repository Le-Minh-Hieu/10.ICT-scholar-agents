import { itfPDArrayAgent } from "../core/3.query/agents/itf/itf-pd-array-agent";
import fs from "fs";

async function runTest() {
  const session = "D:\\10. ict-scholar-agents-V1\\data\\session_1777142030934";

  const eurusd = {
    h4: `${session}\\EURUSD\\4H.jpg`,
    h1: `${session}\\EURUSD\\1H.jpg`,
    m15: `${session}\\EURUSD\\15m.jpg`
  };

  const htf = {
    htf_bias: "bullish" as const,
    next_candle_bias: "bearish" as const,
    confidence: "medium" as const,
    reasoning: "HTF bullish but in premium"
  };

  if (!fs.existsSync(eurusd.h4)) {
    console.error("❌ ITF image not found:", eurusd.h4);
    return;
  }

  console.log("====================================");
  console.log("🚀 STARTING ITF PD ARRAY TEST");
  console.log("====================================");

  try {
    const result = await itfPDArrayAgent({
      eurusd,
      htf
    } as any, {});

    console.log("\n================ FINAL OUTPUT ================");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Error during ITF PD Array test:", error);
  }

  console.log("\n====================================");
  console.log("✅ TEST FINISHED");
  console.log("====================================");
}

runTest().catch(console.error);
