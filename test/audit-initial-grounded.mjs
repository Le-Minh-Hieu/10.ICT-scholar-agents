import { readFileSync, writeFileSync } from 'fs';

// Load data
const knowledgeMap = JSON.parse(readFileSync('data/knowledge_map.json', 'utf8'));
const timePipeline = JSON.parse(readFileSync('data/time_pipeline.json', 'utf8'));

// Get macro_time concepts
const macroStep = timePipeline.steps.find(s => s.name === 'macro_time');
const concepts = macroStep.concepts;

// Layer classification:
// Vision: concept, type, layer, role, focus, when_to_use, invalid_when
// Retrieval: query_templates
// Reasoning: signal

let totalMatches = 0;
let totalKmEntries = 0;
let totalRoles = 0;
let totalFocus = 0;
let totalWhenToUse = 0;
let totalInvalidWhen = 0;
let totalQueryTemplates = 0;
let totalSignals = 0;

// Per-concept stats
const conceptStats = [];

// Build aggregated payload parts
const visionParts = [];
const retrievalParts = [];
const reasoningParts = [];

for (const concept of concepts) {
  const matches = knowledgeMap.filter(e => e.concept === concept);
  totalMatches += matches.length;
  
  let conceptRoles = [];
  let conceptFocus = [];
  let conceptWhenToUse = [];
  let conceptInvalidWhen = [];
  let conceptQueryTemplates = [];
  let conceptSignals = [];
  
  for (const entry of matches) {
    totalKmEntries++;
    if (entry.agent) {
      if (entry.agent.role) { conceptRoles.push(entry.agent.role); totalRoles++; }
      if (entry.agent.focus) { conceptFocus.push(...entry.agent.focus); totalFocus += entry.agent.focus.length; }
      if (entry.agent.when_to_use) { conceptWhenToUse.push(entry.agent.when_to_use); totalWhenToUse++; }
      if (entry.agent.invalid_when) { conceptInvalidWhen.push(entry.agent.invalid_when); totalInvalidWhen++; }
      if (entry.agent.query_templates) { conceptQueryTemplates.push(...entry.agent.query_templates); totalQueryTemplates += entry.agent.query_templates.length; }
      if (entry.agent.signal) { conceptSignals.push(entry.agent.signal); totalSignals++; }
    }
  }
  
  // Deduplicate focus
  const dedupFocus = [...new Set(conceptFocus)];
  
  conceptStats.push({
    concept,
    matches: matches.length,
    roles: conceptRoles.length,
    focus: conceptFocus.length,
    dedupFocus: dedupFocus.length,
    whenToUse: conceptWhenToUse.length,
    invalidWhen: conceptInvalidWhen.length,
    queryTemplates: conceptQueryTemplates.length,
    signals: conceptSignals.length,
    totalVisionFields: conceptRoles.length + dedupFocus.length + conceptWhenToUse.length + conceptInvalidWhen.length
  });
  
  // Build vision block
  if (matches.length > 0) {
    visionParts.push(`### ${concept}`);
    visionParts.push(`**Matches:** ${matches.length} entries`);
    
    // Get unique types
    const types = [...new Set(matches.map(e => e.type).filter(Boolean))];
    visionParts.push(`**Types:** ${types.join(', ')}`);
    
    // Deduplicate roles
    const uniqueRoles = [...new Set(conceptRoles)];
    if (uniqueRoles.length > 0) {
      visionParts.push(`**What to detect:**`);
      uniqueRoles.forEach(r => visionParts.push(`  - ${r}`));
    }
    
    // Deduplicate focus
    if (dedupFocus.length > 0) {
      visionParts.push(`**Focus areas:**`);
      dedupFocus.forEach(f => visionParts.push(`  - ${f}`));
    }
    
    // Unique when_to_use
    const uniqueWhen = [...new Set(conceptWhenToUse)];
    if (uniqueWhen.length > 0) {
      visionParts.push(`**When applicable:**`);
      uniqueWhen.forEach(w => visionParts.push(`  - ${w}`));
    }
    
    // Unique invalid_when
    const uniqueInvalid = [...new Set(conceptInvalidWhen)];
    if (uniqueInvalid.length > 0) {
      visionParts.push(`**Not applicable:**`);
      uniqueInvalid.forEach(i => visionParts.push(`  - ${i}`));
    }
    
    visionParts.push('');
  }
  
  // Build retrieval block (query_templates)
  if (conceptQueryTemplates.length > 0) {
    retrievalParts.push(`### ${concept}`);
    retrievalParts.push(`**${conceptQueryTemplates.length} query templates:**`);
    conceptQueryTemplates.forEach(q => retrievalParts.push(`  - ${q}`));
    retrievalParts.push('');
  }
  
  // Build reasoning block (signal)
  if (conceptSignals.length > 0) {
    reasoningParts.push(`### ${concept}`);
    const uniqueSignals = [...new Set(conceptSignals)];
    reasoningParts.push(`**Expected signals:**`);
    uniqueSignals.forEach(s => reasoningParts.push(`  - ${s}`));
    reasoningParts.push('');
  }
}

