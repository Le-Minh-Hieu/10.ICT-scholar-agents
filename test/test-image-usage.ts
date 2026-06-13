
import { runAnalysis } from "../app/facades/run-analysis.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utility to create dummy image data for testing
function createDummyImage(content: string = "", type: "valid" | "random" | "contradictory" = "valid", imagePath: string): string {
  // For simplicity, let's use a small base64 encoded string
  // In a real scenario, you'd generate or load actual image data
  let base64Data = "";
  if (type === "random") {
    base64Data = Buffer.from("random_noise_image_data").toString("base64");
  } else if (type === "contradictory") {
    // A very simple representation of a 'contradictory' image
    base64Data = Buffer.from("contradictory_image_data_showing_bullish").toString("base64");
  } else {
    base64Data = Buffer.from("valid_image_data").toString("base64");
  }
  
  const dir = path.dirname(imagePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(imagePath, base64Data, { encoding: "base64" });
  return imagePath;
}

function getImagePath(session: string, symbol: string, tf: string, type: "valid" | "random" | "contradictory" = "valid"): string {
  const baseDir = `./data/sessions/${session}/${symbol}`;
  const filePath = path.join(baseDir, `${tf}.jpg`);
  return createDummyImage("", type, filePath);
}

interface AgentOutput {
  direction: string;
  confidence: string;
  score: number;
  key_signal: string;
}

async function runAndLog(testName: string, input: any, sessionPath: string): Promise<Record<string, AgentOutput>> {
  console.log(`\n=== Running Test: ${testName} ===`);
  const result = await runAnalysis(input, { debug: true, capturePath: sessionPath });

  const agentOutputs: Record<string, AgentOutput> = {};

  const logAgentOutput = (agentName: string, data: any) => {
    if (data) {
      agentOutputs[agentName] = {
        direction: data.direction || "N/A",
        confidence: data.confidence || "N/A",
        score: data.score || 0,
        key_signal: data.narrative ? data.narrative.substring(0, 100) : "N/A"
      };
      console.log(`  ${agentName} Output:`);
      console.log(`    Direction: ${agentOutputs[agentName].direction}`);
      console.log(`    Confidence: ${agentOutputs[agentName].confidence}`);
      console.log(`    Score: ${agentOutputs[agentName].score}`);
      console.log(`    Key Signal: ${agentOutputs[agentName].key_signal}...`);
    }
  };

  logAgentOutput("HTF", result.layers.htf);
  logAgentOutput("ITF", result.layers.itf);
  logAgentOutput("LTF", result.layers.ltf);

  return agentOutputs;
}

async function main() {
  const SESSION_ID = `TEST_SESSION_${Date.now()}`;
  const CAPTURE_PATH = path.join(__dirname, `data/sessions/${SESSION_ID}/OFF_SESSION/captures/1234567890000`);
  
  // Ensure the capture path exists
  if (!fs.existsSync(CAPTURE_PATH)) {
    fs.mkdirSync(CAPTURE_PATH, { recursive: true });
  }

  // --- Test A: No Images ---
  const noImageInput = {
    eurusd: {
      d: null, w: null, m: null, h4: null, h1: null, m15: null, m5: null, m1: null
    },
    query: "analyze current market for a potential long setup"
  };
  await runAndLog("No Images", noImageInput, CAPTURE_PATH);

  // --- Test B: Random Image ---
  const randomImageInput = {
    eurusd: {
      d: getImagePath(SESSION_ID, "EURUSD", "1D", "random"),
      w: getImagePath(SESSION_ID, "EURUSD", "1W", "random"),
      m: getImagePath(SESSION_ID, "EURUSD", "1MO", "random"),
      h4: getImagePath(SESSION_ID, "EURUSD", "4H", "random"),
      h1: getImagePath(SESSION_ID, "EURUSD", "1H", "random"),
      m15: getImagePath(SESSION_ID, "EURUSD", "15m", "random"),
      m5: getImagePath(SESSION_ID, "EURUSD", "5m", "random"),
      m1: getImagePath(SESSION_ID, "EURUSD", "1m", "random"),
    },
    query: "analyze current market for a potential long setup"
  };
  await runAndLog("Random Images", randomImageInput, CAPTURE_PATH);

  // --- Test C: Contradictory Text vs. Image (Bullish Image, Bearish Query) ---
  const contradictoryInput = {
    eurusd: {
      d: getImagePath(SESSION_ID, "EURUSD", "1D", "contradictory"), // Image suggests bullish
      w: getImagePath(SESSION_ID, "EURUSD", "1W", "contradictory"),
      m: getImagePath(SESSION_ID, "EURUSD", "1MO", "contradictory"),
      h4: getImagePath(SESSION_ID, "EURUSD", "4H", "contradictory"),
      h1: getImagePath(SESSION_ID, "EURUSD", "1H", "contradictory"),
      m15: getImagePath(SESSION_ID, "EURUSD", "15m", "contradictory"),
      m5: getImagePath(SESSION_ID, "EURUSD", "5m", "contradictory"),
      m1: getImagePath(SESSION_ID, "EURUSD", "1m", "contradictory"),
    },
    query: "find bearish structure with high confidence"
  };
  await runAndLog("Contradictory (Bullish Image, Bearish Query)", contradictoryInput, CAPTURE_PATH);

  // --- Test D: Same Image, Different Query (Bullish Image, Bullish Query) ---
  const consistentInput = {
    eurusd: {
      d: getImagePath(SESSION_ID, "EURUSD", "1D", "contradictory"), // Using the same \'bullish\' image data
      w: getImagePath(SESSION_ID, "EURUSD", "1W", "contradictory"),
      m: getImagePath(SESSION_ID, "EURUSD", "1MO", "contradictory"),
      h4: getImagePath(SESSION_ID, "EURUSD", "4H", "contradictory"),
      h1: getImagePath(SESSION_ID, "EURUSD", "1H", "contradictory"),
      m15: getImagePath(SESSION_ID, "EURUSD", "15m", "contradictory"),
      m5: getImagePath(SESSION_ID, "EURUSD", "5m", "contradictory"),
      m1: getImagePath(SESSION_ID, "EURUSD", "1m", "contradictory"),
    },
    query: "find bullish structure with high confidence"
  };
  await runAndLog("Consistent (Bullish Image, Bullish Query)", consistentInput, CAPTURE_PATH);

  // --- Test E: Same Image, Generic Query (Bullish Image, Generic Query) ---
  const genericQueryInput = {
    eurusd: {
      d: getImagePath(SESSION_ID, "EURUSD", "1D", "contradictory"), // Using the same \'bullish\' image data
      w: getImagePath(SESSION_ID, "EURUSD", "1W", "contradictory"),
      m: getImagePath(SESSION_ID, "EURUSD", "1MO", "contradictory"),
      h4: getImagePath(SESSION_ID, "EURUSD", "4H", "contradictory"),
      h1: getImagePath(SESSION_ID, "EURUSD", "1H", "contradictory"),
      m15: getImagePath(SESSION_ID, "EURUSD", "15m", "contradictory"),
      m5: getImagePath(SESSION_ID, "EURUSD", "5m", "contradictory"),
      m1: getImagePath(SESSION_ID, "EURUSD", "1m", "contradictory"),
    },
    query: "analyze current market"
  };
  await runAndLog("Generic Query (Bullish Image)", genericQueryInput, CAPTURE_PATH);

  console.log("\nAll tests completed. Review the logs above for detailed agent outputs and LLM interactions.");
}

main();
