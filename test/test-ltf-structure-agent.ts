import { ltfStructureAgent } from "../core/3.query/agents/ltf/ltf-structure-agent";
import fs from "fs";

async function runTest() {

    const session = "D:\\10. ict-scholar-agents-V1\\data\\session_1777142030934";

    // 🔥 LTF TIMEFRAMES
    const eurusd = {
        m15: `${session}\\EURUSD\\15m.jpg`,
        m5: `${session}\\EURUSD\\5m.jpg`,
        m1: `${session}\\EURUSD\\1m.jpg`
    };

    // 🔥 MOCK HTF CONTEXT
    const htf = {
        htf_bias: "bullish" as const,
        next_candle_bias: "bullish" as const,
        confidence: "medium" as const,
        reasoning: "HTF bullish, looking for continuation"
    };

    // 🔥 MOCK ITF CONTEXT
    const itf = {
        structure_trend: "bullish" as const,
        structure_strength: "medium" as const,
        smt_signal: "none" as const
    };

    // 🔥 VALIDATION
    if (!fs.existsSync(eurusd.m15)) {
        console.error("❌ LTF image not found:", eurusd.m15);
        return;
    }

    console.log("====================================");
    console.log("🚀 STARTING LTF STRUCTURE TEST");
    console.log("====================================");

    try {
        console.log("DEBUG TEST INPUT:", { eurusd, htf, itf });

        const result = await ltfStructureAgent({
            eurusd,
            htf,
            itf
        });

        console.log("\n================ FINAL OUTPUT ================");
        console.log(JSON.stringify(result, null, 2));

        console.log("\n================ CORE ================");
        console.log("State:", result.structure_state);
        console.log("Strength:", result.structure_strength);

        console.log("\n================ REASONING ================");
        console.log(result.reasoning);

    } catch (error) {
        console.error("❌ Error during LTF test:", error);
    }

    console.log("\n====================================");
    console.log("✅ TEST FINISHED");
    console.log("====================================");
}

runTest().catch(console.error);