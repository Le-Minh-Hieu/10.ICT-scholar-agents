
import { runHTFOrchestrator } from "../core/3.query/orchestrators/htf-orchestrator";
import { runITFOrchestrator } from "../core/3.query/orchestrators/itf-orchestrator";
import { runLTFOrchestrator } from "../core/3.query/orchestrators/ltf-orchestrator";
import { buildITFInput, buildLTFInput } from "../core/3.query/orchestrator-input-builder";
import { HydrationContext } from "../shared/contracts/context";

// --- VERIFICATION FRAMEWORK ---
const VERIFICATION_RESULTS = {
    FAILED_CHECKS: [] as string[],
    PASSED_CHECKS: [] as string[],
    FINAL_CLASSIFICATION: "UNKNOWN",
};

const log = (type: "PASS" | "FAIL" | "INFO" | "DEAD_CONTEXT" | "STALE_PROPAGATION", message: string, details?: any) => {
    const icon = type === "PASS" ? "✅" : type === "FAIL" ? "❌" : "ℹ️";
    console.log(`\n${icon} [${type}] ${message}`);
    if (details) {
        console.log(JSON.stringify(details, null, 2));
    }
    if (type === "FAIL" || type === "DEAD_CONTEXT" || type === "STALE_PROPAGATION") {
        VERIFICATION_RESULTS.FAILED_CHECKS.push(message);
    } else if (type === "PASS") {
        VERIFICATION_RESULTS.PASSED_CHECKS.push(message);
    }
};

// --- MOCKING & SPYING INFRASTRUCTURE ---
(global as any).mockable = {
    runSafeAgent: (agentName: string) => {
        log("INFO", `Mocked runSafeAgent for: ${agentName}`);
        return Promise.resolve({ data: { agentName, status: "mocked" } });
    },
    summarizeTimeframeThesis: (timeframe: string, _: any, parentThesis: any) => {
        log("INFO", `Mocked summarizeTimeframeThesis for: ${timeframe}`);
        return Promise.resolve({ 
            timeframe: timeframe as any,
            summary: `mock ${timeframe} thesis`, 
            bias: 'suggests_neutral',
            confidence: 0.5,
            key_anchors: [],
            supporting_chunks: [],
        });
    },
    callLLM: () => Promise.resolve({ htf_bias: "mock", reasoning: "mock" }),
};

// --- VERIFICATION SCRIPT ---
async function runVerification() {
    console.log("--- STARTING HIERARCHICAL COGNITION VERIFICATION ---");

    const MOCK_INPUT = { eurusd: { d: "d", w: "w", m: "m", h4: "h4", h1: "h1", m15: "m15", m5: "m5", m1: "m1" } };
    const initialHydrationContext: HydrationContext = {
        parent_thesis: { timeframe: "INITIAL_HARDCODED" as any, summary: "initial", bias: 'suggests_neutral', confidence: 0.5, key_anchors: [], supporting_chunks: [] },
    };

    // --- HTF STAGE ---
    const { hydrationContext: itfHydrationContext, ...htfResult } = await runHTFOrchestrator(MOCK_INPUT as any, initialHydrationContext);
    if (itfHydrationContext.parent_thesis?.timeframe === "DAILY") {
        log("PASS", "HTF correctly generated the daily thesis.");
    } else {
        log("FAIL", "HTF failed to generate the daily thesis.", { actual: itfHydrationContext.parent_thesis?.timeframe, expected: "DAILY" });
    }

    // --- ITF STAGE ---
    const itfInput = buildITFInput(htfResult as any, itfHydrationContext);
    const { hydrationContext: ltfHydrationContext, ...itfResult } = await runITFOrchestrator({ ...MOCK_INPUT, htf: itfInput } as any, itfHydrationContext);
    if (ltfHydrationContext.parent_thesis?.timeframe === "H4") {
        log("PASS", "ITF consumed a parent thesis from HTF.");
    } else {
        log("FAIL", "HIERARCHICAL PROPAGATION INACTIVE: Upstream thesis (DAILY) was not consumed by downstream orchestrator (ITF).", { actual: ltfHydrationContext.parent_thesis?.timeframe, expected: "H4" });
    }

    // --- LTF STAGE ---
    const ltfInput = buildLTFInput(itfInput, itfResult as any, ltfHydrationContext);
    const { hydrationContext: masterHydrationContext, ...ltfResult } = await runLTFOrchestrator({ ...MOCK_INPUT, ltf: ltfInput } as any, ltfHydrationContext);
    if (masterHydrationContext.parent_thesis?.timeframe === "M15") {
        log("PASS", "LTF consumed a parent thesis from ITF.");
    } else {
        log("FAIL", "HIERARCHICAL PROPAGATION INACTIVE: Upstream thesis (H4) was not consumed by downstream orchestrator (LTF).", { actual: masterHydrationContext.parent_thesis?.timeframe, expected: "M15" });
    }

    // --- FINAL REPORT ---
    console.log("\n--- VERIFICATION COMPLETE ---");
    if (VERIFICATION_RESULTS.FAILED_CHECKS.length > 0) {
        VERIFICATION_RESULTS.FINAL_CLASSIFICATION = "PARALLEL COGNITION WITH INCOMPLETE HIERARCHICAL PROPAGATION";
        log("INFO", "PARALLEL COGNITION DETECTED");
        log("INFO", "HIERARCHICAL PROPAGATION INACTIVE");
        log("INFO", "POST-HOC RECONCILIATION ACTIVE (ASSUMED)");
        log("INFO", "PMSO SYNTHESIS PARALLEL (ASSUMED)");
        log("FAIL", "FINAL RUNTIME VERDICT: HIERARCHY IS FUNCTIONALLY INCOMPLETE");
    } else {
        VERIFICATION_RESULTS.FINAL_CLASSIFICATION = "TRUE HIERARCHICAL COGNITION";
        log("PASS", "ALL CHECKS PASSED");
    }
    console.log(`\nFINAL CLASSIFICATION: ${VERIFICATION_RESULTS.FINAL_CLASSIFICATION}`);
}

runVerification();
