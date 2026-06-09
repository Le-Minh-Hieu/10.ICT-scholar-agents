import { Confidence } from "../pmso";

export interface BaseAgentOutput {
  confidence: Confidence;
  reasoning: string;
  dominant_factors?: string[];
}

export interface BaseDebugInfo {
  expandedQueries: string[];
  topKChunks: number;
  grounded: string;
  references?: string[];
  warnings?: string[];
}
