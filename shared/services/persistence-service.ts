import fs from 'fs';
import path from 'path';
import { HydrationContext } from '../contracts/context';
import { MasterOutput } from '../contracts/canonical';
import { log } from '../utils/logger';

export interface RunArtifact {
  runId: string;
  timestamp: string;
  input: any;
  output: MasterOutput;
  hydrationContexts: HydrationContext[];
  prompts: string[];
  errors: string[];
}

export class PersistenceService {
  private static readonly RUNS_DIR = path.join(process.cwd(), 'data', 'runs');

  public static saveRun(artifact: RunArtifact): void {
    if (!fs.existsSync(this.RUNS_DIR)) {
      fs.mkdirSync(this.RUNS_DIR, { recursive: true });
    }

    const filePath = path.join(this.RUNS_DIR, `${artifact.runId}.json`);
    const tmpFilePath = `${filePath}.tmp`;

    try {
      fs.writeFileSync(tmpFilePath, JSON.stringify(artifact, null, 2));
      fs.renameSync(tmpFilePath, filePath);
      log({ stage: 'PERSISTENCE', message: `Run artifact saved to ${filePath}` });
    } catch (error) {
      log({ stage: 'PERSISTENCE_ERROR', message: `Failed to save run artifact ${artifact.runId}`, data: { error } });
    }
  }

  public static getRun(runId: string): RunArtifact | null {
    const filePath = path.join(this.RUNS_DIR, `${runId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data) as RunArtifact;
      } catch (error) {
        log({ stage: 'PERSISTENCE_ERROR', message: `Failed to read or parse run artifact ${runId}`, data: { error } });
        return null;
      }
    }
    return null;
  }
}
