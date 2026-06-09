import React from 'react';
import { ReasoningEntity } from '../store/ire-engine';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { ReasoningNarrative } from './reasoning/ReasoningNarrative';

interface IRECardProps {
  entity: ReasoningEntity;
}

export const IRECard: React.FC<IRECardProps> = ({ entity }) => {
  const { anchor, type, confidence, reasoning, status, timeframe, metadata, narrative } = entity;
  const { irePool } = useAnalysisStore();

  // Find parent entity for linkage display
  const parentEntity = narrative?.parentIRE ? irePool[narrative.parentIRE] : null;
  const hasContradictions = narrative?.contradicts && narrative.contradicts.length > 0;

  // Determine border and accent color based on confidence and type
  const getAccentColor = () => {
    if (status === 'INVALIDATED') return 'border-red-900/50 opacity-60 grayscale-[0.5]';
    if (hasContradictions) return 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]';
    if (confidence > 0.8) return 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]';
    if (confidence > 0.5) return 'border-blue-700/50';
    return 'border-gray-800';
  };

  return (
    <div className={`p-4 rounded-xl bg-gray-950/40 border ${getAccentColor()} transition-all duration-300 hover:bg-gray-900/60 group relative overflow-hidden`}>
      {/* Background Type Indicator */}
      <div className="absolute -right-2 -bottom-2 opacity-5 text-4xl font-black uppercase tracking-tighter pointer-events-none">
        {type}
      </div>

      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              {type}
            </span>
            {timeframe && (
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                {timeframe}
              </span>
            )}
            {hasContradictions && (
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest animate-pulse">
                Conflict Detected
              </span>
            )}
          </div>
          
          {/* Narrative Inheritance Breadcrumb */}
          {parentEntity && (
            <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">
               <svg className="w-2.5 h-2.5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
               </svg>
               <span className="truncate max-w-[120px]">{parentEntity.anchor}</span>
            </div>
          )}

          <h4 className="text-sm font-black text-gray-100 uppercase tracking-tight leading-none pt-1">
            {anchor}
          </h4>
        </div>

        {/* Confidence HUD */}
        <div className="flex flex-col items-end">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Weight</div>
          <div className="h-1.5 w-16 bg-gray-800 rounded-full overflow-hidden border border-gray-700/50 shadow-inner">
            <div 
              className={`h-full transition-all duration-1000 ${
                confidence > 0.8 ? 'bg-blue-500' : confidence > 0.5 ? 'bg-blue-600' : 'bg-gray-600'
              }`} 
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-gray-400 mt-1">{(confidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="max-h-[120px] group-hover:max-h-[800px] overflow-hidden transition-all duration-500 relative">
        <ReasoningNarrative reasoning={reasoning} agentId={metadata.agentId} />
        
        {/* Scrim for collapsed state */}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-950/80 to-transparent group-hover:opacity-0 transition-opacity" />
      </div>

      {/* Meta Footer */}
      <div className="mt-4 pt-3 border-t border-gray-800/50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-3">
          {entity.lineage?.sourceIds.slice(0, 3).map(id => (
            <span key={id} className="text-[8px] font-mono text-blue-500/70 bg-blue-500/5 px-1.5 py-0.5 rounded border border-blue-500/10">
              {id}
            </span>
          ))}
          {entity.lineage?.sourceIds && entity.lineage.sourceIds.length > 3 && (
            <span className="text-[8px] text-gray-600 font-black">+{entity.lineage.sourceIds.length - 3}</span>
          )}
        </div>
        <span className="text-[8px] font-mono text-gray-600 uppercase">
          {metadata.agentId} @ {metadata.timestamp.split('T')[1].split('.')[0]}
        </span>
      </div>
      
      {/* Invalidation Overlay */}
      {status === 'INVALIDATED' && (
        <div className="absolute inset-0 bg-red-950/10 backdrop-blur-[1px] flex items-center justify-center">
          <div className="px-4 py-1.5 bg-red-950 border border-red-500/40 rounded-full text-[9px] font-black text-red-500 uppercase tracking-[0.3em] shadow-2xl ring-4 ring-red-950/50">
            Logic Invalidated
          </div>
        </div>
      )}
    </div>
  );
};