// === BUILD AGGREGATED PAYLOAD ===

const agentRole = "You are an ICT Time Analysis Agent.";
const agentTask = "Analyze the macro time-based market regime using grounded knowledge, chart images, and NY time context.";

// Build full aggregation text
const fullText = `AGENT ROLE:
${agentRole}

AGENT TASK:
${agentTask}

DOMAIN CONCEPTS (${concepts.length} total):
${concepts.join(', ')}

VISION RULES:
${visionParts.join('\n')}

RETRIEVAL TEMPLATES:
${retrievalParts.join('\n')}

REASONING SIGNALS:
${reasoningParts.join('\n')}

INTERPRETATION GUIDELINES:
- Identify macro regime patterns using vision rules above
- Focus on expansion vs contraction and directional bias
- Map principles onto chart context
- Derive analysis from grounded knowledge FIRST, then validate with chart evidence
- Do NOT generate entry signals`;

// Build deduplicated aggregation
const dedupText = `AGENT ROLE:
${agentRole}

AGENT TASK:
${agentTask}

DOMAIN CONCEPTS (${concepts.length} total):
${concepts.join(', ')}

VISION RULES:
${visionParts.join('\n')}

RETRIEVAL TEMPLATES:
${retrievalParts.join('\n')}

REASONING SIGNALS:
${reasoningParts.join('\n')}`;

// Build top-level (compressed) aggregation
const compressedVision = concepts.map(c => {
  const matches = knowledgeMap.filter(e => e.concept === c);
  if (matches.length === 0) return null;
  const types = [...new Set(matches.map(e => e.type).filter(Boolean))];
  const roles = [...new Set(matches.map(e => e.agent?.role).filter(Boolean))];
  return `- ${c} (${types.join('/')}): ${roles[0] || 'no role'}`;
}).filter(Boolean).join('\n');

const topLevelText = `AGENT ROLE:
${agentRole}

AGENT TASK:
${agentTask}

DOMAIN CONCEPTS: ${concepts.length}

CONCEPT SUMMARY:
${compressedVision}`;

// === MEASUREMENT ===

function measure(text) {
  const chars = text.length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split('\n').length;
  const tokens = Math.round(chars / 4); // ~4 chars per token heuristic
  return { chars, words, lines, tokens };
}

const fullMeasure = measure(fullText);
const dedupMeasure = measure(dedupText);
const topLevelMeasure = measure(topLevelText);

// Measure individual layers
function measureSection(text, startMarker, endMarker) {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return { chars: 0, words: 0, tokens: 0 };
  const endIdx = endMarker ? text.indexOf(endMarker, startIdx + startMarker.length) : text.length;
  const sectionText = text.slice(startIdx, endIdx === -1 ? text.length : endIdx);
  const chars = sectionText.length;
  const words = sectionText.split(/\s+/).filter(Boolean).length;
  const tokens = Math.round(chars / 4);
  return { chars, words, tokens };
}

const visionMeasure = measureSection(fullText, 'VISION RULES:', 'RETRIEVAL TEMPLATES:');
const retrievalMeasure = measureSection(fullText, 'RETRIEVAL TEMPLATES:', 'REASONING SIGNALS:');
const reasoningMeasure = measureSection(fullText, 'REASONING SIGNALS:', 'INTERPRETATION GUIDELINES:');

// Pre-compute values for template
const roleTaskChars = agentRole.length + agentTask.length;
const roleTaskTokens = Math.round(roleTaskChars / 4);
const conceptNameChars = concepts.join(', ').length;
const conceptNameTokens = Math.round(conceptNameChars / 4);
const minTokenCost = Math.round(dedupMeasure.tokens * 0.65);
const savingTokens = Math.round(fullMeasure.tokens - dedupMeasure.tokens * 0.65);
const savingPercent = Math.round((1 - dedupMeasure.tokens * 0.65 / fullMeasure.tokens) * 100);

