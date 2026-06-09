import { useMemo } from 'react';
import { parseReasoning } from '../services/reasoning-parser';
import { ReasoningAST } from '../../types/reasoning';

export const useReasoningNarrative = (rawText: string, agentId?: string): ReasoningAST => {
  return useMemo(() => {
    return parseReasoning(rawText, agentId);
  }, [rawText, agentId]);
};
