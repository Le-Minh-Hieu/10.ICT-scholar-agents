import React from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore';

const TABS = [
  { id: 'master-FULL SYSTEM', label: 'Global Truth', layer: 'master', agent: 'master' },
  { id: 'time-session', label: 'Session', layer: 'time', agent: 'session' },
  { id: 'time-daily', label: 'Daily', layer: 'time', agent: 'daily' },
  { id: 'time-weekly', label: 'Weekly', layer: 'time', agent: 'weekly' },
  { id: 'time-monthly', label: 'Monthly', layer: 'time', agent: 'monthly' },
  { id: 'time-quarterly', label: 'Quarterly', layer: 'time', agent: 'quarterly' },
  { id: 'time-macro', label: 'Macro', layer: 'time', agent: 'macro-time' },
  { id: 'htf-structure', label: 'HTF Structure', layer: 'htf', agent: 'htf-structure' },
  { id: 'htf-macro', label: 'HTF Macro', layer: 'htf', agent: 'htf-macro' },
  { id: 'htf-liquidity', label: 'HTF Liquidity', layer: 'htf', agent: 'htf-liquidity' },
  { id: 'htf-pd_array', label: 'HTF PD Array', layer: 'htf', agent: 'htf-pdarray' },
  { id: 'itf-structure', label: 'ITF Structure', layer: 'itf', agent: 'itf-structure' },
  { id: 'itf-liquidity', label: 'ITF Liquidity', layer: 'itf', agent: 'itf-liquidity' },
  { id: 'itf-pd_array', label: 'ITF PD Array', layer: 'itf', agent: 'itf-pd-array' },
  { id: 'itf-setup', label: 'ITF Setup', layer: 'itf', agent: 'itf-setup' },
  { id: 'ltf-structure', label: 'LTF Structure', layer: 'ltf', agent: 'ltf-structure' },
  { id: 'ltf-liquidity', label: 'LTF Liquidity', layer: 'ltf', agent: 'ltf-liquidity' },
  { id: 'ltf-pd_array', label: 'LTF PD Array', layer: 'ltf', agent: 'ltf-pd-array' },
  { id: 'ltf-trigger', label: 'LTF Trigger', layer: 'ltf', agent: 'ltf-trigger' },
  { id: 'confluence-model', label: 'C-Model', layer: 'confluence', agent: 'model' },
  { id: 'confluence-behavior', label: 'C-Behavior', layer: 'confluence', agent: 'behavior' },
  { id: 'confluence-delivery', label: 'C-Delivery', layer: 'confluence', agent: 'delivery' },
  { id: 'confluence-imbalance', label: 'C-Imbalance', layer: 'confluence', agent: 'imbalance' },
];

export const AgentTabs: React.FC = () => {
  const { selectedAgent, setSelectedAgent } = useAnalysisStore();

  return (
    <div className="bg-gray-900 border-b border-gray-800 shrink-0 z-10">
      <div className="flex overflow-x-auto no-scrollbar py-3 px-6 space-x-2 items-center">
        {TABS.map((tab) => {
          const isActive = selectedAgent?.layer === tab.layer && selectedAgent?.name === tab.agent;
          const isGlobal = tab.layer === 'master';
          
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedAgent({ layer: tab.layer, name: tab.agent })}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 border ${
                isActive
                  ? isGlobal 
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/50 scale-105 z-10'
                    : 'bg-gray-200 border-white text-gray-950 shadow-lg scale-105 z-10'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {isGlobal && <span className="w-1.5 h-1.5 rounded-full bg-blue-200 animate-pulse"></span>}
                {tab.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
