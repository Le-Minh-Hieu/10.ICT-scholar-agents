
import { runMasterOrchestrator, MasterOrchestratorInput } from "../core/3.query/orchestrators/master-orchestrator.js";
import { StorageService } from "../shared/services/storage-service.js";
import { VisionFact } from "../shared/contracts/pmso.js";
import { HierarchicalMemory } from "../shared/knowledge/hierarchical-types.js";
import { log } from "../shared/utils/logger.js";
import fs from "fs";
import path from "path";

async function setupCapture(date: string, session: string, captureId: string) {
    const baseDir = path.join(process.cwd(), "data", "sessions", date, session, "captures", captureId);
    StorageService.initCaptureDirectory(baseDir);
    
    const metadata = {
        capture_id: captureId,
        timestamp_ny: `${date}T08:00:00-04:00`,
        session: session,
        primary_symbol: "EURUSD"
    };
    StorageService.saveJson(path.join(baseDir, "metadata.json"), metadata);
    
    // Set globals for the engine
    (global as any).currentCaptureId = captureId;
    (global as any).currentDate = date;
    (global as any).currentSession = session;
    (global as any).currentCapturePath = baseDir;

    return baseDir;
}

async function runLCTVS() {
    const date = "2026-05-15"; // Future date for testing
    const session = "NEW_YORK";
    
    const captures = [
        {
            id: "LCTVS_001",
            price: 1.0470,
            facts: [
                {
                    type: "bullish_fvg",
                    confidence: 0.85,
                    anchor: "Daily Bullish FVG",
                    timeframe: "DAILY",
                    raw_output: { price_bounds: { high: 1.0460, low: 1.0450 } }
                }
            ],
            desc: "Discovery of Bullish FVG"
        },
        {
            id: "LCTVS_002",
            price: 1.0480,
            facts: [
                {
                    type: "bullish_fvg",
                    confidence: 0.90,
                    anchor: "Daily Bullish FVG",
                    timeframe: "DAILY",
                    raw_output: { price_bounds: { high: 1.0460, low: 1.0450 } }
                }
            ],
            desc: "Validation of Bullish FVG"
        },
        {
            id: "LCTVS_003",
            price: 1.0455,
            facts: [
                {
                    type: "bullish_fvg",
                    confidence: 0.80,
                    anchor: "Daily Bullish FVG",
                    timeframe: "DAILY",
                    raw_output: { price_bounds: { high: 1.0460, low: 1.0450 } }
                }
            ],
            desc: "Partial Mitigation (Price enters FVG)"
        },
        {
            id: "LCTVS_004",
            price: 1.0485,
            facts: [
                {
                    type: "bearish_fvg",
                    confidence: 0.88,
                    anchor: "Daily Bearish FVG",
                    timeframe: "DAILY",
                    raw_output: { price_bounds: { high: 1.0500, low: 1.0490 } }
                },
                {
                    type: "bullish_fvg",
                    confidence: 0.60,
                    anchor: "Daily Bullish FVG",
                    timeframe: "DAILY",
                    raw_output: { price_bounds: { high: 1.0460, low: 1.0450 } }
                }
            ],
            desc: "Contradiction (New Bearish FVG)"
        },
        {
            id: "LCTVS_005",
            price: 1.0440,
            facts: [
                {
                    type: "bearish_fvg",
                    confidence: 0.95,
                    anchor: "Daily Bearish FVG",
                    timeframe: "DAILY",
                    raw_output: { price_bounds: { high: 1.0500, low: 1.0490 } }
                }
            ],
            desc: "Invalidation (Price breaks Bullish FVG)"
        }
    ];

    let memory: HierarchicalMemory = {
        theses: {
            DAILY: {
                timeframe: "DAILY",
                bias: "suggests_bullish",
                confidence: 0.7,
                key_anchors: ["Daily Support"],
                summary: "HTF context is generally bullish.",
                supporting_chunks: []
            }
        }
    };

    console.log("=== STARTING LOW-COST TEMPORAL VERIFICATION (LCTVS) ===");

    for (const cap of captures) {
        console.log(`\n--- Capture ${cap.id}: ${cap.desc} (Price: ${cap.price}) ---`);
        await setupCapture(date, session, cap.id);

        const input: MasterOrchestratorInput = {
            time: { trading_window: "active", narrative: "NY Session Open" },
            htf: { htf_bias: "bullish", facts: cap.facts.filter(f => ["MONTHLY", "WEEKLY", "DAILY", "H1"].includes(f.timeframe)) },
            itf: { itf_bias: "neutral", facts: [] },
            ltf: { ltf_bias: cap.price > 1.0480 ? "bullish" : "bearish", facts: cap.facts.filter(f => ["M15", "M5", "M1"].includes(f.timeframe)), retrieved_chunks: [] },
            memory: memory
        };

        // Inject price into global for temporal engine
        (global as any).currentPrice = cap.price;

        const output = await runMasterOrchestrator(input) as any;
        
        console.log(`Result: ${output.state} | Direction: ${output.direction} | Confidence: ${output.confidence}`);
        console.log(`PMSO Bias: ${output._pmso.market_context.htf_bias.value} (Conf: ${output._pmso.market_context.htf_bias.confidence.toFixed(2)})`);
        console.log(`Contradiction Score: ${output._pmso.tensions.contradiction_score.toFixed(2)}`);
        
        // Update memory for next capture
        memory = input.memory || memory;
        (global as any).previousScenarios = memory.scenarios;
    }

    console.log("\n=== LCTVS COMPLETE ===");
}

runLCTVS().catch(err => {
    console.error("LCTVS Failed:", err);
});
