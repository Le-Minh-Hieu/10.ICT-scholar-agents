import { dailyAgent } from "../core/3.query/agents/time/daily-agent";
import fs from "fs";

async function runTest() {
  const session = "data/session_1777142030934";

  // EURUSD path
  const eurusdPath = `${session}/EURUSD`;
  const eurusdD = `${eurusdPath}/1D.jpg`;
  const eurusdH4 = `${eurusdPath}/4H.jpg`;
  const eurusdH1 = `${eurusdPath}/1H.jpg`;

  if (!fs.existsSync(eurusdD)) {
    console.error("EURUSD primary image not found:", eurusdD);
    return;
  }

  console.log("Starting Daily Agent Vision-First Test...");

  try {
    const result = await dailyAgent({
      eurusd: {
        tf1: fs.existsSync(eurusdD) ? eurusdD : null,
        tf2: fs.existsSync(eurusdH4) ? eurusdH4 : null,
        tf3: fs.existsSync(eurusdH1) ? eurusdH1 : null,
      }
    }, {} as any);

    console.log("\n[FINAL DAILY OUTPUT]");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error during daily test execution:", error);
  }
}

runTest().catch(console.error);
