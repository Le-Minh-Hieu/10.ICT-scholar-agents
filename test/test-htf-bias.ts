import { htfBiasAgent } from "../core/3.query/agents/htf/htf-bias-agent.js";

async function runTest() {
    console.log("Starting HTF Bias Agent Test...");

    try {
        const result = await htfBiasAgent({
            macro: { macro_impact: "high", notes: "DXY is bearish and Yields are falling, supporting bullish EURUSD.", macro_direction: "bullish", macro_alignment: true },
            structure: { structure_trend: "bullish", notes: "Clear BOS to the upside on Daily and Weekly charts.", smt_signal: "none", structure_strength: "strong" },
            liquidity: { liquidity: { above: true, below: false }, notes: "Price is drawn towards resting buy-side liquidity above." },
            pd_array: { pd_array_status: "discount", notes: "Price has retraced into a Daily Discount zone.", equilibrium: 0, range_high: 0, range_low: 0 }
        });

        console.log("\n[FINAL BIAS OUTPUT]");
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Error during bias test execution:", error);
    }
}

runTest().catch(console.error);
