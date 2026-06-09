import React, { useEffect, useState } from 'react';
import { getAgentAnalysis } from '../services/api';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { Lightbox } from './Lightbox';
import { DataGrid } from './DataGrid';
import { ReasoningPool } from './ReasoningPool';
import { useAnalysisTelemetry } from '../hooks/useAnalysisTelemetry';
import { ReasoningNarrative } from './reasoning/ReasoningNarrative';

export const AgentView: React.FC = () => {
  const { selectedDate, selectedSession, selectedCaptureId, selectedAgent, terminalMode } = useAnalysisStore();
  const [agentData, setAgentData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedDate && selectedSession && selectedCaptureId && selectedAgent && selectedAgent.layer !== 'master') {
      const fetchAgentData = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await getAgentAnalysis(
            selectedDate,
            selectedSession,
            selectedCaptureId,
            selectedAgent.layer,
            selectedAgent.name
          );
          setAgentData(data);
        } catch (err: any) {
          console.error('Failed to fetch agent data:', err);
          setError(err.response?.data?.error || 'Agent data not found');
          setAgentData(null);
        } finally {
          setLoading(false);
        }
      };
      fetchAgentData();
    } else {
      setAgentData(null);
    }
  }, [selectedDate, selectedSession, selectedCaptureId, selectedAgent]);

  const { status, data, meta } = agentData || {};
  const debug = data?._debug || agentData?._debug;
  
  // Use consolidated telemetry hook
  const { groups, flatCollection } = useAnalysisTelemetry(meta?.input_summary);

  if (!selectedCaptureId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 italic font-medium bg-gray-950 uppercase tracking-widest">
        Select a capture to commence audit
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Retrieving Audit Data</span>
        </div>
      </div>
    );
  }

  if (error || !agentData) {
    return (
      <div className="flex-1 p-8 bg-gray-950">
        <div className="max-w-2xl mx-auto bg-red-900/10 border border-red-500/30 p-6 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-4 text-red-400 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.876c1.27 0 2.09-1.383 1.432-2.505l-6.938-12.08a2.01 2.01 0 00-3.464 0L3.47 16.995c-.658 1.122.162 2.505 1.432 2.505z" />
            </svg>
            <h3 className="font-black uppercase tracking-widest">Data Link Severed</h3>
          </div>
          <p className="text-sm text-red-300/70 leading-relaxed font-medium">
            {error || 'The requested agent diagnostic file was not found on the runtime filesystem.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 text-gray-200 no-scrollbar">
      <div className="max-w-6xl mx-auto p-8 space-y-16 animate-in fade-in duration-500">
        {/* Header & Status */}
        <div className="flex justify-between items-end gap-8 border-b border-gray-900 pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-4 w-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Agent Diagnostic</span>
            </div>
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">
              {meta?.agent || selectedAgent?.name}
            </h2>
            <div className="flex items-center gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              <span>Timestamp: {meta?.timestamp ? new Date(meta.timestamp).toLocaleString() : 'N/A'}</span>
              {meta?.durationMs && <span className="text-gray-700">|</span>}
              {meta?.durationMs && <span>Execution: {meta.durationMs}ms</span>}
            </div>
          </div>
          
          <div className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-[0.2em] border-2 shadow-2xl transition-all duration-500 ${
            status === 'SUCCESS' 
              ? 'bg-green-500/10 border-green-500 text-green-400 shadow-green-900/20' 
              : status === 'FAIL' 
                ? 'bg-red-500/10 border-red-500 text-red-400 animate-pulse shadow-red-900/20' 
                : 'bg-gray-800 border-gray-700 text-gray-500'
          }`}>
            {status || 'UNKNOWN'}
          </div>
        </div>

        {/* Reasoning Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">
              {terminalMode === 'INSTITUTIONAL' ? 'Reasoning Analysis' : 'Diagnostic Matrix'}
            </h3>
            <div className="h-px flex-1 bg-gray-800/50"></div>
          </div>
          
          {terminalMode === 'INSTITUTIONAL' ? (
            <div className="space-y-12">
              {data?.reasoning && (
                <div className="relative p-8 bg-blue-500/5 border border-blue-500/10 rounded-3xl overflow-hidden shadow-2xl group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] group-hover:w-2 transition-all duration-500"></div>
                  <p className="text-[10px] font-black text-gray-500 uppercase mb-4 tracking-[0.3em]">Agent Narrative</p>
                  <ReasoningNarrative reasoning={data.reasoning} agentId={meta?.agent || 'system'} />
                </div>
              )}
              <ReasoningPool />
            </div>
          ) : (
            <DataGrid data={data} />
          )}
        </section>

        {/* Telemetry Gallery */}
        <section className="space-y-12">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Contextual Telemetry</h3>
            <div className="h-px flex-1 bg-gray-800/50"></div>
          </div>
          
          {Object.keys(groups).length === 0 ? (
            <div className="p-8 bg-gray-900/20 border border-gray-800/50 rounded-2xl text-center border-dashed">
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic">No filtered telemetry for this agent context</span>
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
                        <div className="aspect-[4/3] overflow-hidden bg-black text-center flex items-center justify-center">
                          <img src={img.src} alt={img.alt} className="max-w-full max-h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-1 shadow-2xl" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-6 text-[10px] font-black text-white uppercase tracking-[0.2em]">
                          Expand Contextual Evidence
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Debug Internals */}
        {debug && (
          <section className="space-y-8 pt-8 border-t border-gray-900">
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-black text-purple-500 uppercase tracking-[0.3em]">Debug Trace</h3>
              <div className="h-px flex-1 bg-purple-900/20"></div>
            </div>
            <div className="bg-black border border-purple-900/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
                 <span className="text-[8px] font-black text-purple-500 uppercase tracking-widest bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/30">TRACE_LOG</span>
              </div>
              <pre className="text-[10px] font-mono text-purple-300/50 leading-relaxed overflow-x-auto no-scrollbar">
                {JSON.stringify(debug, null, 2)}
              </pre>
            </div>
          </section>
        )}

        {/* Raw JSON Wrapper */}
        <section className="pt-12">
          <details className="group opacity-20 hover:opacity-100 transition-opacity">
            <summary className="text-[8px] font-black text-gray-600 uppercase tracking-[0.5em] cursor-pointer list-none text-center">
              [ ACCESS ROOT WRAPPER DATA ]
            </summary>
            <div className="mt-8 bg-black rounded-3xl p-8 border border-gray-900 shadow-inner overflow-hidden">
              <pre className="text-[10px] font-mono text-gray-600 leading-tight overflow-x-auto no-scrollbar">
                {JSON.stringify(agentData, null, 2)}
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
          agentData={data}
        />
      )}
    </div>
  );
};
