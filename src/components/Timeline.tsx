import React, { useEffect, useState } from 'react';
import { getTimeline, getCapture } from '../services/api';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { getTradingDate, getICTSession } from '../../shared/utils/time-utils';

export const Timeline: React.FC = () => {
  const [timeline, setTimeline] = useState<any[]>([]);
  const { setData, setStatus, setMetadata, metadata } = useAnalysisStore();

  const fetchTimeline = async () => {
    const now = new Date();
    const date = getTradingDate(now);
    const session = getICTSession(now);
    try {
      const data = await getTimeline(date, session);
      setTimeline(data.reverse()); // Latest first
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    }
  };

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSelect = async (entry: any) => {
    const now = new Date();
    const date = getTradingDate(now);
    try {
      const result = await getCapture(date, entry.session, entry.capture_id);
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
    <div className="bg-white p-4 rounded shadow-sm overflow-hidden flex flex-col h-full">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Session Timeline</h2>
      <div className="space-y-2 overflow-y-auto flex-1 pr-2">
        {timeline.length === 0 && <p className="text-sm text-gray-400 italic">No captures in this session.</p>}
        {timeline.map((entry) => (
          <div 
            key={entry.capture_id}
            onClick={() => handleSelect(entry)}
            className={`p-3 rounded border cursor-pointer transition-colors ${
              metadata?.capture_id === entry.capture_id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
                <div className={`text-sm font-bold capitalize ${
                  entry.direction === 'bullish' ? 'text-green-600' : 
                  entry.direction === 'bearish' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {entry.direction} Setup
                </div>
              </div>
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                entry.execute ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {entry.execute ? 'EXECUTE' : 'WATCH'}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <div className="flex space-x-2">
                <span className="text-gray-500">Bias: <span className="font-bold">{entry.htf_bias}</span></span>
                <span className="text-gray-500">Conf: <span className="font-bold">{entry.confidence}</span></span>
              </div>
              <div className="font-mono text-gray-400">Score: {entry.score}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
