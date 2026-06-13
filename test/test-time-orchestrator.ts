import { runTimeOrchestrator } from "../core/3.query/orchestrators/time-orchestrator";

async function testTimeOrchestrator() {
  const input = {
    eurusd: {
      m: "data/session_1777373541722/EURUSD/1MO.jpg",
      w: "data/session_1777373541722/EURUSD/1W.jpg",
      d: "data/session_1777373541722/EURUSD/1D.jpg",
      h4: "data/session_1777373541722/EURUSD/4H.jpg",
      h1: "data/session_1777373541722/EURUSD/2H.jpg",
      m15: "data/session_1777373541722/EURUSD/15m.jpg",
      m5: "data/session_1777373541722/EURUSD/5m.jpg"
    }
  };

  console.log("--- TESTING TIME ORCHESTRATOR ---");
  try {
    const result = await runTimeOrchestrator(input);
    console.log("FINAL OUTPUT:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testTimeOrchestrator();
