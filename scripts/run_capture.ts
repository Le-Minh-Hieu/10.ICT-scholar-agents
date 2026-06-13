import { runWithTracing } from '../shared/utils/logger.ts';
import { runAnalysis } from '../app/facades/run-analysis.js';

async function runCapture(capturePath: string, sessionId?: string) {
  await runWithTracing(async () => {
    console.log('Running capture:', capturePath);
    try {
      const result = await runAnalysis(capturePath, { debug: true, capturePath });
      console.log('Result for', capturePath, '->', { execute: result.execute, direction: result.direction, confidence: result.confidence });
    } catch (e: any) {
      console.error('Run failed for', capturePath, e?.message || e);
    }
  }, sessionId || undefined, 'main');
}

async function main() {
  // Replace these with two captures present in repo
  const captures = [
    'data/sessions/2026-06-02/LONDON/captures/1780383110317',
    'data/sessions/2026-06-02/LONDON/captures/1780387557965'
  ];

  for (const c of captures) {
    await runCapture(c, `test-${c.split('/').pop()}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
