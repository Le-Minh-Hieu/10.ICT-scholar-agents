export type IREStatus = 'VALID' | 'INVALIDATED' | 'STALE' | 'SPECULATIVE';

export interface ReasoningEntity {
  id: string;                // Canonical UUID or derived hash
  type: string;              // ICT Concept (FVG, BMS, etc.)
  anchor: string;           // Concise label
  confidence: number;       // 0.0 - 1.0
  timeframe?: string;       // HTF/ITF/LTF context
  reasoning: string;        // Textual justification
  status: IREStatus;
  lineage?: {
    sourceIds: string[];    // RAG chunk references
    rank?: number;          // Retrieval relevance
  };
  narrative?: {
    parentIRE?: string;     // Continuity link
    contradicts?: string[]; // Conflict tracking
  };
  metadata: {
    agentId: string;
    timestamp: string;
    epoch: number;          // Temporal consistency marker
  };
  raw?: any;                // Backup of original data
}

/**
 * Normalizes legacy fact objects into IRE v1.0 entities.
 */
export const normalizeToIRE = (
  fact: any, 
  agentName: string, 
  timestamp: string, 
  epoch: number
): ReasoningEntity => {
  // Handle case where fact is already an IRE
  if (fact.id && fact.status) return fact;

  // Derive a stable ID if none exists
  const stableId = fact.id || `ire_${agentName}_${fact.type}_${fact.anchor}_${timestamp}`.replace(/\s+/g, '_');

  return {
    id: stableId,
    type: fact.type || 'observation',
    anchor: fact.anchor || fact.type || 'Manual Observation',
    confidence: fact.confidence ?? 1.0,
    timeframe: fact.timeframe,
    reasoning: fact.reasoning || (typeof fact === 'string' ? fact : 'No justification provided'),
    status: 'VALID',
    lineage: {
      sourceIds: fact.references || [],
    },
    metadata: {
      agentId: agentName,
      timestamp,
      epoch,
    },
    raw: fact
  };
};
