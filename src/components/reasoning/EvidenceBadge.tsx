import React from 'react';

interface EvidenceBadgeProps {
  chunkId: string;
}

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({ chunkId }) => {
  const shortId = chunkId.replace('chunk_', '');
  
  return (
    <div className="inline-block relative group/evidence vertical-align-super">
      <button 
        className="text-[9px] font-mono font-black text-blue-500/60 hover:text-blue-400 transition-colors cursor-help px-0.5"
        onClick={(e) => {
            e.stopPropagation();
        }}
      >
        [{shortId}]
      </button>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-[9px] text-gray-300 whitespace-nowrap opacity-0 pointer-events-none group-hover/evidence:opacity-100 transition-opacity z-50 shadow-2xl">
        Source: {chunkId}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
      </div>
    </div>
  );
};
