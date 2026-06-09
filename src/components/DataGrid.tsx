import React from 'react';
import { ReasoningNarrative } from './reasoning/ReasoningNarrative';

type DataGridProps = {
  data: any;
};

export const DataGrid: React.FC<DataGridProps> = ({ data }) => {
  if (!data || typeof data !== 'object') {
    return <div className="text-gray-500 italic">No explicit data fields found</div>;
  }

  const renderValue = (value: any): React.ReactNode => {
    if (value === null) return <span className="text-red-500 font-bold uppercase text-[10px]">null</span>;
    if (typeof value === 'boolean') {
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
          value ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {value ? 'TRUE' : 'FALSE'}
        </span>
      );
    }
    if (Array.isArray(value)) {
      return (
        <ul className="space-y-1.5 list-disc list-inside">
          {value.map((item, i) => (
            <li key={i} className="text-gray-300 leading-relaxed marker:text-blue-500">
              {typeof item === 'object' && item !== null ? (
                <div className="inline-block align-top ml-2">{renderValue(item)}</div>
              ) : (
                String(item)
              )}
            </li>
          ))}
        </ul>
      );
    }
    if (typeof value === 'object') {
      return (
        <div className="pl-4 border-l border-gray-800 space-y-4 py-2">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="space-y-1">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{k}</span>
              <div className="text-sm font-medium text-gray-200">{renderValue(v)}</div>
            </div>
          ))}
        </div>
      );
    }
    return <span className="text-gray-200 leading-relaxed whitespace-pre-wrap">{String(value)}</span>;
  };

  const renderLongText = (key: string, value: any) => {
    const isReasoning = key.toLowerCase().includes('reasoning') || 
                        key.toLowerCase().includes('narrative');
    
    if (isReasoning && typeof value === 'string') {
      return <ReasoningNarrative reasoning={value} agentId="system" />;
    }
    
    return renderValue(value);
  };

  // Filter out _debug and other metadata from explicit view
  const displayFields = Object.entries(data).filter(([key]) => !key.startsWith('_'));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {displayFields.map(([key, value]) => {
        // Special layout for long text/reasoning/notes
        const isLongText = key.toLowerCase().includes('reasoning') || 
                          key.toLowerCase().includes('notes') || 
                          key.toLowerCase().includes('narrative');
        
        return (
          <div key={key} className={`space-y-2 ${isLongText ? 'col-span-full' : ''}`}>
            <div className="flex items-center gap-3">
              <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">{key.replace(/_/g, ' ')}</h4>
              <div className="h-px flex-1 bg-gray-800/50"></div>
            </div>
            <div className={`p-6 rounded-2xl bg-gray-900/30 border border-gray-800/50 shadow-xl transition-all duration-300 hover:border-gray-700 ${isLongText ? 'bg-blue-500/5' : ''}`}>
              <div className={`${isLongText ? 'text-sm' : 'text-base'} font-medium`}>
                {isLongText ? renderLongText(key, value) : renderValue(value)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
