import React, { useState } from 'react';
import { useReasoningNarrative } from '../../hooks/useReasoningNarrative';
import { NarrativeParagraph } from './NarrativeParagraph';

interface ReasoningNarrativeProps {
  reasoning: string;
  agentId: string;
}

export const ReasoningNarrative: React.FC<ReasoningNarrativeProps> = ({ reasoning, agentId }) => {
  const ast = useReasoningNarrative(reasoning, agentId);
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Debug Toggle - Subtle */}
      <div className="flex justify-end pr-2 -mb-6 relative z-30">
        <button 
          onClick={(e) => { e.stopPropagation(); setShowRaw(!showRaw); }}
          className="text-[7px] font-black text-gray-700 hover:text-blue-500 uppercase tracking-widest px-2 py-1 rounded transition-all"
        >
          {showRaw ? 'Institutional View' : 'Diagnostic Trace'}
        </button>
      </div>

      {showRaw ? (
        <pre className="text-[10px] font-mono text-gray-500 bg-gray-900/50 p-4 rounded-xl overflow-x-auto border border-gray-800/50 whitespace-pre-wrap leading-relaxed">
          {reasoning}
        </pre>
      ) : ast.sections.map((section) => (
        <div key={section.id} className="group/section">
          {/* Section Header - Institutional Aesthetic */}
          {section.title && (
            <div className="flex items-center gap-4 mb-4">
              <div className={`h-4 w-0.5 rounded-full ${
                section.type === 'HTF' ? 'bg-blue-500' :
                section.type === 'ITF' ? 'bg-indigo-500' :
                section.type === 'LTF' ? 'bg-purple-500' :
                section.type === 'CONCLUSION' ? 'bg-emerald-500' : 'bg-gray-700'
              }`} />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
                {section.title}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-gray-800/50 to-transparent"></div>
            </div>
          )}

          {/* Paragraphs - Better Spacing & Indentation */}
          <div className="space-y-4 pl-4 border-l border-transparent group-hover/section:border-gray-900 transition-colors">
            {section.paragraphs.map((paragraph) => (
              <NarrativeParagraph key={paragraph.id} paragraph={paragraph} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
