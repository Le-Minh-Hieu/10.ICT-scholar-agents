import { ltfTriggerAgent } from "../core/3.query/agents/ltf/ltf-trigger-agent";

async function runTest() {

    const session = "D:\\10. ict-scholar-agents-V1\\data\\session_1777142030934";

    // 🔥 LTF TIMEFRAMES
    const eurusd = {
        m15: `${session}\\EURUSD\\15m.jpg`,
        m5: `${session}\\EURUSD\\5m.jpg`,
        m1: `${session}\\EURUSD\\1m.jpg`
    };

    const htf = {
        htf_bias: "bullish" as const,
        next_candle_bias: "bullish" as const,
        confidence: "medium" as const,
        reasoning: "HTF bullish"
    };

    const itf = {
        structure_trend: "bullish" as const,
        structure_strength: "medium" as const,
        smt_signal: "none" as const
    };

    const structure = {
        structure_state: "continuation" as const,
        structure_strength: "strong" as const
    };

    const liquidity = {
        sweeps: ["SSL swept at 1.1710"],
        inducement: ["BSL at 1.1740"]
    };

    const pd_array = {
        zone: "discount" as const,
        pd_arrays: ["M5 bullish FVG"]
    };

    const result = await ltfTriggerAgent({
        eurusd,
        htf,
        itf,
        structure,
        liquidity,
        pd_array
    });

    console.log(JSON.stringify(result, null, 2));
}

runTest();