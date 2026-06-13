const fs = require('fs');
const path = require('path');

const shadowDir = path.join(__dirname, '../data/shadow-debug');
const files = fs.readdirSync(shadowDir).filter(f => f.endsWith('-comparison.json'));

console.log(`Found ${files.length} comparison files.\n`);

const results = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(shadowDir, file), 'utf8');
  const data = JSON.parse(content);
  
  const agent = data.agentType;
  const geminiParsed = data.gemini.parsed || {};
  const orParsed = data.openrouter.parsed || {};
  
  // Extract biases
  const getBias = (obj) => {
    return obj.directional_bias || obj.entry_bias || obj.direction || obj.timing_bias || obj.htf_bias || obj.itf_bias || 'none';
  };
  
  const gBias = getBias(geminiParsed);
  const oBias = getBias(orParsed);
  const biasAgree = String(gBias).toLowerCase().trim() === String(oBias).toLowerCase().trim();
  
  // Extract confidences
  const getConf = (obj) => {
    if (typeof obj.confidence === 'number') return obj.confidence;
    if (typeof obj.confidence === 'string') {
      if (obj.confidence.toLowerCase() === 'high') return 0.9;
      if (obj.confidence.toLowerCase() === 'medium') return 0.6;
      if (obj.confidence.toLowerCase() === 'low') return 0.3;
    }
    return 0;
  };
  const gConf = getConf(geminiParsed);
  const oConf = getConf(orParsed);
  const confDiff = Math.abs(gConf - oConf);
  
  // Structural agreement (keys in Gemini parsed that are also in OR parsed)
  const gKeys = Object.keys(geminiParsed).filter(k => k !== '_grounding_valid');
  const orKeys = Object.keys(orParsed);
  let matchedKeysCount = 0;
  for (const k of gKeys) {
    if (orKeys.includes(k)) {
      matchedKeysCount++;
    }
  }
  const structuralAgreement = gKeys.length > 0 ? (matchedKeysCount / gKeys.length) * 100 : 100;
  
  // Missing fields rate in OpenRouter compared to Gemini
  let missingFieldsCount = 0;
  for (const k of gKeys) {
    if (orParsed[k] === undefined || orParsed[k] === null || orParsed[k] === '') {
      missingFieldsCount++;
    }
  }
  const missingFieldRate = gKeys.length > 0 ? (missingFieldsCount / gKeys.length) * 100 : 0;

  // Calculate Similarity Score
  // Direction Agreement: 40 points
  // Confidence Agreement: 20 points (scaled by diff)
  // Structural Agreement: 20 points
  // Missing Field Rate Penalty: 20 points
  let similarityScore = 0;
  if (biasAgree) similarityScore += 40;
  similarityScore += Math.max(0, 20 * (1 - confDiff));
  similarityScore += 20 * (structuralAgreement / 100);
  similarityScore += Math.max(0, 20 * (1 - missingFieldRate / 100));
  
  // OpenRouter tool check
  const choice = data.openrouter.raw.choices?.[0];
  const toolCalls = choice?.message?.tool_calls;
  const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;
  const toolName = hasToolCalls ? toolCalls[0].function.name : null;
  const toolArgsParsed = hasToolCalls ? (() => {
    try {
      JSON.parse(toolCalls[0].function.arguments);
      return true;
    } catch {
      return false;
    }
  })() : false;
  
  results.push({
    agent,
    bias: { gemini: gBias, openrouter: oBias, agree: biasAgree },
    confidence: { gemini: gConf, openrouter: oConf, diff: confDiff },
    structural: { agreementPercent: structuralAgreement, missingFieldRate },
    similarityScore: Math.round(similarityScore),
    latency: {
      gemini: data.gemini.latency,
      openrouter: data.openrouter.latency
    },
    tokens: {
      gemini: data.gemini.telemetry,
      openrouter: data.openrouter.telemetry
    },
    toolCall: {
      hasToolCalls,
      toolName,
      parsed: toolArgsParsed,
      choice
    }
  });
}

console.log(JSON.stringify(results, null, 2));
