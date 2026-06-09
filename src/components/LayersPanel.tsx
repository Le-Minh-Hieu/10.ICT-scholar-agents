import React from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore';

export const LayersPanel: React.FC = () => {
  const { data } = useAnalysisStore();

  if (!data || !data.layers) {
    return <div className="p-4 border rounded bg-gray-50">No layer data available</div>;
  }

  const { HTF, ITF, LTF, TIME, CONFLUENCE, MACRO_NEWS } = data.layers;

  const renderLayer = (title: string, layerData: any) => {
    if (!layerData) return null;
    
    return (
      <div className="mb-4">
        <h3 className="font-bold text-gray-800 border-b pb-1 mb-2">{title}:</h3>
        <ul className="list-none pl-2 space-y-1">
          {Object.entries(layerData).map(([key, value]) => (
            <li key={key} className="text-sm">
              <span className="text-gray-500 mr-2">- {key}:</span>
              <span className={`font-mono ${
                value === 'bullish' ? 'text-green-600 font-bold' :
                value === 'bearish' ? 'text-red-600 font-bold' :
                value === true ? 'text-green-600' :
                value === false ? 'text-red-600' :
                'text-gray-800'
              }`}>
                {String(value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="p-4 border rounded shadow-sm bg-white h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 border-b pb-2">Layers</h2>
      {renderLayer('HTF', HTF)}
      {renderLayer('ITF', ITF)}
      {renderLayer('LTF', LTF)}
      {renderLayer('TIME', TIME)}
      {renderLayer('CONFLUENCE', CONFLUENCE)}
      {renderLayer('MACRO_NEWS', MACRO_NEWS)}
    </div>
  );
};