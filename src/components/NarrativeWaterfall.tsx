import React, { useMemo } from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore';

export const NarrativeWaterfall: React.FC = () => {
  const { irePool } = useAnalysisStore();

  const timeframes = ['QUARTERLY', 'MONTHLY', 'WEEKLY', 'DAILY'];

  const waterfallData = useMemo(() => {
    return timeframes.map(tf => {
      // Find the primary bias/narrative for this timeframe from the IRE pool
      const entities = Object.values(irePool).filter(e => e.timeframe === tf);
      const primary = entities.sort((a, b) => b.confidence - a.confidence)[0];

      return {
        tf,
        anchor: primary?.anchor || 'No Consensus',
        confidence: primary?.confidence || 0,
        status: primary?.status || 'STALE'
      };
    });
  }, [irePool]);

  return (
    <div className="flex gap-2 mb-8 overflow-x-auto pb-4 no-scrollbar">
      {waterfallData.map((item, idx) => (
        <div key={item.tf} className="flex items-center gap-2 shrink-0">
          <div className={`px-4 py-3 rounded-2xl border transition-all duration-500 ${
            item.status === 'VALID' 
              ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
              : 'bg-gray-900/50 border-gray-800 opacity-50'
          }`}>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em]">{item.tf}</span>
              <span className={`text-[11px] font-black uppercase tracking-tight ${
                item.anchor.toLowerCase().includes('bullish') ? 'text-green-400' :
                item.anchor.toLowerCase().includes('bearish') ? 'text-red-400' : 'text-gray-100'
              }`}>
                {item.anchor}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-0.5 w-12 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-1000" 
                    style={{ width: `${item.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[8px] font-mono text-gray-600">{(item.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
          
          {idx < waterfallData.length - 1 && (
            <div className="text-gray-800">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
