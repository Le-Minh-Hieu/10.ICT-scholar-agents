/**
 * Capture Latency Parser
 * 
 * Parses capture.jsonl logs and produces per-timeframe latency breakdowns.
 * 
 * Usage: node scripts/capture_latency_parser.js [session_path]
 *   If no session_path given, it finds the most recent session automatically.
 */

const fs = require('fs');
const path = require('path');

// --- Stage classification ---
const STAGE_CATEGORIES = {
  // Client-side update attempts
  'CLIENT_SIDE_UPDATE': 'client_side_update',
  'CLIENT_SIDE_UPDATE_FAILURE': 'client_side_update',
  'CLIENT_SIDE_UPDATE_EXHAUSTED': 'client_side_update',
  
  // URL reload path
  'TAB_UPDATE': 'url_reload',
  
  // Reinjection
  'REINJECT_SCRIPT': 'reinjection',
  'REINJECT_SCRIPT_FAILURE': 'reinjection',
  
  // Verification
  'VERIFICATION': 'verification',
  'VERIFICATION_SUCCESS': 'verification',
  'VERIFICATION_FAILURE': 'verification',
  'VERIFICATION_ERROR': 'verification',
  
  // Readiness / Stabilization
  'STABILIZATION_START': 'readiness',
  'STABILIZATION_COMPLETE': 'readiness',
  'TV_STATUS_RAW': 'readiness',
  'READINESS_FAILURE': 'readiness',
  
  // Screenshot
  'SCREENSHOT': 'screenshot',
  
  // Image processing (crop + processImage)
  'IMAGE_PROCESSING': 'image_processing',
  'IMAGE_PROCESSING_FAILURE': 'image_processing',
};

function findMostRecentSession(baseDir) {
  const logDir = path.join(baseDir, 'shared', 'log');
  if (!fs.existsSync(logDir)) {
    throw new Error(`Log directory not found: ${logDir}`);
  }
  
  // Get date directories sorted descending
  const dateDirs = fs.readdirSync(logDir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  
  for (const dateDir of dateDirs) {
    const datePath = path.join(logDir, dateDir);
    const sessions = fs.readdirSync(datePath)
      .filter(d => d.startsWith('session_') && fs.statSync(path.join(datePath, d)).isDirectory())
      .sort()
      .reverse();
    
    for (const session of sessions) {
      const jsonlPath = path.join(datePath, session, 'capture.jsonl');
      if (fs.existsSync(jsonlPath)) {
        return jsonlPath;
      }
    }
  }
  
  throw new Error('No capture.jsonl found in any session');
}

function parseEvents(jsonlPath) {
  const content = fs.readFileSync(jsonlPath, 'utf-8');
  const lines = content.trim().split('\n');
  const events = [];
  
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch (e) {
      // skip malformed lines
    }
  }
  
  return events;
}

function extractCaptureAttempts(events) {
  const attempts = [];
  let currentAttempt = null;
  
  for (const event of events) {
    const ts = new Date(event.timestamp).getTime();
    
    if (event.stage === 'CAPTURE_ATTEMPT') {
      // Start a new capture attempt
      if (currentAttempt) {
        attempts.push(currentAttempt);
      }
      currentAttempt = {
        symbol: event.data?.symbol || 'UNKNOWN',
        timeframe: event.data?.timeframe || 'UNKNOWN',
        startTime: ts,
        endTime: ts,
        stages: [],
        outcome: 'UNKNOWN',
        stageTimings: {}
      };
    }
    
    if (currentAttempt) {
      currentAttempt.stages.push({
        stage: event.stage,
        category: STAGE_CATEGORIES[event.stage] || 'other',
        timestamp: ts,
        data: event.data,
        metrics: event.metrics,
        level: event.level
      });
      currentAttempt.endTime = ts;
      
      // Determine outcome
      if (event.stage === 'CAPTURE_SUCCESS') {
        currentAttempt.outcome = 'SUCCESS';
      } else if (event.stage === 'CAPTURE_FAILURE') {
        currentAttempt.outcome = 'FAILURE';
      } else if (event.stage === 'READINESS_FAILURE') {
        currentAttempt.outcome = 'READINESS_FAILURE';
      } else if (event.stage === 'CAPTURE_ERROR') {
        currentAttempt.outcome = 'ERROR';
      }
    }
  }
  
  if (currentAttempt) {
    attempts.push(currentAttempt);
  }
  
  return attempts;
}

