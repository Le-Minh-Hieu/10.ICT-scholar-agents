console.log("TEST FILE EXECUTED");
import { runLTFOrchestrator } from "../core/3.query/orchestrators/ltf-orchestrator.js";

async function testLTF() {
  console.log("Starting LTF Orchestrator Test...");
  const session = "D:\\10. ict-scholar-agents-V1\\data\\session_1777142030934";

  const eurusd = {
    h1: `${session}\\EURUSD\\1H.jpg`,
    m15: `${session}\\EURUSD\\15m.jpg`,
    m5: `${session}\\EURUSD\\5m.jpg`,
    m1: `${session}\\EURUSD\\1m.jpg`
  };

  try {
    const result = await runLTFOrchestrator({
      eurusd,
      query: "Analyze EURUSD LTF execution",
      optional_context: ""
    }, {
      parent_thesis: {
        timeframe: 'H4',
        bias: 'suggests_bullish',
        confidence: 0.7,
        key_anchors: ['H4 FVG', 'Weekly OB'],
        summary: 'The H4 chart suggests a bullish bias, with price reacting off a key demand zone.',
        supporting_chunks: [],
      },
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testLTF();
