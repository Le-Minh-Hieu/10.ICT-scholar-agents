import { readFileSync, writeFileSync } from 'fs';

// =====================================================
// MACRO-TIME-AGENT VISION-FIRST PIPELINE STANDALONE TEST
// =====================================================

// --- LOAD DATA ---
const knowledgeMap = JSON.parse(readFileSync('data/knowledge_map.json', 'utf8'));
const timePipeline = JSON.parse(readFileSync('data/time_pipeline.json', 'utf8'));

// --- CONFIG ---
const LAYER = 'HTF'; // Which layer to filter
const CONCEPT_MATCH_THRESHOLD = 0.6; // Confidence floor

// =====================================================
// 1. buildInitialGrounded()
// =====================================================
function buildInitialGrounded(knowledgeMap, pipeline, layer) {
  const macroStep = pipeline.steps.find(s => s.name === 'macro_time');
  const pipelineConcepts = macroStep ? macroStep.concepts : [];

  const visionFields = knowledgeMap.filter(e =>
    pipelineConcepts.some(c =>
      e.concept.toLowerCase().includes(c.toLowerCase()) ||
      c.toLowerCase().includes(e.concept.toLowerCase())
    ) && (layer ? e.layer === layer : true)
  );

  const initialContext = visionFields.map(e =>
    `[${e.concept}] type=${e.type} layer=${e.layer} signal=${e.agent.signal} focus=${e.agent.focus.join(',')}`
  ).join('\n');

  const queryIntent = `macro_time_${layer?.toLowerCase() || 'general'}`;

  return { pipelineConcepts, visionFields, initialContext, queryIntent };
}

// =====================================================
// 2. extractVision() — MOCK with synthetic output
//    (real LLM call would be here)
// =====================================================
function extractVision(chartPaths, initialGrounded) {
  // Simulate vision analysis based on initial grounded knowledge
  const detectedConcepts = [];
  const pipelineSet = initialGrounded.pipelineConcepts.map(c => c.toLowerCase());

  // Simulate partial detection: match ~60% of vision fields + some pipeline
  // to simulate a real but imperfect vision model
  for (const entry of initialGrounded.visionFields) {
    // Detect all vision-field matched concepts
    detectedConcepts.push(entry.concept);
  }

  // Detect ~20% of remaining pipeline concepts partially
  const remaining = initialGrounded.pipelineConcepts.filter(c =>
    !initialGrounded.visionFields.some(vf =>
      vf.concept.toLowerCase() === c.toLowerCase()
    )
  );
  const partialCount = Math.max(1, Math.floor(remaining.length * 0.2));
  for (let i = 0; i < partialCount && i < remaining.length; i++) {
    detectedConcepts.push(remaining[i]);
  }

  // Add baseline chart-level concepts
  detectedConcepts.push('Market Structure');
  detectedConcepts.push('Liquidity Sweep');

  // Determine regime from signals
  const signals = initialGrounded.visionFields.map(e => e.agent.signal).filter(Boolean);
  const hasTiming = signals.some(s => s.toLowerCase().includes('time') || s.toLowerCase().includes('timing'));
  const regime = hasTiming ? 'consolidation_phase' : 'directional_expansion';

  // Confidence based on ratio of detected vs pipeline
  const uniqueDetected = [...new Set(detectedConcepts)];
  const matchedCount = uniqueDetected.filter(d =>
    initialGrounded.pipelineConcepts.some(p =>
      d.toLowerCase().includes(p.toLowerCase()) ||
      p.toLowerCase().includes(d.toLowerCase())
    )
  ).length;
  const confidence = Math.min(1, matchedCount / Math.max(1, initialGrounded.pipelineConcepts.length) * 2.0);

  return {
    marketInterpretation: `Charts show ${regime.replace('_', ' ')} with ${uniqueDetected.length} concepts identified`,
    detectedConcepts: uniqueDetected,
    confidence: Math.round(confidence * 100) / 100,
    visionSummary: `Layer=${initialGrounded.queryIntent} concepts=${uniqueDetected.length} regime=${regime}`,
    chartPatterns: ['structural_pullback', 'liquidity_sweep', 'order_block'],
    regimeObservation: regime,
  };
}

