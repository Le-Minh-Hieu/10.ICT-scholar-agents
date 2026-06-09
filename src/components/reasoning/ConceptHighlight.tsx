import React from 'react';

interface ConceptHighlightProps {
  concept: string;
  children: React.ReactNode;
}

const CONCEPT_COLORS: Record<string, string> = {
  'BSL': 'text-emerald-400 border-b border-emerald-500/30',
  'SSL': 'text-rose-400 border-b border-rose-500/30',
  'Liquidity Sweep': 'text-amber-400 border-b border-amber-500/30',
  'FVG': 'text-blue-400 border-b border-blue-500/30',
  'MSS': 'text-fuchsia-400 border-b border-fuchsia-500/30',
  'BMS': 'text-fuchsia-400 border-b border-fuchsia-500/30',
  'Market Structure Shift': 'text-fuchsia-400 border-b border-fuchsia-500/30',
  'Bullish': 'text-emerald-500 font-bold',
  'Bearish': 'text-rose-500 font-bold',
};

export const ConceptHighlight: React.FC<ConceptHighlightProps> = ({ concept, children }) => {
  const style = CONCEPT_COLORS[concept] || 'text-blue-300/80 border-b border-blue-500/20';
  
  return (
    <span className={`cursor-help transition-colors hover:text-white ${style}`} title={`ICT Concept: ${concept}`}>
      {children}
    </span>
  );
};
