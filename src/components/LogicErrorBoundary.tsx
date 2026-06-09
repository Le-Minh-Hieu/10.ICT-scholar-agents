import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class LogicErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`IRE System Failure [${this.props.componentName || 'Unknown'}]:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 bg-red-950/20 border border-red-500/30 rounded-2xl shadow-2xl flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.876c1.27 0 2.09-1.383 1.432-2.505l-6.938-12.08a2.01 2.01 0 00-3.464 0L3.47 16.995c-.658 1.122.162 2.505 1.432 2.505z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-black text-red-400 uppercase tracking-[0.3em]">Component Circuit Breaker Active</h3>
            <p className="text-[10px] text-red-300/60 font-medium">The reasoning runtime for this panel has encountered a schema-level conflict.</p>
          </div>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-1.5 bg-red-900/40 border border-red-500/30 rounded-lg text-[9px] font-black text-red-200 uppercase tracking-widest hover:bg-red-900/60 transition-colors"
          >
            Re-Initialize Runtime
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
