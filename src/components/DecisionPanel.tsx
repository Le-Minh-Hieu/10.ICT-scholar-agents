import React from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore.js';

export const DecisionPanel: React.FC = () => {
  const { data } = useAnalysisStore();

  if (!data || !data.decision) {
    return <div className="p-4 border rounded bg-gray-50">No decision data available</div>;
  }

  const { execute, direction, confidence, entry, notes } = data.decision;

  return (
    <div className="p-4 border rounded shadow-sm bg-white h-full">
      <h2 className="text-xl font-bold mb-4 border-b pb-2">Decision</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-600">Execute:</span>
          <span className={`px-3 py-1 rounded text-white font-bold ${execute ? 'bg-green-500' : 'bg-red-500'}`}>
            {execute ? 'TRUE' : 'FALSE'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-600">Direction:</span>
          <span className={`font-bold ${direction?.toLowerCase() === 'bullish' ? 'text-green-600' : direction?.toLowerCase() === 'bearish' ? 'text-red-600' : 'text-gray-600'}`}>
            {direction?.toUpperCase() || 'N/A'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-600">Confidence:</span>
          <span className={`px-2 py-1 text-sm rounded ${
            confidence?.toLowerCase() === 'high' ? 'bg-green-100 text-green-800' :
            confidence?.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {confidence || 'Unknown'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-600">Entry:</span>
          <span className="font-mono">{entry || 'N/A'}</span>
        </div>

        {notes && (
          <div className="mt-4">
            <span className="font-semibold text-gray-600 block mb-2">Notes:</span>
            <div className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap text-gray-700">
              {notes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};