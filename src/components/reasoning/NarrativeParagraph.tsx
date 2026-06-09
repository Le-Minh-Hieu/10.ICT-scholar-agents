import React from 'react';
import { NarrativeParagraph as NarrativeParagraphType } from '../../../types/reasoning';
import { EvidenceBadge } from './EvidenceBadge';
import { ConceptHighlight } from './ConceptHighlight';

interface NarrativeParagraphProps {
  paragraph: NarrativeParagraphType;
}

const ICT_CONCEPTS = [
  "FVG", "BSL", "SSL", "SMT", "MSS", "BMS", "Breaker Block", "Breaker",
  "Kill Zone", "OTE", "Premium", "Discount", "Equilibrium", "NWOG", "C-DISD",
  "Judas Swing", "Stop Hunt", "Inducement", "Market Structure Shift",
  "Bullish", "Bearish", "Liquidity Sweep", "Draw on Liquidity"
];

export const NarrativeParagraph: React.FC<NarrativeParagraphProps> = ({ paragraph }) => {
  const { content, citations, concepts, isStep, stepIndex } = paragraph;

  const renderTextWithHighlights = (text: string) => {
    if (!concepts.length) return text;
    
    // Build a regex to match all found concepts
    const pattern = new RegExp(`(${concepts.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(pattern);

    return parts.map((part, i) => {
      const isMatch = concepts.some(c => c.toLowerCase() === part.toLowerCase());
      if (isMatch) {
        return <ConceptHighlight key={i} concept={part}>{part}</ConceptHighlight>;
      }
      return part;
    });
  };

  const renderContent = () => {
    // 1. Clean the text of raw citations for the main prose
    const cleanText = content.replace(/\[CHUNK_ID:chunk[_-]\d+\]/g, '');
    
    // 2. Handle bold text first
    const boldParts = cleanText.split(/(\*\*.*?\*\*)/g);

    return (
      <p className="text-gray-300 leading-relaxed text-sm selection:bg-blue-500/30">
        {isStep && (
          <span className="inline-block w-6 font-mono text-blue-500/60 font-black shrink-0">
            {stepIndex}.
          </span>
        )}
        {boldParts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className="text-gray-100 font-bold tracking-tight">
                {renderTextWithHighlights(part.slice(2, -2))}
              </strong>
            );
          }
          return renderTextWithHighlights(part);
        })}
        
        {/* Trailing Citations */}
        {citations.length > 0 && (
          <span className="inline-flex gap-1 ml-2 align-baseline translate-y-[-2px]">
            {citations.map(c => (
              <EvidenceBadge key={c} chunkId={c} />
            ))}
          </span>
        )}
      </p>
    );
  };

  return (
    <div className="mb-4 last:mb-0">
      {renderContent()}
    </div>
  );
};
