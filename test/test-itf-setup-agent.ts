import { itfSetupAgent } from "../core/3.query/agents/itf/itf-setup-agent";
import fs from "fs";

async function runTest() {

  const session = "D:\\10. ict-scholar-agents-V1\\data\\session_1777142030934";

  // 🔥 ITF IMAGES (execution TF)
  const eurusd = {
    h1: `${session}\\EURUSD\\1H.jpg`,
    m15: `${session}\\EURUSD\\15m.jpg`,
    m5: `${session}\\EURUSD\\5m.jpg`
  };

  // 🔥 HTF CONTEXT
  const htf = {
    htf_bias: "bullish" as const,
    next_candle_bias: "bearish" as const,
    confidence: "medium" as const,
    reasoning: "HTF bullish but in premium, expecting pullback"
  };

  // 🔥 ITF STRUCTURE (output từ structure agent)
  const itf_structure = {
    structure_trend: "bullish" as const,
    structure_strength: "strong" as const,
    smt_signal: "none" as const
  };

  // 🔥 VALIDATION
  if (!fs.existsSync(eurusd.h1)) {
    console.error("❌ ITF image not found:", eurusd.h1);
    return;
  }

  console.log("====================================");
  console.log("🚀 STARTING ITF SETUP TEST");
  console.log("====================================");

  try {


const result = await itfSetupAgent({
  eurusd,
  htf,
  itf_structure
} as any); // cast nếu chưa update type

console.log("\n================ FINAL OUTPUT ================");
console.log(JSON.stringify(result, null, 2));

console.log("\n================ CORE ================");
console.log("Setup:", result.setup_type);
console.log("Bias:", result.entry_bias);
console.log("Confidence:", result.confidence);

console.log("\n================ REASONING ================");
console.log(result.notes);


  } catch (error) {
    console.error("❌ Error during ITF setup test:", error);
  }

  console.log("\n====================================");
  console.log("✅ TEST FINISHED");
  console.log("====================================");
}

runTest().catch(console.error);
