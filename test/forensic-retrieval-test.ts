import { PMSOReconciler } from '../core/3.query/reconciler.ts';
import { TemporalEngine } from '../core/3.query/temporal-engine.ts';
import { HTFOrchestratorOutput, ITFOrchestratorOutput, LTFOrchestratorOutput } from '../shared/contracts/canonical.ts';
import { VisionFact } from '../shared/contracts/pmso.ts';
import { TemporalState } from '../shared/knowledge/temporal-types.ts';

// =================================================================================
// MOCK DATA
// =================================================================================

const mockLegacyHTFOutput: Partial<HTFOrchestratorOutput> = {
    htf_bias: 'bullish',
    reasoning: 'Legacy HTF reasoning...'
    // No .facts property
};

const mockLegacyITFOutput: Partial<ITFOrchestratorOutput> = {
    itf_bias: 'bullish',
    reasoning: 'Legacy ITF reasoning...'
    // No .facts property
};

const mockLegacyLTFOutput: Partial<LTFOrchestratorOutput> = {
    direction: 'bullish',
    reasoning: 'Legacy LTF reasoning...'
    // No .facts property
};

const mockModernHTFOutput: Partial<HTFOrchestratorOutput> & { facts: VisionFact[] } = {
    htf_bias: 'bullish',
    reasoning: 'Modern HTF reasoning...',
    facts: [
        { type: 'Displacement', confidence: 0.8, timeframe: 'DAILY', anchor: '1.2345', raw_output: {} },
        { type: 'LiquiditySweep', confidence: 0.9, timeframe: 'DAILY', anchor: '1.2300', raw_output: {} }
    ]
};

// =================================================================================
// TEST RUNNER
// =================================================================================

function runInvestigation() {
    console.log('## ------------------------------------------------------------------');
    console.log('## FORENSIC INVESTIGATION: BUG #2 and #3');
    console.log('## ------------------------------------------------------------------');

    // --- Scenario 1: Legacy Outputs (Hypothesized Current State) ---
    console.log('\n### SCENARIO 1: LEGACY ORCHESTRATOR OUTPUTS (NO .facts)');
    investigate_fact_extraction([mockLegacyHTFOutput, mockLegacyITFOutput, mockLegacyLTFOutput]);

    // --- Scenario 2: Modern Outputs (Expected State) ---
    console.log('\n### SCENARIO 2: MODERN ORCHESTRATOR OUTPUTS (WITH .facts)');
    investigate_fact_extraction([mockModernHTFOutput]); // Only need one for demonstration
}

function investigate_fact_extraction(outputs: any[]) {
    // A. FACT EXTRACTION OUTPUT
    console.log('\n--- A. FACT EXTRACTION ---');
    const facts = PMSOReconciler.extractFactsFromOutputs(outputs);
    console.log('1. `facts.length`:', facts.length);
    console.log('2. `facts.slice(0, 5)`:', facts.slice(0, 5));
    console.log('3. `facts.map(f => f.type)`:', facts.map(f => ({ type: f.type, confidence: f.confidence, timeframe: f.timeframe })));

    // B. TEMPORAL ENGINE INPUT/OUTPUT
    console.log('\n--- B. TEMPORAL ENGINE ---');
    const initialTemporalState: TemporalState = {
        structures: [],
        narrative_continuity: 'Initial session state.',
        session_id: `session_${Date.now()}`,
        last_updated: new Date().toISOString(),
        capture_count: 0
    };
    console.log('1. TemporalEngine Input (facts):', JSON.stringify(facts.slice(0, 5), null, 2));
    console.log('2. Structures count BEFORE reconcile:', initialTemporalState.structures.length);

    const reconciledTemporalState = TemporalEngine.reconcile(facts, initialTemporalState, 'capture_123');
    console.log('3. Structures count AFTER reconcile:', reconciledTemporalState.structures.length);
    console.log('4. Reconciled Temporal State:', JSON.stringify(reconciledTemporalState, null, 2));

    // C. PMSO DEFAULT DOMINANCE
    console.log('\n--- C. PMSO DEFAULTS ---');
    // We need to create a slimmed down version of the reconciler logic to test this.
    const marketMode = reconcileMarketMode_instrumented(facts);
    const liquidityState = reconcileLiquidityState_instrumented(facts);

    console.log('1. Market Mode:', marketMode);
    console.log('2. Liquidity State:', liquidityState);
}

// Instrumented versions of PMSOReconciler private methods
function reconcileMarketMode_instrumented(facts: VisionFact[]) {
    console.log('\n--- PMSO: _reconcileMarketMode ---');
    console.log('Incoming facts:', facts.map(f => f.type));
    const expansionFacts = facts.filter(f =>
        f.type.includes("Displacement") ||
        f.type.includes("Expansion") ||
        f.type.includes("MarketStructureShift")
    );
    console.log('Matched expansion facts:', expansionFacts.length);

    if (expansionFacts.length > 0) {
        return { value: 'expansion', source: 'PMSOReconciler:Derived' };
    }
    return { value: 'consolidation', source: 'PMSOReconciler:Default', fallbackReason: 'No expansion facts found.' };
}

function reconcileLiquidityState_instrumented(facts: VisionFact[]) {
    console.log('\n--- PMSO: _reconcileLiquidityState ---');
    console.log('Incoming facts:', facts.map(f => f.type));
    const sweepFacts = facts.filter(f => f.type.includes("LiquiditySweep") || f.type.includes("RunOnLiquidity"));
    console.log('Matched sweep facts:', sweepFacts.length);

    if (sweepFacts.length > 0) {
        return { value: 'external_range_liquidity_taken', source: 'PMSOReconciler:Derived' };
    }
    return { value: 'internal_range', source: 'PMSOReconciler:Default', fallbackReason: 'No sweep facts found.' };
}

runInvestigation();