function computeStageTimings(attempt) {
  const timings = {};
  const stages = attempt.stages;
  
  for (let i = 0; i < stages.length; i++) {
    const cat = stages[i].category;
    if (cat === 'other') continue;
    
    // Find end of this category run
    let endTs = stages[i].timestamp;
    let j = i + 1;
    while (j < stages.length && stages[j].category === cat) {
      endTs = stages[j].timestamp;
      j++;
    }
    
    // If there's a next stage, use its timestamp as the end
    if (j < stages.length) {
      endTs = stages[j].timestamp;
    }
    
    const duration = endTs - stages[i].timestamp;
    
    if (!timings[cat]) {
      timings[cat] = 0;
    }
    timings[cat] += duration;
    
    // Skip ahead to avoid double-counting
    i = j - 1;
  }
  
  // Use the SCREENSHOT metrics duration if available
  for (const s of stages) {
    if (s.stage === 'SCREENSHOT' && s.metrics?.duration) {
      timings['screenshot'] = s.metrics.duration;
    }
  }
  
  return timings;
}

function generateReport(jsonlPath, attempts) {
  const sessionName = path.basename(path.dirname(jsonlPath));
  const totalPipelineStart = attempts.length > 0 ? attempts[0].startTime : 0;
  const totalPipelineEnd = attempts.length > 0 ? attempts[attempts.length - 1].endTime : 0;
  const totalDuration = totalPipelineEnd - totalPipelineStart;
  
  let report = `# Capture Latency Breakdown\n\n`;
  report += `**Session**: \`${sessionName}\`\n`;
  report += `**Log File**: \`${jsonlPath}\`\n`;
  report += `**Total Pipeline Duration**: ${(totalDuration / 1000).toFixed(2)}s\n`;
  report += `**Total Capture Attempts**: ${attempts.length}\n\n`;
  
  // Summary counts
  const outcomes = {};
  for (const a of attempts) {
    outcomes[a.outcome] = (outcomes[a.outcome] || 0) + 1;
  }
  report += `## Outcome Summary\n\n`;
  report += `| Outcome | Count |\n|---------|-------|\n`;
  for (const [outcome, count] of Object.entries(outcomes)) {
    report += `| ${outcome} | ${count} |\n`;
  }
  report += `\n`;
  
  // Per-timeframe breakdown
  report += `## Per-Capture Latency Breakdown\n\n`;
  report += `| # | Symbol | TF | Total (s) | Client Update (s) | URL Reload (s) | Reinjection (s) | Verification (s) | Readiness (s) | Screenshot (s) | Image Proc (s) | Outcome |\n`;
  report += `|---|--------|----|-----------|--------------------|----------------|-----------------|------------------|---------------|----------------|----------------|---------|\n`;
  
  const allTimings = {
    client_side_update: [],
    url_reload: [],
    reinjection: [],
    verification: [],
    readiness: [],
    screenshot: [],
    image_processing: []
  };
  
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    const timings = computeStageTimings(a);
    a.computedTimings = timings;
    const total = (a.endTime - a.startTime) / 1000;
    
    const get = (cat) => {
      const val = (timings[cat] || 0) / 1000;
      if (val > 0) allTimings[cat]?.push(val);
      return val.toFixed(2);
    };
    
    report += `| ${i + 1} | ${a.symbol} | ${a.timeframe} | ${total.toFixed(2)} | ${get('client_side_update')} | ${get('url_reload')} | ${get('reinjection')} | ${get('verification')} | ${get('readiness')} | ${get('screenshot')} | ${get('image_processing')} | ${a.outcome} |\n`;
  }
  
  report += `\n`;
  
  // Aggregate statistics
  report += `## Aggregate Statistics\n\n`;
  report += `| Stage | Total Time (s) | Avg (s) | Max (s) | % of Pipeline |\n`;
  report += `|-------|---------------|---------|---------|---------------|\n`;
  
  const categories = ['client_side_update', 'url_reload', 'reinjection', 'verification', 'readiness', 'screenshot', 'image_processing'];
  const catLabels = {
    client_side_update: 'Client-Side Update',
    url_reload: 'URL Reload',
    reinjection: 'Reinjection',
    verification: 'Verification',
    readiness: 'Readiness/Stabilization',
    screenshot: 'Screenshot',
    image_processing: 'Image Processing'
  };
  
  let grandTotal = 0;
  const stageTotals = {};
  
  for (const cat of categories) {
    const vals = allTimings[cat] || [];
    const totalVal = vals.reduce((a, b) => a + b, 0);
    stageTotals[cat] = totalVal;
    grandTotal += totalVal;
  }
  
  for (const cat of categories) {
    const vals = allTimings[cat] || [];
    const totalVal = stageTotals[cat];
    const avg = vals.length > 0 ? totalVal / vals.length : 0;
    const max = vals.length > 0 ? Math.max(...vals) : 0;
    const pct = grandTotal > 0 ? (totalVal / grandTotal * 100) : 0;
    
    report += `| ${catLabels[cat]} | ${totalVal.toFixed(2)} | ${avg.toFixed(2)} | ${max.toFixed(2)} | ${pct.toFixed(1)}% |\n`;
  }
  
  report += `\n**Total Measured Stage Time**: ${grandTotal.toFixed(2)}s\n\n`;
  
  // Bottleneck identification
  report += `## Bottleneck Identification\n\n`;
  
  const sorted = categories.sort((a, b) => (stageTotals[b] || 0) - (stageTotals[a] || 0));
  const topBottleneck = sorted[0];
  const topPct = grandTotal > 0 ? (stageTotals[topBottleneck] / grandTotal * 100) : 0;
  
  report += `> [!IMPORTANT]\n`;
  report += `> **Primary bottleneck: ${catLabels[topBottleneck]}** — consuming ${topPct.toFixed(1)}% of total pipeline time (${stageTotals[topBottleneck].toFixed(2)}s).\n\n`;
  
  if (sorted.length > 1) {
    const secondBottleneck = sorted[1];
    const secondPct = grandTotal > 0 ? (stageTotals[secondBottleneck] / grandTotal * 100) : 0;
    report += `> [!NOTE]\n`;
    report += `> **Secondary bottleneck: ${catLabels[secondBottleneck]}** — consuming ${secondPct.toFixed(1)}% of total pipeline time (${stageTotals[secondBottleneck].toFixed(2)}s).\n\n`;
  }
  
  // Diagnosis
  report += `## Diagnosis\n\n`;
  
  // Check for WIDGET_UNAVAILABLE pattern
  let widgetUnavailableCount = 0;
  let totalStatusChecks = 0;
  for (const a of attempts) {
    for (const s of a.stages) {
      if (s.stage === 'TV_STATUS_RAW') {
        totalStatusChecks++;
        if (s.data?.error === 'WIDGET_UNAVAILABLE') {
          widgetUnavailableCount++;
        }
      }
    }
  }
  
  if (widgetUnavailableCount > 0) {
    const pct = (widgetUnavailableCount / totalStatusChecks * 100).toFixed(1);
    report += `### WIDGET_UNAVAILABLE Race Condition\n\n`;
    report += `- **${widgetUnavailableCount}/${totalStatusChecks}** readiness checks returned \`WIDGET_UNAVAILABLE\` (${pct}%)\n`;
    report += `- This means the bridge is injected before TradingView\'s \`chartWidgetCollection\` initializes\n`;
    report += `- The bridge polls immediately but the DOM/JS objects aren\'t populated yet\n\n`;
  }
  
  // Check for client-side update failure pattern
  let clientFailures = 0;
  let clientAttempts = 0;
  for (const a of attempts) {
    for (const s of a.stages) {
      if (s.stage === 'CLIENT_SIDE_UPDATE') clientAttempts++;
      if (s.stage === 'CLIENT_SIDE_UPDATE_FAILURE') clientFailures++;
    }
  }
  
  if (clientFailures > 0) {
    report += `### Client-Side Update Failures\n\n`;
    report += `- **${clientFailures}/${clientAttempts}** client-side update attempts failed\n`;
    report += `- Each failure costs ~${(allTimings.client_side_update.length > 0 ? (stageTotals.client_side_update / clientFailures).toFixed(1) : '?')}s in timeout wait\n`;
    report += `- After 3 failures, the pipeline falls back to URL reload (additional ~8s)\n\n`;
  }
  
  return report;
}

// --- Main ---
function main() {
  const baseDir = path.resolve(__dirname, '..');
  let jsonlPath;
  
  if (process.argv[2]) {
    jsonlPath = path.resolve(process.argv[2]);
  } else {
    jsonlPath = findMostRecentSession(baseDir);
  }
  
  console.log(`Parsing: ${jsonlPath}`);
  
  const events = parseEvents(jsonlPath);
  console.log(`Total events: ${events.length}`);
  
  const attempts = extractCaptureAttempts(events);
  console.log(`Capture attempts: ${attempts.length}`);
  
  const report = generateReport(jsonlPath, attempts);
  
  // Write the report
  const outputPath = path.join(baseDir, 'capture_latency_breakdown.md');
  fs.writeFileSync(outputPath, report, 'utf-8');
  console.log(`\nReport written to: ${outputPath}`);
  console.log('\n--- Preview ---\n');
  console.log(report);
}

main();
