import React, { useState, useEffect } from 'react';
import { getAgentAnalysis } from '../services/api';
import { useAnalysisStore } from '../store/useAnalysisStore';

type AgentProps = {
  name: string;
  layer: string;
  data: any;
};

export const AgentCard: React.FC<AgentProps> = ({ name, layer, data }) => {
  const [inputCollapsed, setInputCollapsed] = useState(true);
  const [fullData, setFullData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { metadata } = useAnalysisStore();

  useEffect(() => {
    if (!inputCollapsed && !fullData && metadata) {
      setLoading(true);
      getAgentAnalysis(metadata.date, metadata.session, metadata.capture_id, layer, name)
        .then(res => {
          if (res.success) setFullData(res);
        })
        .catch(err => console.error("Failed to fetch agent details:", err))
        .finally(() => setLoading(false));
    }
  }, [inputCollapsed, fullData, metadata, layer, name]);

  if (!data) return null;

  const { expandedQueries, topKChunks, output } = data;
  const inputSummary = fullData?.meta?.input_summary;

  return (
    <div className="border rounded mb-3 bg-gray-50 shadow-sm overflow-hidden text-sm">
      <div className="bg-gray-200 px-3 py-2 font-bold text-gray-700 flex justify-between items-center">
        <span>{name}</span>
        <div className="flex gap-2">
          {fullData?._grounding_valid === false && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded border border-red-200">Invalid Grounding</span>
          )}
          {loading && <span className="text-[10px] animate-pulse">Loading...</span>}
        </div>
      </div>
      
      <div className="p-3 space-y-3">
        {/* Dynamic Image Binding from Runtime Input */}
        <div>
          <div 
            className="font-semibold text-xs text-gray-500 cursor-pointer flex items-center mb-1"
            onClick={() => setInputCollapsed(!inputCollapsed)}
          >
            <span className="mr-1">{inputCollapsed ? '▶' : '▼'}</span> Runtime Input Images
          </div>
          {!inputCollapsed && (
            <div className="mt-2 space-y-4">
              {inputSummary ? (
                Object.entries(inputSummary).map(([symbol, tfs]: [string, any]) => (
                  <div key={symbol} className="border-t pt-2 first:border-t-0 first:pt-0">
                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">{symbol}</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(tfs).map(([tf, src]: [string, any]) => (
                        <div key={tf} className="relative group">
                          {src ? (
                            <>
                              <img 
                                src={src} 
                                alt={`${symbol} ${tf}`} 
                                className="h-20 w-auto rounded border bg-white shadow-sm hover:scale-150 transition-transform origin-top-left cursor-zoom-in z-10"
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white px-1 truncate pointer-events-none">
                                {tf}
                              </div>
                            </>
                          ) : (
                            <div className="h-20 w-20 bg-gray-200 flex items-center justify-center text-[10px] text-gray-400 border rounded">
                              ❗ {tf}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 italic text-xs">
                  {loading ? 'Fetching runtime inputs...' : '❗ No input images'}
                </div>
              )}
            </div>
          )}
        </div>

        {expandedQueries && expandedQueries.length > 0 && (
          <div>
            <div className="font-semibold text-xs text-gray-500 mb-1">Expanded Queries</div>
            <ul className="list-disc pl-4 text-xs text-gray-700">
              {expandedQueries.map((q: string, i: number) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {topKChunks && topKChunks.length > 0 && (
          <div>
            <div className="font-semibold text-xs text-gray-500 mb-1">Top K Chunks ({topKChunks.length})</div>
            <div className="max-h-24 overflow-y-auto bg-white border p-2 rounded text-xs text-gray-600">
              {topKChunks.map((chunk: any, i: number) => (
                <div key={i} className="mb-1 pb-1 border-b last:border-0 truncate" title={typeof chunk === 'string' ? chunk : JSON.stringify(chunk)}>
                  {typeof chunk === 'string' ? chunk : JSON.stringify(chunk)}
                </div>
              ))}
            </div>
          </div>
        )}

        {output && (
          <div>
            <div className="font-semibold text-xs text-gray-500 mb-1">Output</div>
            <pre className="bg-gray-900 text-blue-300 p-2 rounded text-[10px] overflow-x-auto leading-tight">
              {JSON.stringify(output, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
