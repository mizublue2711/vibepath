import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 bg-[#1b1714] text-[#f5f2ed] text-center">
          <div className="w-12 h-12 rounded-full bg-amber-900/40 border border-amber-600/60 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="font-cinzel text-lg font-bold mb-1">
            {this.props.fallbackTitle || 'Display Notice'}
          </h3>
          <p className="text-xs text-[#a89985] max-w-md mb-4 leading-relaxed">
            The visual module encountered a transient rendering event. Click below to refresh the interactive view.
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-[#8c3b31] hover:bg-[#a6483c] text-white text-xs font-semibold rounded-lg shadow flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload Battlefield View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
