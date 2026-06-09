import React, { useEffect } from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { Sidebar } from '../components/Sidebar';
import { AgentTabs } from '../components/AgentTabs';
import { AgentView } from '../components/AgentView';
import { FullSystemView } from '../components/FullSystemView';
import { IntelligenceHUD } from '../components/IntelligenceHUD';
import { LogicErrorBoundary } from '../components/LogicErrorBoundary';

export const Dashboard: React.FC = () => {
  const { 
    debug, 
    toggleDebug, 
    metadata, 
    selectedAgent, 
    terminalMode, 
    setTerminalMode, 
    toggleHUD 
  } = useAnalysisStore();

  // Listen for Developer HUD hotkey (Alt + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleHUD();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden font-sans antialiased text-gray-200">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 to-gray-950">
        {/* Top Header Bar */}
        <header className="h-16 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 flex items-center justify-between px-8 shrink-0 z-20">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping absolute inset-0"></div>
                <div className="w-3 h-3 bg-blue-600 rounded-full relative shadow-[0_0_15px_rgba(37,99,235,0.8)]"></div>
              </div>
              <h1 className="text-xl font-black text-white uppercase tracking-tighter">
                Scholar <span className="text-blue-500 font-light">Audit Terminal</span>
              </h1>
            </div>
            
            {metadata && (
              <div className="hidden lg:flex items-center gap-4 px-5 py-2 bg-gray-950/50 rounded-2xl border border-gray-800/50 shadow-inner">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Active Trace</span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="font-black text-blue-400 tracking-widest">{metadata.primary_symbol}</span>
                  <div className="w-1 h-1 bg-gray-700 rounded-full"></div>
                  <span className="font-bold text-gray-400 tracking-wider">{metadata.session}</span>
                  <div className="w-1 h-1 bg-gray-700 rounded-full"></div>
                  <span className="font-mono text-gray-500 bg-black/30 px-2 py-0.5 rounded border border-gray-800">{metadata.capture_id}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800 mr-2 shadow-inner">
              <button
                onClick={() => setTerminalMode('STANDARD')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  terminalMode === 'STANDARD' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setTerminalMode('INSTITUTIONAL')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  terminalMode === 'INSTITUTIONAL' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                Institutional
              </button>
            </div>
            <div className="flex flex-col items-end mr-4">
               <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">System Online</span>
               <span className="text-[10px] font-mono text-gray-500">Live_Stream_Connected</span>
            </div>
            <button 
              onClick={toggleDebug}
              className={`group flex items-center gap-3 px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                debug 
                ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]' 
                : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              <div className={`w-2 h-2 rounded-full transition-colors ${debug ? 'bg-white shadow-[0_0_8px_white]' : 'bg-gray-700 group-hover:bg-gray-500'}`}></div>
              Debug Trace
            </button>
          </div>
        </header>

        {/* Agent Navigation Tabs */}
        <AgentTabs />

        {/* Dynamic View Content */}
        <main className="flex-1 flex flex-col min-h-0 relative">
          <LogicErrorBoundary componentName="MainTerminalView">
            {selectedAgent?.name === 'master' ? (
              <FullSystemView />
            ) : (
              <AgentView />
            )}
          </LogicErrorBoundary>
          
          {/* Subtle overlay effect */}
          <div className="absolute inset-0 pointer-events-none border-[12px] border-gray-950/20 rounded-3xl mix-blend-overlay"></div>
        </main>

        <IntelligenceHUD />

        {/* Footer Status */}
        <footer className="h-10 bg-gray-900/50 backdrop-blur-md border-t border-gray-800 px-6 flex items-center justify-between text-[9px] font-black text-gray-500 tracking-[0.3em] uppercase shrink-0">
          <div className="flex gap-8 items-center">
            <div className="flex gap-2 items-center">
              <span className="w-1 h-1 bg-green-500 rounded-full shadow-[0_0_5px_#22c55e]"></span>
              <span>CORE_NODE: <span className="text-gray-300">ACTIVE</span></span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="w-1 h-1 bg-blue-500 rounded-full shadow-[0_0_5px_#3b82f6]"></span>
              <span>RAG_DATA_LINK: <span className="text-gray-300">STABLE</span></span>
            </div>
          </div>
          <div className="flex gap-6 items-center italic text-gray-600">
            <span>Level 3 Frontend Architect Authorization</span>
            <span className="text-[8px] opacity-50 font-mono">0x42_DEBUG_VERIFIED</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
