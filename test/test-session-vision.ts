import { sessionAgent } from "../core/3.query/agents/time/session-agent";
import fs from "fs";

async function runTest() {
  const session = "data/session_1777142030934";

  // EURUSD path
  const eurusdPath = `${session}/EURUSD`;
  const eurusdH1 = `${eurusdPath}/1H.jpg`;
  const eurusdM15 = `${eurusdPath}/15m.jpg`;
  const eurusdM5 = `${eurusdPath}/5m.jpg`;

  if (!fs.existsSync(eurusdH1)) {
    console.error("EURUSD primary image not found:", eurusdH1);
    return;
  }

  console.log("Starting Session Agent Vision-First Test...");

  try {
    const result = await sessionAgent({
      eurusd: {
        tf1: fs.existsSync(eurusdH1) ? eurusdH1 : null,
        tf2: fs.existsSync(eurusdM15) ? eurusdM15 : null,
        tf3: fs.existsSync(eurusdM5) ? eurusdM5 : null,
      }
    }, {} as any);

    console.log("\n[FINAL SESSION OUTPUT]");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error during session test execution:", error);
  }
}

runTest().catch(console.error);
