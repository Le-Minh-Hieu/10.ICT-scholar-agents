import React, { useMemo, useRef } from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { IRECard } from './IRECard';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ReasoningEntity } from '../store/ire-engine';
import { NarrativeWaterfall } from './NarrativeWaterfall';

export const ReasoningPool: React.FC = () => {
  const { irePool, selectedAgent } = useAnalysisStore();
  const parentRef = useRef<HTMLDivElement>(null);

  // Group and sort entities
  const groupedData = useMemo(() => {
    const allEntities = Object.values(irePool);
    const groups: Record<string, ReasoningEntity[]> = {};
    
    const targetEntities = (!selectedAgent || selectedAgent.name === 'master')
      ? allEntities
      : allEntities.filter(e => e.metadata.agentId === selectedAgent.name);

    targetEntities.forEach(entity => {
      const groupKey = entity.metadata.agentId.toUpperCase();
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(entity);
    });

    // Flatten for virtualizer: [ {type: 'header', label: 'HTF'}, {type: 'item', entity: ...}, ... ]
    const flattened: any[] = [];
    Object.entries(groups).forEach(([label, entities]) => {
      flattened.push({ type: 'header', label });
      entities
        .sort((a, b) => b.confidence - a.confidence)
        .forEach(entity => flattened.push({ type: 'item', entity }));
    });

    return flattened;
  }, [irePool, selectedAgent]);

  const rowVirtualizer = useVirtualizer({
    count: groupedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => groupedData[index].type === 'header' ? 40 : 140,
    overscan: 5,
  });

  if (groupedData.length === 0) {
    return (
      <div className="p-8 bg-gray-900/20 border border-gray-800/50 rounded-2xl text-center border-dashed">
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic">
          No Reasoning Entities Synced for this Context
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 mb-2 shrink-0">
        <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">
          Institutional Reasoning Pool
        </h3>
        <div className="h-px flex-1 bg-blue-900/20"></div>
        <span className="text-[9px] font-mono text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-800/30">
          {Object.keys(irePool).length} NODES
        </span>
      </div>

      <NarrativeWaterfall />

      <div 
        ref={parentRef}
        className="flex-1 overflow-y-auto no-scrollbar pr-2"
        style={{ height: '600px' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const item = groupedData[virtualItem.index];
            
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {item.type === 'header' ? (
                  <div className="flex items-center gap-3 py-2">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em]">{item.label}</span>
                    <div className="h-px flex-1 bg-gray-800/30"></div>
                  </div>
                ) : (
                  <div className="pb-4">
                    <IRECard entity={item.entity} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
