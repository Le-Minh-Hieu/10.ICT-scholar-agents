import { quarterlyAgent } from "../core/3.query/agents/time/quarterly-agent";
import fs from "fs";

async function runTest() {
  const session = "data/session_1777142030934";

  // EURUSD path
  const eurusdPath = `${session}/EURUSD`;
  const eurusdD = `${eurusdPath}/1D.jpg`;
  const eurusdW = `${eurusdPath}/1W.jpg`;
  const eurusdM = `${eurusdPath}/1MO.jpg`;

  if (!fs.existsSync(eurusdD)) {
    console.error("EURUSD primary image not found:", eurusdD);
    return;
  }

  console.log("Starting Quarterly Agent Vision-First Test...");

  try {
    const result = await quarterlyAgent({
      eurusd: {
        tf1: fs.existsSync(eurusdM) ? eurusdM : null,
        tf2: fs.existsSync(eurusdW) ? eurusdW : null,
        tf3: fs.existsSync(eurusdD) ? eurusdD : null,
      }
    }, {} as any);

    console.log("\n[FINAL QUARTERLY OUTPUT]");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error during quarterly test execution:", error);
  }
}

runTest().catch(console.error);
