import { weeklyAgent } from "../core/3.query/agents/time/weekly-agent";
import fs from "fs";

async function runTest() {
  const session = "data/session_1777142030934";

  // EURUSD path
  const eurusdPath = `${session}/EURUSD`;
  const eurusdW = `${eurusdPath}/1W.jpg`;
  const eurusdD = `${eurusdPath}/1D.jpg`;
  const eurusdH4 = `${eurusdPath}/4H.jpg`;

  if (!fs.existsSync(eurusdW)) {
    console.error("EURUSD primary image not found:", eurusdW);
    return;
  }

  console.log("Starting Weekly Agent Vision-First Test...");

  try {
    const result = await weeklyAgent({
      eurusd: {
        tf1: fs.existsSync(eurusdW) ? eurusdW : null,
        tf2: fs.existsSync(eurusdD) ? eurusdD : null,
        tf3: fs.existsSync(eurusdH4) ? eurusdH4 : null,
      }
    }, {} as any);

    console.log("\n[FINAL WEEKLY OUTPUT]");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error during weekly test execution:", error);
  }
}

runTest().catch(console.error);
