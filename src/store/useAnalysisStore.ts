import { create } from 'zustand';
import { startTransition } from 'react';
import { ReasoningEntity, normalizeToIRE } from './ire-engine';

type AnalysisState = {
  // Current data
  data: any;
  status: any;
  metadata: any;
  loading: boolean;
  debug: boolean;
  terminalMode: 'STANDARD' | 'INSTITUTIONAL';
  hudVisible: boolean;
  lastNormalizationTime: number;

  // Reasoning Entities (IRE System)
  irePool: Record<string, ReasoningEntity>;
  reconciliationBuffer: Record<string, ReasoningEntity[]>;
  snapshotHistory: { timestamp: string, pool: Record<string, ReasoningEntity> }[];
  
  // Navigation
  sessions: Record<string, string[]>;
  selectedDate: string | null;
  selectedSession: string | null;
  selectedCaptureId: string | null;
  selectedAgent: { layer: string; name: string } | null;

  // Actions
  setData: (data: any) => void;
  setStatus: (status: any) => void;
  setMetadata: (metadata: any) => void;
  setLoading: (v: boolean) => void;
  toggleDebug: () => void;
  setSessions: (sessions: Record<string, string[]>) => void;
  setSelectedDate: (date: string | null) => void;
  setSelectedSession: (session: string | null) => void;
  setSelectedCaptureId: (captureId: string | null) => void;
  setSelectedAgent: (agent: { layer: string; name: string } | null) => void;
  setTerminalMode: (mode: 'STANDARD' | 'INSTITUTIONAL') => void;
  toggleHUD: () => void;
  takeSnapshot: () => void;
  
  // Actions for IRE
  syncIREPool: (data: any, metadata: any) => void;
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  data: null,
  status: null,
  metadata: null,
  loading: false,
  debug: false,
  terminalMode: 'STANDARD',
  hudVisible: false,
  lastNormalizationTime: 0,
  irePool: {},
  reconciliationBuffer: {},
  snapshotHistory: [],
  
  sessions: {},
  selectedDate: null,
  selectedSession: null,
  selectedCaptureId: null,
  selectedAgent: { layer: 'master', name: 'master' },

  setData: (data) => {
    set({ data });
    const metadata = useAnalysisStore.getState().metadata;
    if (metadata) {
      useAnalysisStore.getState().syncIREPool(data, metadata);
    }
  },
  setStatus: (status) => set({ status }),
  setMetadata: (metadata) => {
    set({ metadata });
    const data = useAnalysisStore.getState().data;
    if (data) {
      useAnalysisStore.getState().syncIREPool(data, metadata);
    }
  },
  setLoading: (loading) => set({ loading }),
  toggleDebug: () => set((state) => ({ debug: !state.debug })),
  setSessions: (sessions) => set({ sessions }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setSelectedSession: (selectedSession) => set({ selectedSession }),
  setSelectedCaptureId: (selectedCaptureId) => set({ selectedCaptureId }),
  setSelectedAgent: (selectedAgent) => {
    startTransition(() => {
      set({ selectedAgent });
    });
  },
  setTerminalMode: (terminalMode) => {
    startTransition(() => {
      set({ terminalMode });
    });
  },
  toggleHUD: () => set((state) => ({ hudVisible: !state.hudVisible })),
  takeSnapshot: () => set((state) => ({
    snapshotHistory: [
      { timestamp: new Date().toISOString(), pool: { ...state.irePool } },
      ...state.snapshotHistory.slice(0, 9)
    ]
  })),

  syncIREPool: (data, metadata) => {
    if (!data || !metadata) return;
    const startTime = performance.now();

    const newEntries: Record<string, ReasoningEntity> = {};
    const agentName = metadata.agent || 'system';
    const timestamp = metadata.timestamp || new Date().toISOString();
    const epoch = metadata.processing_time_ms || 0;

    const processFacts = (targetData: any) => {
      if (targetData?.facts && Array.isArray(targetData.facts)) {
        targetData.facts.forEach((f: any) => {
          const ire = normalizeToIRE(f, agentName, timestamp, epoch);
          newEntries[ire.id] = ire;
        });
      }
    };

    processFacts(data);
    if (data.layers) {
      Object.entries(data.layers).forEach(([_, layerData]) => {
        processFacts(layerData);
      });
    }

    set((state) => {
      const updatedPool = { ...state.irePool };
      const updatedBuffer = { ...state.reconciliationBuffer };

      Object.values(newEntries).forEach((ire) => {
        const parentId = ire.narrative?.parentIRE;
        
        if (parentId && !updatedPool[parentId]) {
          if (!updatedBuffer[parentId]) updatedBuffer[parentId] = [];
          updatedBuffer[parentId].push(ire);
        } else {
          updatedPool[ire.id] = ire;
          
          const reconcileChildren = (id: string) => {
            const children = updatedBuffer[id];
            if (children) {
              children.forEach((child) => {
                updatedPool[child.id] = child;
                reconcileChildren(child.id);
              });
              delete updatedBuffer[id];
            }
          };
          reconcileChildren(ire.id);
        }
      });

      return {
        irePool: updatedPool,
        reconciliationBuffer: updatedBuffer,
        lastNormalizationTime: performance.now() - startTime
      };
    });
  },
}));