// =====================================================
// 3. detectKnowledgeGaps()
// =====================================================
function detectKnowledgeGaps(visionOutput, initialGrounded) {
  const gaps = [];

  // Strategy 1: Pipeline concepts not detected
  for (const pc of initialGrounded.pipelineConcepts) {
    const found = visionOutput.detectedConcepts.some(dc =>
      dc.toLowerCase().includes(pc.toLowerCase()) ||
      pc.toLowerCase().includes(dc.toLowerCase())
    );
    if (!found) {
      gaps.push({
        area: pc,
        missingContext: `Vision did not detect "${pc}" in charts`,
        priority: visionOutput.confidence < CONCEPT_MATCH_THRESHOLD ? 'high' : 'medium',
        relatedConcept: pc,
        gapType: pc.toLowerCase().includes('time') || pc.toLowerCase().includes('calendar') || pc.toLowerCase().includes('seasonal') ? 'temporal' : 'structural',
      });
    }
  }

  // Strategy 2: Low confidence
  if (visionOutput.confidence < CONCEPT_MATCH_THRESHOLD) {
    gaps.push({
      area: 'vision_confidence',
      missingContext: `Low vision confidence (${visionOutput.confidence.toFixed(2)}), needs textual grounding`,
      priority: 'high',
      relatedConcept: 'general',
      gapType: 'conceptual',
    });
  }

  // Strategy 3: Regime check
  const knownRegimes = ['expansion', 'consolidation', 'retracement', 'reversal', 'distribution', 'accumulation'];
  const regimeMatch = knownRegimes.some(r => visionOutput.regimeObservation.toLowerCase().includes(r));
  if (!regimeMatch) {
    gaps.push({
      area: 'regime_identification',
      missingContext: `Unclear regime: "${visionOutput.regimeObservation}"`,
      priority: 'medium',
      relatedConcept: 'market_regime',
      gapType: 'structural',
    });
  }

  return {
    gaps,
    gapSummary: gaps.map(g => `[${g.priority}] ${g.area}: ${g.missingContext}`).join('\n'),
  };
}

// =====================================================
// 4. generateQueriesFromGaps()
// =====================================================
function generateQueriesFromGaps(gaps) {
  const weightedQueries = [];
  const expandedConcepts = new Set(gaps.map(g => g.area));

  for (const gap of gaps) {
    let weight;
    switch (gap.priority) {
      case 'high': weight = 1.0; break;
      case 'medium': weight = 0.6; break;
      case 'low': weight = 0.3; break;
      default: weight = 0.5;
    }

    weightedQueries.push({
      query: `Find ICT knowledge about ${gap.area} in context of ${gap.relatedConcept}`,
      weight,
      type: gap.gapType === 'temporal' ? 'anchor' :
            gap.gapType === 'structural' ? 'canonical' :
            gap.gapType === 'behavioral' ? 'context' : 'alias',
    });
  }

  return { weightedQueries, expandedConcepts: [...expandedConcepts] };
}

// =====================================================
// 5. RUN VISION-FIRST PIPELINE
// =====================================================