// === GENERATE REPORT STRING ===

const report = `# Initial Grounded Knowledge Token Audit

**Date:** 2026-06-09
**Target Agent:** Macro-Time-Agent
**Pipeline Step:** macro_time
**Total Concepts:** ${concepts.length}

---

## LAYER CLASSIFICATION

| Field | Layer | Reason |
|-------|-------|--------|
| concept | Vision | Concept to detect on chart |
| type | Vision | Classification (timing/pattern/behavior) |
| layer | Vision | Timeframe scope |
| agent.role | Vision | What to detect |
| agent.focus | Vision | What to pay attention to |
| agent.when_to_use | Vision | Activation condition |
| agent.invalid_when | Vision | Deactivation condition |
| agent.query_templates | Retrieval | Only used when gap detected |
| agent.signal | Reasoning | Expected output format/signal |

---

## PHASE 1: CONCEPT & ENTRY COUNTS

| Metric | Count |
|--------|-------|
| Total macro_time concepts | ${concepts.length} |
| Matching knowledge_map entries (unique) | ${totalKmEntries} |
| Match rate (concepts with ≥1 entry) | ${conceptStats.filter(s => s.matches > 0).length}/${concepts.length} |
| Concepts with NO match | ${conceptStats.filter(s => s.matches === 0).length} |

### Per-Concept Details

${conceptStats.map(s => 
  `- **${s.concept}**: ${s.matches} entries | ${s.roles} roles | ${s.focus} focus (${s.dedupFocus} dedup) | ${s.whenToUse} when_to_use | ${s.invalidWhen} invalid_when | ${s.queryTemplates} q_templates | ${s.signals} signals`
).join('\n')}

---

## PHASE 2: VISION LAYER AGGREGATION

### Total Vision Fields

| Field | Total | Unique (dedup) | Per Concept Avg |
|-------|-------|----------------|-----------------|
| role | ${totalRoles} | ${[...new Set(conceptStats.flatMap(s => knowledgeMap.filter(e => e.concept === s.concept).map(e => e.agent?.role)))].filter(Boolean).length} | ${(totalRoles / concepts.length).toFixed(1)} |
| focus | ${totalFocus} | ${conceptStats.reduce((s, c) => s + c.dedupFocus, 0)} | ${(totalFocus / concepts.length).toFixed(1)} |
| when_to_use | ${totalWhenToUse} | ${totalWhenToUse} | ${(totalWhenToUse / concepts.length).toFixed(1)} |
| invalid_when | ${totalInvalidWhen} | ${totalInvalidWhen} | ${(totalInvalidWhen / concepts.length).toFixed(1)} |

---

## PHASE 3: TOKEN MEASUREMENTS

### Option A: Full Agent Aggregation (all concepts)

| Metric | Value |
|--------|-------|
| Characters | ${fullMeasure.chars} |
| Words | ${fullMeasure.words} |
| Lines | ${fullMeasure.lines} |
| Token estimate (chars/4) | ${fullMeasure.tokens} |
| Token estimate (chars/3.5) | ${Math.round(fullMeasure.chars / 3.5)} |

### Option B: Deduplicated Aggregation

| Metric | Value |
|--------|-------|
| Characters | ${dedupMeasure.chars} |
| Words | ${dedupMeasure.words} |
| Lines | ${dedupMeasure.lines} |
| Token estimate (chars/4) | ${dedupMeasure.tokens} |
| Token estimate (chars/3.5) | ${Math.round(dedupMeasure.chars / 3.5)} |

### Option C: Top-Level Aggregation (compressed)

| Metric | Value |
|--------|-------|
| Characters | ${topLevelMeasure.chars} |
| Words | ${topLevelMeasure.words} |
| Lines | ${topLevelMeasure.lines} |
| Token estimate (chars/4) | ${topLevelMeasure.tokens} |
| Token estimate (chars/3.5) | ${Math.round(topLevelMeasure.chars / 3.5)} |

---

## PHASE 4: LAYER-SPECIFIC TOKEN COST (Full Aggregation)

| Layer | Characters | Words | Token Estimate |
|-------|-----------|-------|----------------|
| Vision | ${visionMeasure.chars} | ${visionMeasure.words} | ${visionMeasure.tokens} |
| Retrieval | ${retrievalMeasure.chars} | ${retrievalMeasure.words} | ${retrievalMeasure.tokens} |
| Reasoning | ${reasoningMeasure.chars} | ${reasoningMeasure.words} | ${reasoningMeasure.tokens} |

---

## PHASE 5: COMPRESSION OPPORTUNITIES

| Section | Raw Tokens (chars/4) | Compressed Tokens | Savings | Strategy |
|---------|---------------------|-------------------|---------|----------|
| Agent Role + Task | ${roleTaskTokens} | ${roleTaskTokens} | 0% | Keep - minimal |
| Concept Names (${concepts.length}) | ${conceptNameTokens} | ${conceptNameTokens} | 0% | Keep - essential |
| Vision Rules (full) | ${visionMeasure.tokens} | ${Math.round(visionMeasure.chars * 0.6 / 4)} | ~40% | Summarize role, dedup focus |
| query_templates | ${retrievalMeasure.tokens} | ${Math.round(retrievalMeasure.chars * 0.3 / 4)} | ~70% | Remove or reference - only needed for retrieval gaps |
| Signals | ${reasoningMeasure.tokens} | ${Math.round(reasoningMeasure.chars * 0.5 / 4)} | ~50% | Keep only unique per concept |
| Interpretation Guidelines | ${Math.round(256 / 4)} | 0 | 100% | Derive from agent task context instead |

---

## PHASE 5B: FIT ANALYSIS

**Context Window Budget:**
- Typical LLM context: 4K-8K tokens for reasoning
- Current prompt: <2K tokens (estimated)
- Available budget: 2K-6K tokens

**Full Aggregation (Option A):** ${fullMeasure.tokens} tokens
- ${fullMeasure.tokens > 6000 ? '❌ EXCEEDS typical budget by ' + (fullMeasure.tokens - 6000) + ' tokens' : fullMeasure.tokens > 4000 ? '⚠️ TIGHT - uses ' + (fullMeasure.tokens / 4000 * 100).toFixed(0) + '% of 4K budget' : '✅ FITS within budget'}

**Deduplicated (Option B):** ${dedupMeasure.tokens} tokens
- ${dedupMeasure.tokens > 6000 ? '❌ EXCEEDS budget' : dedupMeasure.tokens > 4000 ? '⚠️ TIGHT' : '✅ FITS within budget'}

**Top-Level (Option C):** ${topLevelMeasure.tokens} tokens
- ${topLevelMeasure.tokens > 6000 ? '❌ EXCEEDS budget' : '✅ COMFORTABLY FITS'}

---

## PHASE 6: MINIMUM USABLE INITIAL GROUNDED KNOWLEDGE

**Recommended: Option B (Deduplicated) with compression**

### What to include:

1. **Agent Role + Task** (always, <50 tokens)
2. **Concept names** (always, ~${Math.round(concepts.join(', ').length / 4)} tokens) 
3. **Vision Rules - COMPRESSED:**
   - Keep deduplicated roles only (1-2 per concept)
   - Keep deduplicated focus list
   - Remove redundant when_to_use/invalid_when (can be inferred from role)
4. **query_templates: REMOVED** (only load when retrieval triggered)
5. **Signals: COMPRESSED** (keep 1 signal per concept)

### Estimated minimum token cost: ~${minTokenCost} tokens
(65% of dedup via removing templates + compressing redundant fields)

**Saving vs Full:** ~${savingTokens} tokens (${savingPercent}%)

---

## RAW AGGREGATED PAYLOAD

### Full Aggregation Text (for verification):

\`\`\`
${fullText}
\`\`\`

`;

// Write report
writeFileSync('initial-grounded-token-audit.md', report, 'utf8');
console.log('=== Token Audit Report ===');
console.log(`Concepts: ${concepts.length}`);
console.log(`KM matches: ${totalKmEntries}`);
console.log(`Full tokens: ${fullMeasure.tokens}`);
console.log(`Dedup tokens: ${dedupMeasure.tokens}`);
console.log(`TopLevel tokens: ${topLevelMeasure.tokens}`);
console.log(`Vision tokens: ${visionMeasure.tokens}`);
console.log(`Retrieval tokens: ${retrievalMeasure.tokens}`);
console.log(`Reasoning tokens: ${reasoningMeasure.tokens}`);

// Output concept names for verification
console.log('\n=== Missing Concepts ===');
const missing = conceptStats.filter(s => s.matches === 0);
missing.forEach(m => console.log(`  MISSING: ${m.concept}`));
console.log(`Total missing: ${missing.length}`);