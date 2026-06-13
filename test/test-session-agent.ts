import { sessionAgent } from "../core/3.query/agents/time/session-agent";
import { TimeAgentInput } from "../types/time-agent";

async function testSession() {
  const input: TimeAgentInput = {
    eurusd: {
      tf1: "data/session_1777373541722/EURUSD/2H.jpg",
      tf2: "data/session_1777373541722/EURUSD/15m.jpg",
      tf3: "data/session_1777373541722/EURUSD/5m.jpg"
    }
  };

  console.log("--- TESTING SESSION AGENT ---");
  try {
    const result = await sessionAgent(input);
    console.log("FINAL OUTPUT:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testSession();
