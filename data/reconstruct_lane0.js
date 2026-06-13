const fs = require('fs');
const km = JSON.parse(fs.readFileSync('./data/knowledge_map.json','utf8'));
const registry = JSON.parse(fs.readFileSync('./data/ontology/master_registry.json','utf8'));

const concepts = [
  'Dollar Index', 'DXY HTF Bias', 'DXY RANGING', 'Economic Calendar',
  'Seasonal Tendencies', 'Seasonal Tendency', 'Seasonal Low', 'Seasonal Influences',
  'Seasonal Divergence', 'Seasonal Earnings Confluence', '10Y TN Seasonal Tendency',
  '20Y TN Seasonal Tendency', 'Quarterly Shifts', 'Quarterly Market Shift',
  'Interest Rate Differentials', 'Interest Rate Analysis', 'Interest Rate Triad',
  'Yield Divergence', 'Yield Seeking & Dollar', 'Dollar Rally Risk Off',
  'Intermarket Analysis', 'Inter-Market Confirmation', 'DXY Divergence',
  'Dollar Index Confirmation', 'Macro Analysis', 'Primary Price Drivers',
  'Fed Chair Testimony', 'Commodity Data Access', 'Commodity Market Segments',
  'Open Interest', 'OPEN INTEREST', 'MACROS'
];

function isValidQuery(q) {
  const n = q.toLowerCase();
  if (['study','learning','how to','basics','mentorship','education'].some(w=>n.includes(w))) return false;
  if (['tips','advice','best practices','beginner','generic'].some(w=>n.includes(w))) return false;
  if (q.length < 3) return false;
  return true;
}

function getCanonical(concept) {
  const lower = concept.toLowerCase();
  for (const e of registry) {
    if (e.canonical.toLowerCase() === lower) return e.canonical;
    for (const t of e.surface_terms) if (t.toLowerCase() === lower) return e.canonical;
  }
  return null;
}

function getRegistryEntry(c) { return registry.find(e => e.canonical.toLowerCase() === c.toLowerCase()); }

function matchKM(concept) {
  const nc = concept.toLowerCase().trim();
  return km.find(e => {
    const ec = e.concept.toLowerCase().trim();
    return ec === nc || ec.includes(nc) || nc.includes(ec);
  });
}

const lines = [];
let total = 0;
let conceptNum = 0;
lines.push('=== LANE 0 RECONSTRUCTION ===');
lines.push('33 pipeline concepts from htf_pipeline.json macro step');
lines.push('Rules: anchor=1, canonical!=concept=+1, alias!=concept!=canonical=+1, template=+1');
lines.push('Intent filter: no TIME/SESSION triggers, no educational/generic queries');
lines.push('---');

for (const c of concepts) {
  conceptNum++;
  if (!isValidQuery(c)) {
    lines.push(`${conceptNum}. "${c}" => 0 (filtered: invalid query)`);
    continue;
  }
  
  let sub = 1;
  let reasons = ['anchor'];
  
  const can = getCanonical(c);
  if (can) {
    if (can.toLowerCase() !== c.toLowerCase()) { sub++; reasons.push('canonical:'+can); }
    const entry = getRegistryEntry(can);
    if (entry) for (const t of entry.surface_terms) {
      if (t.toLowerCase() !== c.toLowerCase() && t.toLowerCase() !== can.toLowerCase()) { sub++; reasons.push('alias:'+t); }
    }
  }
  
  const kmMatch = matchKM(c);
  if (kmMatch) {
    const templates = kmMatch.agent.query_templates.filter(isValidQuery).filter(t => {
      const l = t.toLowerCase();
      return !l.includes('when') && !l.includes('explain') && !l.includes('retrieve');
    });
    sub += templates.length;
    for (const _t of templates) reasons.push('template');
  }
  
  total += sub;
  lines.push(`${conceptNum}. "${c}" => ${sub} (${reasons.join(', ')})`);
}

lines.push('---');
lines.push(`SUM: ${total}`);
lines.push(`TARGET: 73`);
lines.push(`MATCH: ${total === 73 ? 'YES' : 'NO - DIFF = ' + (total - 73)}`);

const output = lines.join('\n');
console.log(output);
fs.writeFileSync('./data/lane0_reconstruction.txt', output);