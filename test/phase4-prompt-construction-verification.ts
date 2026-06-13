import { htfStructureAgent } from '../core/3.query/agents/htf/htf-structure-agent';
import { buildPrompt } from '../core/3.query/prompt-builder';
import { HierarchicalMemory } from '../shared/knowledge/hierarchical-types';

console.log('PHASE 4 PROMPT CONSTRUCTION VERIFICATION');

async function runVerification() {
  // =================================================================
  // SETUP: MOCK DEPENDENCIES
  // =================================================================

  const dummyChunks = [
    { chunk_id: 'chunk_1', text: 'Price is showing bullish momentum.', score: 0.9 },
    { chunk_id: 'chunk_2', text: 'There is a bearish divergence on the weekly chart.', score: 0.8 },
  ];

  // =================================================================
  // VERIFICATION 1: PROMPT ASSEMBLY ORDER
  // =================================================================

  console.log('\n// VERIFICATION 1: PROMPT ASSEMBLY ORDER');

  const input = { eurusd: { d: 'path/to/d', w: 'path/to/w', m: 'path/to/m' } };
  const minimal_context = {
    parent_thesis: {
      timeframe: 'WEEKLY',
      bias: 'bullish',
      summary: 'Weekly chart is showing bullish signs.',
      key_anchors: ['anchor1'],
      shift_conditions: 'none',
      confidence: { conviction: 0.7, timing: 0.5, execution: 0.6 },
    },
  };

  const prompt = buildPrompt({
      role: 'You are an ICT structure FACT EXTRACTION system. Do NOT infer bias or probabilities.',
      task: `Identify ALL potential HTF market structure facts and SMT Divergence signals. 
    Analyze the visible charts and output ONLY objective observations. Assign a confidence to each observation.`,
      groundedKnowledge: dummyChunks.map(c => c.text).join('\n'),
      inputContext: '* EURUSD (M → W → D)\n- GBPUSD (M → W → D) [SMT Pair]',
      constraints: [
        "MANDATORY OUTPUT: An array of VisionFact objects for each detected element.",
        "SMT Detection: Bullish SMT (EURUSD LL + GBPUSD HL), Bearish SMT (EURUSD HH + GBPUSD LH). Report as a fact with confidence.",
        "Detect Fair Value Gaps (FVG) and Breaker Blocks (BB) and report as facts.",
        "Detect Liquidity Sweeps and Structure Shifts. Report as facts.",
        "Assign a confidence score (0.0-1.0) to each fact based on visual clarity.",
        "DO NOT infer market bias (bullish/bearish) or overall market direction.",
        "DO NOT reconcile opposing facts; report both with their respective confidences.",
        "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
      ],
      outputFormat: `{
        "principles": [{"rule": "...", "chunk_id": "..."}],
        "facts": [
          {"type": "possible_fvg", "confidence": { "conviction": 0.8, "timing": 0.5, "execution": 0.9 }, "anchor": "Daily Low FVG", "timeframe": "DAILY"},
          {"type": "potential_liquidity_sweep", "confidence": { "conviction": 0.7, "timing": 0.8, "execution": 0.5 }, "anchor": "Previous Week High", "timeframe": "WEEKLY"}
        ],
        "references": ["CHUNK_ID:..."],
        "confidence": { "conviction": "number", "timing": "number", "execution": "number" }, 
        "notes": "Step-by-step reasoning"
      }`,
  }, minimal_context as any);

  const retrievalIndex = prompt.indexOf('Price is showing bullish momentum.');
  const memoryIndex = prompt.indexOf('PROBABILISTIC CONTEXT ANCHOR (FROM WEEKLY)');
  console.log('Retrieval index:', retrievalIndex, 'Memory index:', memoryIndex);
  if (retrievalIndex > memoryIndex) {
      console.log('PASS: RETRIEVAL DOMINANT - Retrieval chunks appear after the memory anchor.');
  } else {
      console.error('FAIL: RETRIEVAL DOMINANT - Retrieval chunks do not appear after the memory anchor.');
  }

  // =================================================================
  // VERIFICATION 2: HIERARCHICAL CONTEXT ABSENT
  // =================================================================

  console.log('\n// VERIFICATION 2: HIERARCHICAL CONTEXT ABSENT');

  const prompt2 = buildPrompt({
      role: 'You are an ICT structure FACT EXTRACTION system. Do NOT infer bias or probabilities.',
      task: `Identify ALL potential HTF market structure facts and SMT Divergence signals. 
    Analyze the visible charts and output ONLY objective observations. Assign a confidence to each observation.`,
      groundedKnowledge: dummyChunks.map(c => c.text).join('\n'),
      inputContext: '* EURUSD (M → W → D)\n- GBPUSD (M → W → D) [SMT Pair]',
      constraints: [
        "MANDATORY OUTPUT: An array of VisionFact objects for each detected element.",
        "SMT Detection: Bullish SMT (EURUSD LL + GBPUSD HL), Bearish SMT (EURUSD HH + GBPUSD LH). Report as a fact with confidence.",
        "Detect Fair Value Gaps (FVG) and Breaker Blocks (BB) and report as facts.",
        "Detect Liquidity Sweeps and Structure Shifts. Report as facts.",
        "Assign a confidence score (0.0-1.0) to each fact based on visual clarity.",
        "DO NOT infer market bias (bullish/bearish) or overall market direction.",
        "DO NOT reconcile opposing facts; report both with their respective confidences.",
        "You MUST explicitly reference CHUNK_ID inside both principles and reasoning notes"
      ],
      outputFormat: `{
        "principles": [{"rule": "...", "chunk_id": "..."}],
        "facts": [
          {"type": "possible_fvg", "confidence": { "conviction": 0.8, "timing": 0.5, "execution": 0.9 }, "anchor": "Daily Low FVG", "timeframe": "DAILY"},
          {"type": "potential_liquidity_sweep", "confidence": { "conviction": 0.7, "timing": 0.8, "execution": 0.5 }, "anchor": "Previous Week High", "timeframe": "WEEKLY"}
        ],
        "references": ["CHUNK_ID:..."],
        "confidence": { "conviction": "number", "timing": "number", "execution": "number" }, 
        "notes": "Step-by-step reasoning"
      }`,
  }, {});
  if (!prompt2.includes('PROBABILISTIC CONTEXT ANCHOR')) {
      console.log('PASS: HIERARCHICAL CONTEXT ABSENT - Prompt does not contain memory anchor when not provided.');
  } else {
      console.error('FAIL: HIERARCHICAL CONTEXT ABSENT - Prompt contains memory anchor when not provided.');
  }

  // =================================================================
  // VERIFICATION 3: CONTEXT COLLISION DETECTED
  // =================================================================

  console.log('\n// VERIFICATION 3: CONTEXT COLLISION DETECTED');

  const bullish = prompt.includes('bullish');
  const bearish = prompt.includes('bearish');

  if (bullish && bearish) {
      console.log('PASS: CONTEXT COLLISION DETECTED - Prompt contains both bullish and bearish signals.');
  } else {
      console.error('FAIL: CONTEXT COLLISION DETECTED - Prompt does not contain both bullish and bearish signals.');
  }
}

runVerification().catch(console.error);
