
import { runAnalysis } from "../app/facades/run-analysis.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { StorageService } from "../shared/services/storage-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const date = "2026-05-10";
    const session = "LONDON";
    const baseDir = path.join(process.cwd(), "data", "sessions", date, session, "captures");

    const cap1_id = "1000000000001";
    const cap2_id = "1000000000002";

    const cap1_path = path.join(baseDir, cap1_id);
    const cap2_path = path.join(baseDir, cap2_id);

    // 1. Setup Capture 1
    console.log("Setting up Capture 1...");
    StorageService.initCaptureDirectory(cap1_path);
    const metadata1 = {
        capture_id: cap1_id,
        timestamp_ny: `${date}T08:00:00-04:00`,
        session: session,
        primary_symbol: "EURUSD"
    };
    StorageService.saveJson(path.join(cap1_path, "metadata.json"), metadata1);
    // Create dummy input folder for symbol and required timeframes
    const symbolDir1 = path.join(cap1_path, "input", "EURUSD");
    fs.mkdirSync(symbolDir1, { recursive: true });
    // Write dummy images for required timeframes to bypass guard
    ["1D", "4H", "1H"].forEach(tf => fs.writeFileSync(path.join(symbolDir1, `${tf}.jpg`), "dummy"));

    // 2. Run Analysis 1
    console.log("\n--- Running Capture 1 ---");
    const result1 = await runAnalysis({}, { capturePath: cap1_path });
    
    const state1Path = path.join(cap1_path, "analysis", "master", "temporal_state.json");
    if (fs.existsSync(state1Path)) {
        console.log("SUCCESS: Temporal state created for Capture 1");
    } else {
        console.error("FAILED: Temporal state NOT created for Capture 1");
        return;
    }

    // 3. Setup Capture 2
    console.log("\nSetting up Capture 2...");
    StorageService.initCaptureDirectory(cap2_path);
    const metadata2 = {
        capture_id: cap2_id,
        timestamp_ny: `${date}T08:05:00-04:00`,
        session: session,
        primary_symbol: "EURUSD"
    };
    StorageService.saveJson(path.join(cap2_path, "metadata.json"), metadata2);
    const symbolDir2 = path.join(cap2_path, "input", "EURUSD");
    fs.mkdirSync(symbolDir2, { recursive: true });
    ["1D", "4H", "1H"].forEach(tf => fs.writeFileSync(path.join(symbolDir2, `${tf}.jpg`), "dummy"));

    // 4. Run Analysis 2
    console.log("\n--- Running Capture 2 ---");
    const result2 = await runAnalysis({}, { capturePath: cap2_path });

    // 5. Verification
    const state2Path = path.join(cap2_path, "analysis", "master", "temporal_state.json");
    if (fs.existsSync(state2Path)) {
        console.log("SUCCESS: Temporal state created for Capture 2");
        const state2 = JSON.parse(fs.readFileSync(state2Path, 'utf-8'));
        console.log("Capture Count in State 2:", state2.data.capture_count);
        if (state2.data.capture_count > 1) {
            console.log("SUCCESS: State was inherited!");
        } else {
            console.error("FAILED: State was NOT inherited (capture_count is 1)");
        }
    } else {
        console.error("FAILED: Temporal state NOT created for Capture 2");
    }
}

main().catch(console.error);
