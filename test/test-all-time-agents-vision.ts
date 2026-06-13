import { htfMacroAgent } from "../core/3.query/agents/htf/htf-macro-agent";
import { quarterlyAgent } from "../core/3.query/agents/time/quarterly-agent";
import { monthlyAgent } from "../core/3.query/agents/time/monthly-agent";
import { weeklyAgent } from "../core/3.query/agents/time/weekly-agent";
import { dailyAgent } from "../core/3.query/agents/time/daily-agent";
import { sessionAgent } from "../core/3.query/agents/time/session-agent";
import fs from "fs";
import path from "path";

async function runAllAgentsTest() {
  const session = "data/session_1777142030934";

  console.log("=== STARTING ALL TIME AGENTS VISION TEST ===\n");

  const mockHydrationContext = {} as any;

  // 1. Run HTF Macro Agent
  console.log("----------------------------------------");
  console.log("1. Running HTF Macro Agent...");
  const htfInput = {
    eurusd: {
      m: `${session}/EURUSD/1MO.jpg`,
      w: `${session}/EURUSD/1W.jpg`,
      d: `${session}/EURUSD/1D.jpg`
    },
    dxy: {
      m: `${session}/DXY/1MO.jpg`,
      w: `${session}/DXY/1W.jpg`,
      d: `${session}/DXY/1D.jpg`
    },
    us10y: {
      m: `${session}/US10Y/1MO.jpg`,
      w: `${session}/US10Y/1W.jpg`,
      d: `${session}/US10Y/1D.jpg`
    },
    us20y: {
      m: `${session}/US20Y/1MO.jpg`,
      w: `${session}/US20Y/1W.jpg`,
      d: `${session}/US20Y/1D.jpg`
    }
  };

  try {
    const res = await htfMacroAgent(htfInput, mockHydrationContext);
    console.log(">> HTF Macro Agent Output:\n", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(">> HTF Macro Agent failed:", err);
  }

  // Common inputs for HTF/ITF Time Agents (Quarterly, Monthly, Weekly)
  const macroTimeInput = {
    eurusd: {
      tf1: `${session}/EURUSD/1MO.jpg`,
      tf2: `${session}/EURUSD/1W.jpg`,
      tf3: `${session}/EURUSD/1D.jpg`
    }
  };

  // 2. Run Quarterly Agent
  console.log("\n----------------------------------------");
  console.log("2. Running Quarterly Agent...");
  try {
    const res = await quarterlyAgent(macroTimeInput, mockHydrationContext);
    console.log(">> Quarterly Agent Output:\n", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(">> Quarterly Agent failed:", err);
  }

  // 3. Run Monthly Agent
  console.log("\n----------------------------------------");
  console.log("3. Running Monthly Agent...");
  try {
    const res = await monthlyAgent(macroTimeInput, mockHydrationContext);
    console.log(">> Monthly Agent Output:\n", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(">> Monthly Agent failed:", err);
  }

  // 4. Run Weekly Agent
  console.log("\n----------------------------------------");
  console.log("4. Running Weekly Agent...");
  const weeklyInput = {
    eurusd: {
      tf1: `${session}/EURUSD/1W.jpg`,
      tf2: `${session}/EURUSD/1D.jpg`,
      tf3: `${session}/EURUSD/4H.jpg`
    }
  };
  try {
    const res = await weeklyAgent(weeklyInput, mockHydrationContext);
    console.log(">> Weekly Agent Output:\n", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(">> Weekly Agent failed:", err);
  }

  // 5. Run Daily Agent
  console.log("\n----------------------------------------");
  console.log("5. Running Daily Agent...");
  const dailyInput = {
    eurusd: {
      tf1: `${session}/EURUSD/1D.jpg`,
      tf2: `${session}/EURUSD/4H.jpg`,
      tf3: `${session}/EURUSD/1H.jpg`
    }
  };
  try {
    const res = await dailyAgent(dailyInput, mockHydrationContext);
    console.log(">> Daily Agent Output:\n", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(">> Daily Agent failed:", err);
  }

  // 6. Run Session Agent
  console.log("\n----------------------------------------");
  console.log("6. Running Session Agent...");
  const sessionInput = {
    eurusd: {
      tf1: `${session}/EURUSD/1H.jpg`,
      tf2: `${session}/EURUSD/15m.jpg`,
      tf3: `${session}/EURUSD/5m.jpg`
    }
  };
  try {
    const res = await sessionAgent(sessionInput, mockHydrationContext);
    console.log(">> Session Agent Output:\n", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(">> Session Agent failed:", err);
  }

  console.log("\n========================================");
  console.log("ALL TESTS INITIATED COMPLETE.");
}

runAllAgentsTest().catch(console.error);
