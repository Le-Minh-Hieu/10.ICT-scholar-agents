const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sessionsDir = path.join(root, 'data', 'sessions');

function walkDir(dir) {
  const results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  list.forEach((it) => {
    if (it.isDirectory()) {
      results.push(...walkDir(path.join(dir, it.name)));
    } else {
      results.push(path.join(dir, it.name));
    }
  });
  return results;
}

function findFullJsonPaths() {
  const paths = [];
  const days = fs.readdirSync(sessionsDir);
  days.forEach((day) => {
    const dayPath = path.join(sessionsDir, day);
    if (!fs.existsSync(dayPath)) return;
    const sessions = fs.readdirSync(dayPath);
    sessions.forEach((sess) => {
      const sessPath = path.join(dayPath, sess);
      const capturesPath = path.join(sessPath, 'captures');
      if (!fs.existsSync(capturesPath)) return;
      const captures = fs.readdirSync(capturesPath);
      captures.forEach((cap) => {
        const fullPath = path.join(capturesPath, cap, 'full.json');
        const metaPath = path.join(capturesPath, cap, 'metadata.json');
        if (fs.existsSync(fullPath) && fs.existsSync(metaPath)) {
          paths.push({ fullPath, metaPath });
        }
      });
    });
  });
  return paths;
}

function safeReadJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    return null;
  }
}

function extractBiasFromLayers(full) {
  const out = { htf: null, itf: null, ltf: null };
  if (!full || typeof full !== 'object') return out;
  // LTF: top-level direction or entry
  if (full.direction) out.ltf = full.direction;
  if (full.entry) out.ltf = out.ltf || full.entry;

  // try layers weekly/daily/monthly
  const layers = full.layers || {};
  if (layers.weekly && layers.weekly.compact_output) {
    out.htf = layers.weekly.compact_output.directional_bias || out.htf;
  }
  if ((!out.htf || out.htf === 'unknown') && layers.monthly && layers.monthly.compact_output) {
    out.htf = layers.monthly.compact_output.directional_bias || out.htf;
  }
  if (layers.daily && layers.daily.compact_output) {
    out.itf = layers.daily.compact_output.directional_bias || out.itf;
  }
  // fallback search
  if (!out.htf && full.htf_bias) out.htf = full.htf_bias;
  if (!out.itf && full.itf_bias) out.itf = full.itf_bias;

  return out;
}

function containsKeyword(obj, keyword) {
  try {
    const s = JSON.stringify(obj).toLowerCase();
    return s.indexOf(keyword.toLowerCase()) !== -1;
  } catch (e) { return false; }
}

function analyze(paths, take = 30) {
  const items = paths.map(p => {
    const meta = safeReadJson(p.metaPath) || {};
    const full = safeReadJson(p.fullPath) || {};
    return { meta, full, path: p.fullPath };
  });
  items.sort((a,b) => {
    const ta = a.meta.timestamp_utc || a.meta.timestamp_ny || 0;
    const tb = b.meta.timestamp_utc || b.meta.timestamp_ny || 0;
    return new Date(tb) - new Date(ta);
  });
  const sample = items.slice(0, take);

  const stats = {
    total: sample.length,
    directionCounts: {},
    executeCounts: { true: 0, false: 0 },
    avgConfidence: null,
    confidences: [],
    htfCounts: {},
    itfCounts: {},
    ltfCounts: {},
    newsOverrides: 0,
    pmsoOverrides: 0,
    deliveryModelRefs: 0,
    pmsos: [],
    artifactsNeverMaster: [],
    captures: []
  };

  sample.forEach(s => {
    const full = s.full || {};
    const meta = s.meta || {};
    const capture = { id: meta.capture_id || path.basename(s.path), timestamp: meta.timestamp_utc || meta.timestamp_ny || null };
    const execute = typeof full.execute === 'boolean' ? full.execute : null;
    const direction = full.direction || full.entry || null;
    const confidence = typeof full.confidence === 'number' ? full.confidence : (full.layers && full.layers.time && full.layers.time.confidence) || null;
    capture.execute = execute;
    capture.direction = direction;
    capture.confidence = confidence;

    if (execute === true) stats.executeCounts.true++;
    if (execute === false) stats.executeCounts.false++;
    if (direction) { stats.directionCounts[direction] = (stats.directionCounts[direction]||0) + 1; stats.ltfCounts[direction] = (stats.ltfCounts[direction]||0)+1; }
    if (typeof confidence === 'number') stats.confidences.push(confidence);

    const biases = extractBiasFromLayers(full);
    if (biases.htf) stats.htfCounts[biases.htf] = (stats.htfCounts[biases.htf]||0)+1;
    if (biases.itf) stats.itfCounts[biases.itf] = (stats.itfCounts[biases.itf]||0)+1;
    if (biases.ltf) stats.ltfCounts[biases.ltf] = (stats.ltfCounts[biases.ltf]||0)+1;
    capture.htf = biases.htf; capture.itf = biases.itf; capture.ltf = biases.ltf;

    // news override heuristic
    if (containsKeyword(full, 'news') || containsKeyword(full, 'daily news')) stats.newsOverrides++;
    if (containsKeyword(full, 'pmso') || containsKeyword(full, 'pms')) stats.pmsoOverrides++;
    if (containsKeyword(full, 'delivery model') || containsKeyword(full, 'weekly delivery model')) stats.deliveryModelRefs++;

    // PMSO contradiction score heuristic
    const pmsoScore = (full.pms && full.pms.contradiction_score) || full.pms_contradiction_score || null;
    if (pmsoScore !== null) stats.pmsos.push(pmsoScore);

    // artifacts never reaching master: check for master path
    if (full.master === undefined) stats.artifactsNeverMaster.push(capture.id);

    stats.captures.push(capture);
  });

  if (stats.confidences.length) {
    const sum = stats.confidences.reduce((a,b)=>a+b,0);
    stats.avgConfidence = sum / stats.confidences.length;
  }
  return stats;
}

function main() {
  const paths = findFullJsonPaths();
  const stats = analyze(paths, 30);
  const outPath = path.join(__dirname, '..', 'tmp', 'multi_capture_audit_summary.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(stats, null, 2));
  console.log('Wrote', outPath);
}

main();
