import React from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore';

export const IntelligenceHUD: React.FC = () => {
  const { 
    hudVisible, 
    toggleHUD, 
    irePool, 
    lastNormalizationTime, 
    metadata,
    data
  } = useAnalysisStore();

  if (!hudVisible) return null;

  const ireCount = Object.keys(irePool).length;
  const layersCount = data?.layers ? Object.keys(data.layers).length : 0;

  return (
    <div className="fixed bottom-12 right-8 w-80 bg-gray-900/90 backdrop-blur-2xl border border-blue-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] z-[100] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-blue-600 px-4 py-2 flex justify-between items-center">
        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Developer Intelligence HUD</span>
        <button onClick={toggleHUD} className="text-white/50 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Core Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest text-blue-400/60">IRE Density</span>
            <div className="text-xl font-black text-white font-mono">{ireCount}</div>
          </div>
          <div className="space-y-1 text-right">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest text-blue-400/60">Logic Layers</span>
            <div className="text-xl font-black text-white font-mono">{layersCount}</div>
          </div>
        </div>

        {/* Latency Monitor */}
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Normalization Latency</span>
            <span className="text-[10px] font-mono text-blue-400">{lastNormalizationTime.toFixed(2)}ms</span>
          </div>
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${lastNormalizationTime > 10 ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(lastNormalizationTime * 5, 100)}%` }}
            />
          </div>
        </div>

        {/* System State */}
        <div className="space-y-2 border-t border-gray-800 pt-4 font-mono text-[9px]">
          <div className="flex justify-between text-gray-400">
            <span>ACTIVE_AGENT</span>
            <span className="text-blue-400 uppercase">{metadata?.agent || 'NONE'}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>EPOCH_TS</span>
            <span className="text-gray-500">{metadata?.timestamp?.split('T')[1] || '00:00:00'}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>CAPTURE_ID</span>
            <span className="text-gray-600 truncate ml-4">{metadata?.capture_id || 'IDLE'}</span>
          </div>
        </div>

        {/* Signal Status */}
        <div className="bg-black/40 rounded-xl p-3 border border-gray-800/50">
           <div className="flex items-center gap-2 mb-2">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Transport Synchronized</span>
           </div>
           <p className="text-[8px] text-gray-600 font-medium leading-relaxed italic">
             "Shadow IRE pool is processing legacy facts in background. Real-time reconciliation active."
           </p>
        </div>
      </div>

      <div className="bg-gray-800/50 px-4 py-2 flex justify-center border-t border-gray-800">
         <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">v1.0 Institutional Intelligence Runtime</span>
      </div>
    </div>
  );
};
