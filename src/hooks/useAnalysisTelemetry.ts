import { useMemo } from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore';

const TF_ORDER = ['m', 'w', 'd', 'h4', 'h1', 'm15', 'm5', 'm1'];

// Config for agent evidence filtering
const AGENT_IMAGE_MAPPING: Record<string, { symbols?: string[], tfs?: string[] }> = {
  'htf-structure': { tfs: ['m', 'w', 'd'] },
  'htf-macro': { tfs: ['m', 'w', 'd'] },
  'htf-liquidity': { tfs: ['m', 'w', 'd'] },
  'htf-pdarray': { tfs: ['m', 'w', 'd'] },
  'itf-structure': { tfs: ['h4', 'h1', 'm15'] },
  'itf-liquidity': { tfs: ['h4', 'h1', 'm15'] },
  'itf-pd-array': { tfs: ['h4', 'h1', 'm15'] },
  'itf-setup': { tfs: ['h4', 'h1', 'm15'] },
  'ltf-structure': { tfs: ['m15', 'm5', 'm1'] },
  'ltf-liquidity': { tfs: ['m15', 'm5', 'm1'] },
  'ltf-pd-array': { tfs: ['m15', 'm5', 'm1'] },
  'ltf-trigger': { tfs: ['m15', 'm5', 'm1'] },
};

export type TelemetryImage = { 
  src: string; 
  alt: string; 
  tf: string; 
  symbol: string; 
  globalIndex: number 
};

/**
 * Hook to extract and process visual evidence from agent metadata.
 */
export const useAnalysisTelemetry = (inputSummary: any) => {
  const { selectedAgent } = useAnalysisStore();

  return useMemo(() => {
    if (!inputSummary) return { groups: {}, flatCollection: [] };
    
    const collection: Omit<TelemetryImage, 'globalIndex'>[] = [];
    const agentName = selectedAgent?.name.toLowerCase() || '';
    const mapping = AGENT_IMAGE_MAPPING[agentName];
    
    Object.entries(inputSummary).forEach(([symbol, tfs]: [string, any]) => {
      const upperSymbol = symbol.toUpperCase();
      if (mapping?.symbols && !mapping.symbols.includes(upperSymbol)) return;

      if (typeof tfs === 'object' && tfs !== null) {
        Object.entries(tfs).forEach(([tf, img]) => {
          const lowerTF = tf.toLowerCase();
          if (mapping?.tfs && !mapping.tfs.includes(lowerTF)) return;

          if (typeof img === 'string' && img.startsWith('data:image')) {
            collection.push({ 
              src: img, 
              alt: `${upperSymbol} ${tf}`, 
              tf, 
              symbol: upperSymbol 
            });
          }
        });
      }
    });

    const sorted = collection.sort((a, b) => {
      if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
      const indexA = TF_ORDER.indexOf(a.tf.toLowerCase());
      const indexB = TF_ORDER.indexOf(b.tf.toLowerCase());
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });

    const indexed: TelemetryImage[] = sorted.map((img, i) => ({ ...img, globalIndex: i }));
    const grouped: Record<string, TelemetryImage[]> = {};
    
    indexed.forEach(img => {
      if (!grouped[img.symbol]) grouped[img.symbol] = [];
      grouped[img.symbol].push(img);
    });

    return { groups: grouped, flatCollection: indexed };
  }, [inputSummary, selectedAgent]);
};
