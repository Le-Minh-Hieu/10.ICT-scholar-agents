import { itfStructureAgent } from "../core/3.query/agents/itf/itf-structure-agent";
import fs from "fs";

async function runTest() {

    const session = "D:\\10. ict-scholar-agents-V1\\data\\session_1777142030934";

    // 🔥 ITF TIMEFRAMES
    const eurusd = {
        h4: `${session}\\EURUSD\\4H.jpg`,
        h1: `${session}\\EURUSD\\1H.jpg`,
        m15: `${session}\\EURUSD\\15m.jpg`
    };

    const gbpusd = {
        h4: `${session}\\GBPUSD\\4H.jpg`,
        h1: `${session}\\GBPUSD\\1H.jpg`,
        m15: `${session}\\GBPUSD\\15m.jpg`
    };

    // 🔥 MOCK HTF CONTEXT (bắt buộc)
    const htf = {
        htf_bias: "bullish" as const,
        next_candle_bias: "bearish" as const,
        confidence: "medium" as const,
        reasoning: "HTF bullish but in premium"
    };

    // 🔥 VALIDATION
    if (!fs.existsSync(eurusd.h4)) {
        console.error("❌ ITF image not found:", eurusd.h4);
        return;
    }

    console.log("====================================");
    console.log("🚀 STARTING ITF STRUCTURE TEST");
    console.log("====================================");

    try {

        const result = await itfStructureAgent({
            eurusd,
            gbpusd: fs.existsSync(gbpusd.h4) ? gbpusd : undefined,
            htf
        });

        console.log("\n================ FINAL OUTPUT ================");
        console.log(JSON.stringify(result, null, 2));

        console.log("\n================ CORE ================");
        console.log("Structure:", result.structure_trend);
        console.log("SMT:", result.smt_signal);
        console.log("Strength:", result.structure_strength);

        console.log("\n================ REASONING ================");
        console.log(result.notes);

    } catch (error) {
        console.error("❌ Error during ITF test:", error);
    }

    console.log("\n====================================");
    console.log("✅ TEST FINISHED");
    console.log("====================================");
}

runTest().catch(console.error);