function runPipeline() {
  console.log('========================================');
  console.log('  MACRO-TIME-AGENT VISION-FIRST PIPELINE');
  console.log(`  Layer: ${LAYER}`);
  console.log('========================================\n');

  // Step 1: buildInitialGrounded
  console.log('▶ Step 1: buildInitialGrounded()');
  const initialGrounded = buildInitialGrounded(knowledgeMap, timePipeline, LAYER);
  console.log(`  Pipeline concepts: ${initialGrounded.pipelineConcepts.length}`);
  console.log(`  Vision fields matched: ${initialGrounded.visionFields.length}`);
  console.log(`  Query intent: ${initialGrounded.queryIntent}`);
  console.log(`  Sample context:\n${initialGrounded.visionFields.slice(0, 3).map(e => `    [${e.concept}]`).join('\n')}\n`);

  // Step 2: extractVision (mock)
  console.log('▶ Step 2: extractVision() [MOCK]');
  const visionOutput = extractVision([], initialGrounded);
  console.log(`  Detected concepts: ${visionOutput.detectedConcepts.length}`);
  console.log(`  Confidence: ${visionOutput.confidence.toFixed(2)}`);
  console.log(`  Regime: ${visionOutput.regimeObservation}`);
  console.log(`  Interpretation: ${visionOutput.marketInterpretation.substring(0, 80)}...\n`);

  // Step 3: detectKnowledgeGaps
  console.log('▶ Step 3: detectKnowledgeGaps()');
  const gapResult = detectKnowledgeGaps(visionOutput, initialGrounded);
  console.log(`  Gaps found: ${gapResult.gaps.length}`);
  console.log(`  Summary:\n${gapResult.gaps.slice(0, 5).map(g => `    [${g.priority}] ${g.area} (${g.gapType})`).join('\n')}\n`);

  // Step 4: generateQueriesFromGaps
  console.log('▶ Step 4: generateQueriesFromGaps()');
  const { weightedQueries, expandedConcepts } = generateQueriesFromGaps(gapResult.gaps);
  console.log(`  Weighted queries: ${weightedQueries.length}`);
  console.log(`  Expanded concepts: ${expandedConcepts.length}`);
  console.log(`  Sample queries:\n${weightedQueries.slice(0, 3).map(q => `    [${q.weight}] ${q.query}`).join('\n')}\n`);

  // --- SUMMARY ---
  console.log('========================================');
  console.log('  PIPELINE COMPLETE');
  console.log('========================================');
  console.log(`  Pipeline concepts:     ${initialGrounded.pipelineConcepts.length}`);
  console.log(`  Vision matches:        ${initialGrounded.visionFields.length}`);
  console.log(`  Concepts detected:     ${visionOutput.detectedConcepts.length}`);
  console.log(`  Knowledge gaps:        ${gapResult.gaps.length}`);
  console.log(`  Weighted queries gen:  ${weightedQueries.length}`);
  console.log(`  Expanded concept set:  ${expandedConcepts.length}`);
  console.log('========================================\n');

  // --- EXPORT DEBUG OUTPUT ---
  const debugOutput = {
    config: { layer: LAYER },
    initialGrounded: {
      conceptCount: initialGrounded.pipelineConcepts.length,
      visionFieldCount: initialGrounded.visionFields.length,
      queryIntent: initialGrounded.queryIntent,
      sampleContext: initialGrounded.initialContext.substring(0, 500),
    },
    visionOutput: {
      detectedCount: visionOutput.detectedConcepts.length,
      confidence: visionOutput.confidence,
      regime: visionOutput.regimeObservation,
      interpretation: visionOutput.marketInterpretation,
      patterns: visionOutput.chartPatterns,
    },
    gaps: {
      count: gapResult.gaps.length,
      items: gapResult.gaps,
      summary: gapResult.gapSummary,
    },
    queries: {
      count: weightedQueries.length,
      items: weightedQueries,
      expandedConcepts,
    },
    summary: {
      missingRate: (1 - visionOutput.detectedConcepts.length / initialGrounded.pipelineConcepts.length).toFixed(2),
      expandedRate: ((expandedConcepts.length - initialGrounded.pipelineConcepts.length) / initialGrounded.pipelineConcepts.length * 100).toFixed(1) + '%',
    },
  };

  writeFileSync('data/rag-debug/macro-time-vision-first-test.json', JSON.stringify(debugOutput, null, 2));
  console.log('📝 Debug output: data/rag-debug/macro-time-vision-first-test.json\n');

  return debugOutput;
}

runPipeline();