import React, { useState } from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { DataGrid } from './DataGrid';
import { Lightbox } from './Lightbox';
import { ReasoningPool } from './ReasoningPool';
import { useAnalysisTelemetry } from '../hooks/useAnalysisTelemetry';
import { ReasoningNarrative } from './reasoning/ReasoningNarrative';

export const FullSystemView: React.FC = () => {
  const { data: systemResult, selectedCaptureId, terminalMode } = useAnalysisStore();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Use the telemetry hook for global gallery. 
  // In FullSystemView, we pass the input_summary from the systemResult metadata if available.
  const { groups, flatCollection } = useAnalysisTelemetry(systemResult?.metadata?.input_summary);

  if (!selectedCaptureId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 italic font-medium bg-gray-950 uppercase tracking-widest">
        Select a capture to commence full system audit
      </div>
    );
  }

  if (!systemResult) {
    return (
      <div className="flex-1 p-8 bg-gray-950">
        <div className="max-w-2xl mx-auto bg-amber-900/10 border border-amber-500/30 p-6 rounded-2xl text-center shadow-2xl">
          <span className="text-sm text-amber-400 font-black uppercase tracking-widest">Global Result Missing</span>
        </div>
      </div>
    );
  }

  const { execute, direction, confidence, score, entry, reasoning, layers, debug } = systemResult;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 text-gray-200 no-scrollbar">
      <div className="max-w-6xl mx-auto p-8 space-y-16 animate-in fade-in duration-500">
        {/* SystemResult Section */}
        <section className="space-y-12">
          <div className="flex items-center justify-between gap-8 border-b border-gray-900 pb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-4 w-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Master Orchestrator</span>
              </div>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">System Consensus</h2>
            </div>
            
            <div className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-[0.3em] border-2 shadow-2xl transition-all duration-1000 ${
              execute 
                ? 'bg-green-500/10 border-green-500 text-green-400 shadow-green-900/40 animate-pulse' 
                : 'bg-red-500/10 border-red-500 text-red-400 shadow-red-900/40'
            }`}>
              {execute ? 'EXECUTE' : 'WATCH'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { label: 'Direction', value: direction, color: direction === 'bullish' ? 'text-green-400' : direction === 'bearish' ? 'text-red-400' : 'text-gray-400' },
{ label: 'Confidence', value: `${(confidence * 100).toFixed(0)}%`, color: 'text-blue-400' },
              { label: 'Score', value: score ?? 'N/A', color: 'text-amber-400', mono: true },
              { label: 'Entry Zone', value: entry || 'NONE', color: 'text-gray-300', mono: true }
            ].map((item, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-2xl hover:border-blue-500/20 transition-all duration-300 hover:translate-y-[-4px]">
                <p className="text-[10px] font-black text-gray-600 uppercase mb-4 tracking-widest">{item.label}</p>
                <p className={`text-2xl font-black uppercase ${item.color} ${item.mono ? 'font-mono' : ''}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {reasoning && (
            <div className="relative p-8 bg-blue-500/5 border border-blue-500/10 rounded-3xl overflow-hidden shadow-2xl group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] group-hover:w-2 transition-all duration-500"></div>
              <p className="text-[10px] font-black text-gray-500 uppercase mb-4 tracking-[0.3em]">Decision Narrative</p>
              <ReasoningNarrative reasoning={reasoning} agentId="master" />
            </div>
          )}
        </section>

        {/* Global Reasoning / Image Gallery */}
        <section className="space-y-12">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">
              {terminalMode === 'INSTITUTIONAL' ? 'Global Reasoning Pool' : 'System-Wide Visual Evidence'}
            </h3>
            <div className="h-px flex-1 bg-gray-800/50"></div>
          </div>
          
          {terminalMode === 'INSTITUTIONAL' ? (
            <ReasoningPool />
          ) : (
            <>
              {Object.keys(groups).length === 0 ? (
                <div className="p-8 bg-gray-900/20 border border-gray-800/50 rounded-2xl text-center border-dashed">
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic">Visual evidence synchronizing...</span>
                </div>
              ) : (
                <div className="space-y-16">
                  {Object.entries(groups).map(([symbol, images]) => (
                    <div key={symbol} className="space-y-8">
                      <div className="flex items-center gap-6">
                        <h4 className="text-lg font-black text-blue-400 uppercase tracking-[0.3em]">{symbol}</h4>
                        <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent"></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {images.map((img) => (
                          <div 
                            key={img.globalIndex} 
                            className="group relative bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 hover:border-blue-500/50 hover:translate-y-[-8px] cursor-zoom-in"
                            onClick={() => setLightboxIndex(img.globalIndex)}
                          >
                            <div className="absolute top-4 left-4 z-10 bg-gray-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-gray-800 text-[9px] font-black uppercase text-gray-400 tracking-widest group-hover:text-blue-400 group-hover:border-blue-500/30 transition-colors">
                              {img.tf}
                            </div>
                            <div className="aspect-[4/3] overflow-hidden bg-black flex items-center justify-center">
                              <img src={img.src} alt={img.alt} className="max-w-full max-h-full object-cover transition-transform duration-700 group-hover:scale-110 shadow-2xl" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Neural Layers Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Neural Layer Summaries</h3>
            <div className="h-px flex-1 bg-gray-800/50"></div>
          </div>
          
          <div className="grid grid-cols-1 gap-12">
            {layers && Object.entries(layers).map(([layerName, layerData]: [string, any]) => (
              <div key={layerName} className="space-y-6">
                <div className="flex items-center gap-4">
                   <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{layerName} Layer</h4>
                   <div className="h-px flex-1 bg-gray-900"></div>
                </div>
                {layerData ? (
                  <DataGrid data={layerData} />
                ) : (
                  <div className="p-6 bg-gray-900/20 border border-gray-800 rounded-2xl italic text-gray-700 text-xs uppercase font-bold tracking-widest">
                    Telemetry offline for this layer
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Full Trace Section */}
        <section className="space-y-8 pt-8 border-t border-gray-900">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-purple-400 uppercase tracking-[0.3em]">Global System Trace</h3>
            <div className="h-px flex-1 bg-purple-900/20"></div>
          </div>
          <div className="bg-black border border-purple-900/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
               <span className="text-[8px] font-black text-purple-500 uppercase tracking-widest bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/20">Full_Trace_Log</span>
            </div>
            <pre className="text-[11px] font-mono text-purple-300/50 leading-relaxed overflow-x-auto no-scrollbar">
              {JSON.stringify(debug || null, null, 2)}
            </pre>
          </div>
        </section>

        {/* Global Raw JSON */}
        <section className="pt-12 pb-20">
          <details className="group opacity-20 hover:opacity-100 transition-opacity">
            <summary className="text-[9px] font-black text-gray-600 uppercase tracking-[0.5em] cursor-pointer list-none text-center">
              [ ROOT SYSTEM STATE EXPORT ]
            </summary>
            <div className="mt-8 bg-black rounded-3xl p-8 border border-gray-900 shadow-inner">
              <pre className="text-[10px] font-mono text-gray-700 leading-tight overflow-x-auto no-scrollbar">
                {JSON.stringify(systemResult, null, 2)}
              </pre>
            </div>
          </details>
        </section>
      </div>

      {lightboxIndex !== null && (
        <Lightbox 
          images={flatCollection}
          initialIndex={lightboxIndex} 
          onClose={() => setLightboxIndex(null)} 
          agentData={systemResult}
        />
      )}
    </div>
  );
};
