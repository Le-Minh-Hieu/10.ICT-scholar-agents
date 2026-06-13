import { htfMacroAgent } from "../core/3.query/agents/htf/htf-macro-agent";
import fs from "fs";

async function runTest() {

  const session = "data/session_1777142030934";

  // =========================
  // 🔥 EURUSD (PRIMARY CONTEXT)
  // =========================
  const eurusdPath = `${session}/EURUSD`;
  const eurusdD = `${eurusdPath}/1D.jpg`;
  const eurusdW = `${eurusdPath}/1W.jpg`;
  const eurusdM = `${eurusdPath}/1MO.jpg`;

  // =========================
  // 🔥 DXY
  // =========================
  const dxyPath = `${session}/DXY`;
  const dxyD = `${dxyPath}/1D.jpg`;
  const dxyW = `${dxyPath}/1W.jpg`;
  const dxyM = `${dxyPath}/1MO.jpg`;

  // =========================
  // 🔥 US10Y
  // =========================
  const us10yPath = `${session}/US10Y`;
  const us10yD = `${us10yPath}/1D.jpg`;
  const us10yW = `${us10yPath}/1W.jpg`;
  const us10yM = `${us10yPath}/1MO.jpg`;

  // =========================
  // 🔥 US20Y
  // =========================
  const us20yPath = `${session}/US20Y`;
  const us20yD = `${us20yPath}/1D.jpg`;
  const us20yW = `${us20yPath}/1W.jpg`;
  const us20yM = `${us20yPath}/1MO.jpg`;

  // 🔥 VALIDATION (cần ít nhất EURUSD D)
  if (!fs.existsSync(eurusdD)) {
    console.error("EURUSD primary image not found:", eurusdD);
    return;
  }

  console.log("Starting HTF Macro Agent Test...");

  try {
    const result = await htfMacroAgent({

      // 🔥 EURUSD (BASE ASSET)
      eurusd: {
        d: eurusdD,
        w: fs.existsSync(eurusdW) ? eurusdW : undefined,
        m: fs.existsSync(eurusdM) ? eurusdM : undefined,
      },

      // 🔥 DXY
      dxy: {
        d: fs.existsSync(dxyD) ? dxyD : undefined,
        w: fs.existsSync(dxyW) ? dxyW : undefined,
        m: fs.existsSync(dxyM) ? dxyM : undefined,
      },

      // 🔥 US10Y
      us10y: {
        d: fs.existsSync(us10yD) ? us10yD : undefined,
        w: fs.existsSync(us10yW) ? us10yW : undefined,
        m: fs.existsSync(us10yM) ? us10yM : undefined,
      },

      // 🔥 US20Y
      us20y: {
        d: fs.existsSync(us20yD) ? us20yD : undefined,
        w: fs.existsSync(us20yW) ? us20yW : undefined,
        m: fs.existsSync(us20yM) ? us20yM : undefined,
      }

    }, {} as any);

    console.log("\n[FINAL MACRO OUTPUT]");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error during macro test execution:", error);
  }
}

runTest().catch(console.error);
