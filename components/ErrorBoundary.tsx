import React from 'react';

interface Props { children?: React.ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#111116] flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-900/50 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-white font-black text-xl uppercase tracking-tight">Something went wrong</h1>
            <p className="text-slate-500 text-sm">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return (this as unknown as { props: Props }).props.children ?? null;
  }
}
