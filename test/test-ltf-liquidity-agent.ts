import { ltfLiquidityAgent } from "../core/3.query/agents/ltf/ltf-liquidity-agent";
import fs from "fs";

async function runTest() {

    const session = "D:\\10. ict-scholar-agents-V1\\data\\session_1777142030934";

    const eurusd = {
        m15: `${session}\\EURUSD\\15m.jpg`,
        m5: `${session}\\EURUSD\\5m.jpg`,
        m1: `${session}\\EURUSD\\1m.jpg`
    };

    const htf = {
        htf_bias: "bullish" as const,
        next_candle_bias: "bullish" as const,
        confidence: "medium" as const,
        reasoning: "HTF bullish continuation"
    };

    const itf = {
        structure_trend: "bullish" as const,
        structure_strength: "medium" as const,
        smt_signal: "none" as const
    };

    console.log("DEBUG INPUT:", { htf, itf });

    const result = await ltfLiquidityAgent({
        eurusd,
        htf,
        itf
    });

    console.log(JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
}

runTest();