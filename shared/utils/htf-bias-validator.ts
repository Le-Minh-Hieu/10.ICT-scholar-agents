export function validateHTFBias(output: any, input: any) {
    // =========================
    // 1. BASIC STRUCTURE
    // =========================
    if (!output) return fail("Empty output");

    const validBias = ["bullish", "bearish"];
    const validConfidence = ["high", "medium", "low"];

    if (!validBias.includes(output.htf_bias)) {
        return fail("Invalid htf_bias");
    }

    if (!validBias.includes(output.next_candle_bias)) {
        return fail("Invalid next_candle_bias");
    }

    if (!validConfidence.includes(output.confidence)) {
        return fail("Invalid confidence");
    }

    if (!Array.isArray(output.dominant_factors)) {
        return fail("dominant_factors must be array");
    }

    // =========================
    // 2. INPUT CONSISTENCY CHECK
    // =========================

    const structure = input?.structure?.structure_trend;
    const macro = input?.macro?.macro_direction;

    const conflict =
        (structure === "bullish" && macro === "bearish") ||
        (structure === "bearish" && macro === "bullish");

    // 🔥 nếu conflict → confidence không được high
    if (conflict && output.confidence === "high") {
        return fail("Conflict present but confidence is high");
    }

    // =========================
    // 3. LOGIC SANITY CHECK
    // =========================

    // nếu structure rõ ràng → bias nên match (trừ khi macro override)
    if (
        structure &&
        structure !== "unknown" &&
        !conflict &&
        output.htf_bias !== structure
    ) {
        return fail("Bias does not align with structure");
    }

    // =========================
    // 4. REASONING CHECK
    // =========================

    if (!output.reasoning || output.reasoning.length < 30) {
        return fail("Weak reasoning");
    }

    const reasoning = output.reasoning.toLowerCase();

    // 🔥 consistency keyword check
    if (output.htf_bias === "bullish" && !reasoning.includes("bullish")) {
        return fail("Reasoning does not support bullish bias");
    }

    if (output.htf_bias === "bearish" && !reasoning.includes("bearish")) {
        return fail("Reasoning does not support bearish bias");
    }

    // nếu conflict mà reasoning không mention → fail
    if (conflict && !reasoning.includes("conflict")) {
        return fail("Conflict not mentioned in reasoning");
    }

    return { ok: true };

    function fail(reason: string) {
        return { ok: false, reason };
    }
}
