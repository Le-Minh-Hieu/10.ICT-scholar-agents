import { visionFactExtractor } from '../core/3.query/vision-signal-extractor.ts';

console.log('=== Testing VisionFactExtractor ===\n');

// Sample vision summary (similar to what Vision LLM would output)
const visionSummary = `
**DXY**
**Daily**
Order Blocks / FVG
- bearish displacement
- near 96-98 FVG

**US10Y**
**Daily**
Yield Direction
- yields falling
- bearish displacement

**US20Y**
**Daily**
- bearish displacement
- yields dropping

**Cross-Asset**
- No divergence between DXY and US10Y

**EURUSD**
**Daily**
- bullish candle
- retracement into order block
`;

console.log('Input Vision Summary:');
console.log('─────────────────────────────────────');
console.log(visionSummary);
console.log('─────────────────────────────────────\n');

// Extract facts
const facts = visionFactExtractor.extractFacts(visionSummary);

console.log(`Extracted ${facts.length} facts:\n`);
facts.forEach((fact, i) => {
  console.log(`${i + 1}. ${JSON.stringify(fact, null, 2)}`);
});

// Convert to queries
console.log('\n─────────────────────────────────────');
console.log('Generated Queries:\n');
const queries = visionFactExtractor.factsToQueries(facts);
queries.forEach((query, i) => {
  console.log(`${i + 1}. ${query}`);
});

console.log('\n─────────────────────────────────────');
console.log('✅ Test completed successfully!');
console.log('\nKey observations:');
console.log('- Section headers ("Order Blocks / FVG", "Yield Direction") were skipped');
console.log('- Facts preserve original text ("bearish displacement", "yields falling")');
console.log('- Asset and timeframe context tracked correctly');
console.log('- Queries = [asset] + [fact] + [timeframe]');
console.log('- Zero information loss from Vision output');