/**
 * Vision-First Demo: demonstrates buildVisionKnowledge + extractConceptsFromVision live.
 * Dumps: visionSummary (mock), final queries, retrieved chunks, final prompt size.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// ---- LOAD REAL DATA ----
const knowledgeMap = JSON.parse(readFileSync('data/knowledge_map.json', 'utf8'));
const htfPipeline = JSON.parse(readFileSync('data/htf_pipeline.json', 'utf8'));
const timePipeline = JSON.parse(readFileSync('data/time_pipeline.json', 'utf8'));

const OUT = 'data/rag-debug/vision-first-demo';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// ---- HELPER: pretty clip ----
function clip(s, n = 200) {
  if (!s) return '(empty)';
  return s.length > n ? s.slice(0, n) + `... (${s.length} total)` : s;
}

// ========================================================
// DEMO 1: buildVisionKnowledge() with htf_pipeline "macro" step
// ========================================================
console.log('=== DEMO 1: buildVisionKnowledge() output sample ===\n');

const macroStepConcepts = htfPipeline.steps.find(s => s.name === 'macro')?.concepts || [];
console.log(`Step concepts (${macroStepConcepts.length}):`, macroStepConcepts);

// Replicate the function inline for demonstration (same logic as vision-grounded-knowledge.ts)
function buildVisionKnowledge(pipeline, stepName, km) {
  const step = pipeline.steps.find(s => s.name === stepName);
  if (!step) return '';
  const lines = [];
  lines.push('## VISION GROUNDED KNOWLEDGE');
  lines.push(`Step: ${stepName}`);
  lines.push('Below are ICT concepts relevant to this analysis step, with detection criteria.\n');
  let count = 0;
  for (const concept of step.concepts) {
    const entry = km.find(k => k.concept.toLowerCase().trim() === concept.toLowerCase().trim());
    if (!entry?.agent) continue;
    count++;
    lines.push(`### ${entry.concept}`);
    lines.push(`- Type: ${entry.type}`);
    lines.push(`- Layer: ${entry.layer}`);
    lines.push(`- Role: ${entry.agent.role}`);
    if (entry.agent.focus?.length) lines.push(`- Focus: ${entry.agent.focus.join(', ')}`);
    if (entry.agent.signal) lines.push(`- Signal: ${entry.agent.signal}`);
    if (entry.agent.when_to_use) lines.push(`- When to use: ${entry.agent.when_to_use}`);
    if (entry.agent.invalid_when) lines.push(`- Invalid when: ${entry.agent.invalid_when}`);
    if (entry.agent.query_templates?.length) lines.push(`- Query templates: ${entry.agent.query_templates.slice(0, 3).join(' | ')}`);
    lines.push('');
  }
  lines.push(`--- End of vision grounded knowledge (${count} concepts matched)`);
  return lines.join('\n');
}

const visionGrounded = buildVisionKnowledge(htfPipeline, 'macro', knowledgeMap);
console.log('Vision Grounded Knowledge string:');
console.log('─────────────────────────────────────');
console.log(visionGrounded);
console.log('─────────────────────────────────────');
console.log(`Length: ${visionGrounded.length} chars / ~${Math.ceil(visionGrounded.length / 4)} tokens\n`);

writeFileSync(join(OUT, '01_visionGrounded.txt'), visionGrounded, 'utf8');

// ========================================================
// DEMO 2: extractConceptsFromVision() implementation & demo
// ========================================================
console.log('=== DEMO 2: extractConceptsFromVision() implementation ===\n');

function extractConceptsFromVision(visionSummary, stepConcepts) {
  if (!visionSummary || !stepConcepts.length) return [];
  const lowerSummary = visionSummary.toLowerCase();
  const found = new Set();
  for (const concept of stepConcepts) {
    const lower = concept.toLowerCase();
    if (lower.length < 2) continue;
    if (
      lowerSummary.includes(lower) ||
      concept.split(' ').some(word => word.length > 3 && lowerSummary.includes(word.toLowerCase()))
    ) {
      found.add(concept);
    }
  }
  return Array.from(found);
}

// Simulate a vision summary like the LLM would produce
const mockVisionSummary = `LIVE CHART OBSERVATIONS:
- DXY: Bearish displacement visible on daily chart, price below prior day low. Large bearish candle with no visible wick on the downside. Weekly DXY also bearish.
- US10Y: Yields falling (price rising). Bullish engulfing on US10Y daily. This is divergence vs DXY bearishness.
- EURUSD: Price pushing up. No obvious FVG on daily. Weekly order block at 1.0950 remains untested.
- DXY displacement, yield falling, correlated asset divergence all present.
Key concepts: DXY displacement, Yield Correlation, Correlated Asset Divergence`;
console.log('Mock vision summary:');
console.log(clip(mockVisionSummary, 300), '\n');

const htfMacroConcepts = htfPipeline.steps.find(s => s.name === 'macro')?.concepts || [];
console.log(`HTF macro step concepts (${htfMacroConcepts.length}):`, htfMacroConcepts, '\n');

const extracted = extractConceptsFromVision(mockVisionSummary, htfMacroConcepts);
console.log('Concepts extracted from vision summary:', extracted, '\n');

// ========================================================
// DEMO 3: Full flow simulation (vision → query expansion)
// ========================================================
console.log('=== DEMO 3: Full vision-first flow simulation ===\n');

// Step A: Build queries from original concepts
function buildQueries(concepts, km) {
  const queries = [];
  for (const c of concepts) {
    const entry = km.find(k => k.concept.toLowerCase().trim() === c.toLowerCase().trim());
    if (entry?.agent?.query_templates) {
      for (const qt of entry.agent.query_templates.slice(0, 2)) {
        queries.push({ query: qt, weight: 1.0, type: 'canonical' });
      }
    } else {
      queries.push({ query: `ICT concept: ${c}`, weight: 0.5, type: 'alias' });
    }
  }
  return queries;
}

const originalConcepts = htfMacroConcepts;
const originalQueries = buildQueries(originalConcepts, knowledgeMap);
console.log(`Original concepts: ${originalConcepts.length}`);
console.log('Original concepts list:', originalConcepts, '\n');
console.log(`Original queries (${originalQueries.length}):`);
originalQueries.forEach((q, i) => console.log(`  ${i}: [${q.weight}] ${q.query}`));
console.log();

// Step B: Merge vision concepts
const visionConcepts = extracted; // from mock
if (visionConcepts.length > 0) {
  const merged = [...new Set([...originalConcepts, ...visionConcepts])];
  const expandedQueries = buildQueries(merged, knowledgeMap);
  console.log(`After vision expansion:`);
  console.log(`  Original: ${originalConcepts.length} concepts`);
  console.log(`  Vision added: ${visionConcepts.length} concepts`);
  console.log(`  Merged: ${merged.length} concepts`);
  console.log(`  Expanded queries: ${expandedQueries.length} (was ${originalQueries.length})`);
  console.log(`  New concepts from vision:`, visionConcepts.filter(v => !originalConcepts.includes(v)), '\n');
  
  // Show query diff
  const addedQueries = expandedQueries.filter(eq => !originalQueries.some(oq => oq.query === eq.query));
  if (addedQueries.length > 0) {
    console.log('  New queries from vision expansion:');
    addedQueries.slice(0, 5).forEach((q, i) => console.log(`    ${i}: [${q.weight}] ${q.query}`));
  }
}

// ========================================================
// DEMO 4: Simulate final prompt composition
// ========================================================
console.log('\n=== DEMO 4: Final prompt composition (size estimation) ===\n');

const role = 'You are an ICT macro FACT EXTRACTION system. Do NOT infer directional bias.';
const task = 'Identify ALL macro intermarket facts (DXY moves, Yield shifts, Correlated asset behaviour).';
const constraints = [
  'MANDATORY OUTPUT: An array of VisionFact objects for each detected macro element.',
  'Report DXY movement as a fact (e.g. \'DXY_displacement_bearish\').',
  'Report Yield movement as a fact (e.g. \'Yield_rising\').',
  'Report Correlated asset divergence if visible.',
  'DO NOT decide if this makes EURUSD bullish or bearish.'
];
const outputFormat = `{
  "facts": [{"type": "dxy_bearish_displacement", "confidence": 0.85}],
  "confidence": 0.8,
  "notes": "Reasoning"
}`;

// Simulated vision summary (what the vision LLM returned)
const simVisionSummary = mockVisionSummary;

// Simulated grounded text from RAG (truncated for demo)
const simGrounded = `[RAG CONTEXT]
Chunk 1 (confidence 0.92): DXY daily chart shows clear bearish displacement with momentum. Yield correlation is inverse: US10Y falling.
Chunk 2 (confidence 0.87): Correlated asset divergence detected when DXY bearish and yields falling simultaneously.`;
const simGroundedWithVision = `## LIVE MARKET OBSERVATIONS (VISION PRIMARY)\n${simVisionSummary}\n\n## HISTORICAL REFERENCE (RAG SECONDARY)\n${simGrounded}`;

const promptComponents = [
  `Role: ${role}`,
  `Task: ${task}`,
  `Constraints:\n${constraints.map((c, i) => `${i+1}. ${c}`).join('\n')}`,
  `Output format:\n${outputFormat}`,
  `Grounded knowledge:\n${simGroundedWithVision}`,
];

const fullPrompt = promptComponents.join('\n\n---\n\n');

console.log('Full prompt composition:');
console.log('─────────────────────────────────────');
console.log(clip(fullPrompt, 500));
console.log('─────────────────────────────────────');
console.log(`Prompt length: ${fullPrompt.length} chars`);
console.log(`Estimated tokens: ~${Math.ceil(fullPrompt.length / 4)}`);
console.log();

// ========================================================
// WRITE DEBUG DUMP
// ========================================================
const debugDump = {
  demo1_buildVisionKnowledge: {
    step: 'macro',
    pipeline: 'htf_pipeline.json',
    conceptCount: macroStepConcepts.length,
    matchedConcepts: visionGrounded.match(/### /g)?.length || 0,
    outputLength: visionGrounded.length,
    outputTokens: Math.ceil(visionGrounded.length / 4),
  },
  demo2_extractConcepts: {
    algorithm: 'substring + word-partial match from vision summary to step concepts',
    visionSummaryLength: mockVisionSummary.length,
    stepConceptsCount: htfMacroConcepts.length,
    extractedCount: extracted.length,
    extracted,
    missedConcepts: htfMacroConcepts.filter(c => !extracted.includes(c)),
  },
  demo3_queryExpansion: {
    originalConcepts: originalConcepts.length,
    visionAdded: visionConcepts.filter(v => !originalConcepts.includes(v)),
    mergedConcepts: [...new Set([...originalConcepts, ...visionConcepts])].length,
    originalQueries: originalQueries.length,
    mergedQueriesCount: buildQueries([...new Set([...originalConcepts, ...visionConcepts])], knowledgeMap).length,
  },
  demo4_promptSize: {
    visionSummaryLength: simVisionSummary.length,
    groundedLength: simGrounded.length,
    groundedWithVisionLength: simGroundedWithVision.length,
    fullPromptLength: fullPrompt.length,
    fullPromptTokens: Math.ceil(fullPrompt.length / 4),
    components: {
      role: role.length,
      task: task.length,
      constraints: constraints.join('\n').length,
      outputFormat: outputFormat.length,
      groundedWithVision: simGroundedWithVision.length,
    }
  },
  config: {
    pipelinePath: 'data/htf_pipeline.json',
    step: 'macro',
    agentName: 'HTF-Macro-Agent',
  },
};

writeFileSync(join(OUT, '00_DEBUG_DUMP.json'), JSON.stringify(debugDump, null, 2), 'utf8');
console.log(`📝 Full debug dump: ${join(OUT, '00_DEBUG_DUMP.json')}`);

// Print summary
console.log('\n=== SUMMARY ===');
console.log(`buildVisionKnowledge(): matched ${debugDump.demo1_buildVisionKnowledge.matchedConcepts} concepts → ${debugDump.demo1_buildVisionKnowledge.outputTokens} tokens`);
console.log(`extractConceptsFromVision(): extracted ${debugDump.demo2_extractConcepts.extractedCount}/${debugDump.demo2_extractConcepts.stepConceptsCount} step concepts from vision summary`);
console.log(`Query expansion: ${debugDump.demo3_queryExpansion.originalConcepts} → ${debugDump.demo3_queryExpansion.mergedConcepts} concepts (${debugDump.demo3_queryExpansion.originalQueries} → ${debugDump.demo3_queryExpansion.mergedQueriesCount} queries)`);
console.log(`Final prompt: ~${debugDump.demo4_promptSize.fullPromptTokens} tokens\n`);