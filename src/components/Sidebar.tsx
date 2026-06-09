import React, { useEffect, useState } from 'react';
import { getSessions, getTimeline, getCapture } from '../services/api';
import { useAnalysisStore } from '../store/useAnalysisStore';

export const Sidebar: React.FC = () => {
  const { 
    sessions, setSessions, 
    selectedDate, setSelectedDate,
    selectedSession, setSelectedSession,
    selectedCaptureId, setSelectedCaptureId,
    setData, setStatus, setMetadata,
  } = useAnalysisStore();

  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await getSessions();
        setSessions(data);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      }
    };
    fetchSessions();
  }, [setSessions]);

  useEffect(() => {
    if (selectedDate && selectedSession) {
      const fetchTimeline = async () => {
        setLoading(true);
        try {
          const data = await getTimeline(selectedDate, selectedSession);
          setTimeline(data.reverse()); // Latest first
        } catch (err) {
          console.error('Failed to fetch timeline:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchTimeline();
    } else {
      setTimeline([]);
    }
  }, [selectedDate, selectedSession]);

  const handleSelectCapture = async (entry: any) => {
    setSelectedCaptureId(entry.capture_id);
    try {
      const result = await getCapture(selectedDate!, selectedSession!, entry.capture_id);
      if (result.success) {
        setData(result.analysis);
        setStatus(result.status);
        setMetadata(result.metadata);
      }
    } catch (err) {
      console.error('Failed to fetch capture:', err);
    }
  };

  return (
    <div className="w-80 h-screen bg-gray-900 text-gray-400 flex flex-col border-r border-gray-800 shadow-2xl z-20">
      <div className="p-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0">
        <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Data Explorer</h2>
        <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">Select Pipeline Snapshot</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 no-scrollbar">
        {Object.entries(sessions).map(([date, sessionTypes]) => (
          <div key={date} className="space-y-2">
            <div 
              className={`group flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition-all duration-200 ${
                selectedDate === date 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 ring-1 ring-blue-400/50' 
                : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => {
                setSelectedDate(selectedDate === date ? null : date);
                setSelectedSession(null);
              }}
            >
              <div className="flex items-center gap-3">
                <span className={`w-1.5 h-1.5 rounded-full ${selectedDate === date ? 'bg-white animate-pulse' : 'bg-gray-600 group-hover:bg-gray-400'}`}></span>
                {date}
              </div>
              <span className="text-[10px] opacity-40 font-mono">#{sessionTypes.length}</span>
            </div>
            
            {selectedDate === date && (
              <div className="ml-4 pl-4 space-y-2 border-l border-gray-800 animate-in fade-in slide-in-from-left-2 duration-300">
                {sessionTypes.map((type) => (
                  <div key={type} className="space-y-2">
                    <div 
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                        selectedSession === type 
                        ? 'text-blue-400 bg-blue-500/10' 
                        : 'hover:text-gray-200 hover:bg-gray-800/50'
                      }`}
                      onClick={() => setSelectedSession(selectedSession === type ? null : type)}
                    >
                      <div className={`w-1 h-1 rounded-full ${selectedSession === type ? 'bg-blue-400' : 'bg-gray-700'}`}></div>
                      {type}
                    </div>

                    {selectedSession === type && (
                      <div className="pl-4 space-y-2 pb-2">
                        {loading ? (
                          <div className="px-4 py-2 text-[10px] text-gray-600 animate-pulse font-bold">SYCHRONIZING...</div>
                        ) : timeline.length === 0 ? (
                          <div className="px-4 py-2 text-[10px] text-gray-700 italic font-bold">NO CAPTURES FOUND</div>
                        ) : (
                          timeline.map((entry) => (
                            <div 
                              key={entry.capture_id}
                              onClick={() => handleSelectCapture(entry)}
                              className={`group relative p-3 rounded-xl border transition-all duration-300 ${
                                selectedCaptureId === entry.capture_id 
                                ? 'border-blue-500 bg-blue-600/5 text-white shadow-lg' 
                                : 'border-gray-800 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-800/60'
                              }`}
                            >
                              <div className="flex justify-between items-center text-[9px] font-black text-gray-500 mb-2 tracking-tighter">
                                <span className={selectedCaptureId === entry.capture_id ? 'text-blue-400' : ''}>
                                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border text-[8px] tracking-widest font-black uppercase ${
                                  entry.execute 
                                  ? 'border-green-500 text-green-500 bg-green-500/5' 
                                  : 'border-gray-700 text-gray-500'
                                }`}>
                                  {entry.execute ? 'EXECUTE' : 'WATCH'}
                                </span>
                              </div>
                              <div className="flex justify-between items-end">
                                <span className={`text-xs font-black uppercase tracking-tight ${
                                  entry.direction === 'bullish' ? 'text-green-400' : 
                                  entry.direction === 'bearish' ? 'text-red-400' : 'text-gray-400'
                                }`}>
                                  {entry.direction} Setup
                                </span>
                                <div className="flex flex-col items-end">
                                  <span className="text-[8px] text-gray-600 uppercase font-black tracking-widest mb-0.5">Confidence</span>
<span className="text-[10px] font-black text-gray-400">{(entry.confidence * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                              {selectedCaptureId === entry.capture_id && (
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full shadow-lg shadow-blue-500/50"></div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 bg-gray-900 border-t border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Pipeline Active</span>
        </div>
        <span className="text-[9px] font-mono text-gray-600 uppercase">v1.0</span>
      </div>
    </div>
  );
};
