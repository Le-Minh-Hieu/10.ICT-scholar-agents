import { htfBiasAgent } from "../core/3.query/agents/htf/htf-bias-agent.js";

async function runTest() {
    console.log("=== HTF BIAS AGENT TEST RUN STARTED ===");

    const result = await htfBiasAgent({
        macro: { macro_impact: "high", notes: "test", macro_direction: "bullish", macro_alignment: true },
        structure: { structure_trend: "bullish", notes: "test", smt_signal: "none", structure_strength: "strong" },
        liquidity: { liquidity: { above: true, below: false }, notes: "test" },
        pd_array: { pd_array_status: "discount", notes: "test", equilibrium: 0, range_high: 0, range_low: 0 }
    });

    console.log("\n=== HTF BIAS AGENT TEST OUTPUT ===\n");
    console.log(JSON.stringify(result, null, 2));
}

runTest().catch(console.error);
