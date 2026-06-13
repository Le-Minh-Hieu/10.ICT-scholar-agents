import { runHTFOrchestrator } from "../core/3.query/orchestrators/htf-orchestrator";
import { runITFOrchestrator } from "../core/3.query/orchestrators/itf-orchestrator";
import { runLTFOrchestrator } from "../core/3.query/orchestrators/ltf-orchestrator";
import { runTimeOrchestrator } from "../core/3.query/orchestrators/time-orchestrator";
import { runMasterOrchestrator } from "../core/3.query/orchestrators/master-orchestrator";
import fs from "fs";

async function runFullPipelineTest() {
  const session = "data/sessions/2026-05-17/OFF_SESSION/captures/1779001812523/input";

  const eurusd = {
    d: `${session}/EURUSD/1D.jpg`,
    w: `${session}/EURUSD/1W.jpg`,
    m: `${session}/EURUSD/1MO.jpg`,
    h4: `${session}/EURUSD/4H.jpg`,
    h1: `${session}/EURUSD/1H.jpg`,
    m15: `${session}/EURUSD/15m.jpg`,
    m5: `${session}/EURUSD/5m.jpg`,
    m1: `${session}/EURUSD/1m.jpg`,
  };

  const gbpusd = {
    d: `${session}/GBPUSD/1D.jpg`,
    w: `${session}/GBPUSD/1W.jpg`,
    m: `${session}/GBPUSD/1MO.jpg`
  };

  const dxy = {
    d: `${session}/DXY/1D.jpg`,
    w: `${session}/DXY/1W.jpg`,
    m: `${session}/DXY/1MO.jpg`
  };

  const us10y = {
    d: `${session}/US10Y/1D.jpg`,
    w: `${session}/US10Y/1W.jpg`,
    m: `${session}/US10Y/1MO.jpg`
  };

  const us20y = {
    d: `${session}/US20Y/1D.jpg`,
    w: `${session}/US20Y/1W.jpg`,
    m: `${session}/US20Y/1MO.jpg`
  };

  // Check for at least one image to ensure paths are correct
  if (!fs.existsSync(eurusd.d)) {
    console.error("❌ Base image not found, please check session path:", eurusd.d);
    return;
  }

  console.log("=====================================");
  console.log("🚀 STARTING FULL PIPELINE TEST");
  console.log("=====================================");

  try {
    const orchestratorInput = {
      eurusd,
      gbpusd: fs.existsSync(gbpusd.d) ? gbpusd : undefined,
      dxy: fs.existsSync(dxy.d) ? dxy : undefined,
      us10y: fs.existsSync(us10y.d) ? us10y : undefined,
      us20y: fs.existsSync(us20y.d) ? us20y : undefined
    }

    // 1. Time Orchestrator
    console.log("\n--- 🕙 RUNNING TIME ORCHESTRATOR ---");
    const timeOutput = await runTimeOrchestrator(orchestratorInput, {} as any);
    console.log("✅ Time Orchestrator finished.");

    // 2. HTF Orchestrator
    console.log("\n--- 📈 RUNNING HTF ORCHESTRATOR ---");
    const htfOutput = await runHTFOrchestrator(orchestratorInput, {} as any);
    console.log("✅ HTF Orchestrator finished.");

    // 3. ITF Orchestrator
    console.log("\n--- 📊 RUNNING ITF ORCHESTRator ---");
    const itfInput = {
        ...orchestratorInput,
        htf: htfOutput, // Pass HTF output to ITF
    }
    const itfOutput = await runITFOrchestrator(
      itfInput as any,
      {} as any
    );
    console.log("✅ ITF Orchestrator finished.");

    // 4. LTF Orchestrator
    console.log("\n--- 📉 RUNNING LTF ORCHESTRATOR ---");
    const ltfInput = {
        ...orchestratorInput,
        query: "Analyze EURUSD LTF for entry points",
    }
    const ltfOutput = await runLTFOrchestrator(
      ltfInput as any,
      {
        parent_thesis: {
          timeframe: "H4",
          bias: itfOutput.itf_bias as any,
          confidence: 0.7,
          key_anchors: ["H4 FVG", "Weekly OB"],
          summary:
            "The H4 chart suggests a bullish bias, with price reacting off a key demand zone.",
          supporting_chunks: [],
        },
      }
    );
    console.log("✅ LTF Orchestrator finished.");

    // 5. Master Orchestrator
    console.log("\n--- 👑 RUNNING MASTER ORCHESTRATOR ---");
    const masterOutput = await runMasterOrchestrator({
      time: timeOutput,
      htf: htfOutput,
      itf: itfOutput,
      ltf: ltfOutput,
      hydration_context: {},
    });

    console.log("\n================ FINAL OUTPUT ================");
    console.log(JSON.stringify(masterOutput, null, 2));
    
  } catch (error) {
    console.error("❌ Error during full pipeline test:", error);
  }

  console.log("\n=====================================");
  console.log("✅ FULL PIPELINE TEST FINISHED");
  console.log("=====================================");
}

runFullPipelineTest().catch(console.error);
