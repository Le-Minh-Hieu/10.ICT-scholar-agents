import React from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { AgentCard } from './AgentCard';

export const DebugPanel: React.FC = () => {
  const { data, debug } = useAnalysisStore();

  if (!debug || !data || !data.debugData) {
    return null;
  }

  const renderLayerAgents = (title: string, agentsData: any) => {
    if (!agentsData || Object.keys(agentsData).length === 0) return null;

    const layerMap: Record<string, string> = {
      'HTF Agents': 'htf',
      'ITF Agents': 'itf',
      'LTF Agents': 'ltf',
      'TIME Agents': 'time',
      'CONFLUENCE Agents': 'confluence'
    };
    const layer = layerMap[title] || '';

    return (
      <div className="mb-6">
        <h3 className="font-bold text-gray-800 border-b pb-1 mb-3">{title}</h3>
        {Object.entries(agentsData).map(([agentName, agentData]) => (
          <AgentCard key={agentName} name={agentName} layer={layer} data={agentData} />
        ))}
      </div>
    );
  };

  const { htfAgents, itfAgents, ltfAgents, timeAgents, confluenceAgents } = data.debugData;

  return (
    <div className="p-4 border rounded shadow-sm bg-gray-100 h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2 text-purple-700">Debug Internals</h2>
      
      {renderLayerAgents('HTF Agents', htfAgents)}
      {renderLayerAgents('ITF Agents', itfAgents)}
      {renderLayerAgents('LTF Agents', ltfAgents)}
      {renderLayerAgents('TIME Agents', timeAgents)}
      {renderLayerAgents('CONFLUENCE Agents', confluenceAgents)}
    </div>
  );
};