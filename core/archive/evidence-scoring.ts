import { log } from "../../shared/utils/logger.js";

export type RetrievedChunk = {
    chunk_id: string;
    text: string;
    score?: number; // retrieval score
    embedding?: number[];
};

export type ScoredEvidence = {
    chunk_id: string;
    retrieval_score: number;
    evidence_strength: number; // 0-1
    semantic_agreement: number; // 0-1 (agreement with other top evidence)
    contradiction_score: number; // 0-1 (local contradiction signal)
    diversity_score: number; // 0-1 (higher means more diverse)
    final_score: number; // composite
    text?: string;
};

function jaccardTokens(a: string, b: string) {
    const ta = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const tb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    const inter = new Set([...ta].filter(x => tb.has(x)));
    const uni = new Set([...ta, ...tb]);
    if (uni.size === 0) return 0;
    return inter.size / uni.size;
}

export function scoreEvidence(chunks: RetrievedChunk[]): ScoredEvidence[] {
    if (!chunks || chunks.length === 0) return [];

    // Base retrieval scores normalized
    const maxRetr = Math.max(...chunks.map(c => c.score || 0), 0.0001);

    // Precompute pairwise similarities (cheap token-based fallback)
    const texts = chunks.map(c => c.text || "");
    const n = chunks.length;
    const simMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            let sim = 0;
            if (chunks[i].embedding && chunks[j].embedding) {
                const a = chunks[i].embedding!;
                const b = chunks[j].embedding!;
                let dot = 0;
                for (let k = 0; k < Math.min(a.length, b.length); k++) dot += a[k] * b[k];
                sim = Math.max(-1, Math.min(1, dot));
                sim = (sim + 1) / 2; // map to 0-1
            } else {
                sim = jaccardTokens(texts[i], texts[j]);
            }
            simMatrix[i][j] = sim;
            simMatrix[j][i] = sim;
        }
        simMatrix[i][i] = 1;
    }

    // Compute semantic agreement as mean similarity to top-k (k=5 or n)
    const k = Math.min(5, n - 1);

    const scored: ScoredEvidence[] = chunks.map((c, idx) => {
        const retrieval_score = (c.score || 0) / maxRetr;

        // evidence strength: function of retrieval_score and text length
        const lenFactor = Math.min(1, (c.text || "").length / 400);
        const evidence_strength = Math.min(1, retrieval_score * 0.8 + lenFactor * 0.2);

        // semantic agreement: average of top similarities
        const sims = simMatrix[idx].slice().sort((a, b) => b - a).slice(1, 1 + k);
        const semantic_agreement = sims.length ? sims.reduce((s, v) => s + v, 0) / sims.length : 1;

        // contradiction_score: heuristic — presence of negation/contrast tokens reduces agreement
        const text = (c.text || "").toLowerCase();
        const contrastTokens = ["but", "however", "although", "despite", "contradict", "not", "counter", "on the other hand"];
        const contrastCount = contrastTokens.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0);
        const contradiction_score = Math.min(0.35, contrastCount / 10);

        // diversity score: 1 - max similarity to higher-ranked items
        const maxSim = Math.max(...simMatrix[idx].filter((v, i) => i !== idx));
        const diversity_score = 1 - maxSim;

        // final score: weighted composite
        const final_score = Math.min(
            1,
            Math.max(
                0,
                evidence_strength * 0.55 +
                semantic_agreement * 0.15 +
                diversity_score * 0.15 -
                contradiction_score * 0.12 +
                retrieval_score * 0.20
            )
        );
        return {
            chunk_id: c.chunk_id,
            text: c.text,
            retrieval_score,
            evidence_strength: Number(evidence_strength.toFixed(3)),
            semantic_agreement: Number(semantic_agreement.toFixed(3)),
            contradiction_score: Number(contradiction_score.toFixed(3)),
            diversity_score: Number(diversity_score.toFixed(3)),
            final_score: Number(final_score.toFixed(3)),
        };
    });

    // sort descending by final_score
    scored.sort((a, b) => b.final_score - a.final_score);

    // Log evidence scores for observability
    try {
        log({ stage: "NEWS_EVIDENCE_SCORE", message: "Evidence scoring completed", data: { scores: scored.map(s => ({ chunk_id: s.chunk_id, final_score: s.final_score })) } });
    } catch (e) {
        // ignore logging failures
    }

    return scored;
}

export default scoreEvidence;
