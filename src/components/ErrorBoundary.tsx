import React, { ReactNode } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "./ui/Button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-red-500 blur-[60px] opacity-20" />
            <AlertCircle size={80} className="text-red-500 relative" />
          </div>
          
          <h1 className="text-3xl font-black tracking-tight mb-4 uppercase">System Interrupted</h1>
          <p className="text-white/60 text-sm max-w-md leading-relaxed mb-8">
            A critical error occurred in the application matrix. This might be due to a poor connection or an unexpected data conflict.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-8 max-w-lg w-full text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Error Log</p>
            <p className="text-[11px] font-mono opacity-60 break-all">
              {this.state.error?.message || "Unknown runtime exception"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
            <Button 
              onClick={this.handleReset}
              className="flex-1 rounded-2xl h-14 bg-white text-black hover:bg-white/90 gap-2 font-bold"
            >
              <RotateCcw size={18} />
              Reboot App
            </Button>
            <Button 
              onClick={() => window.location.href = '/'}
              variant="outline"
              className="flex-1 rounded-2xl h-14 border-white/10 gap-2 font-bold"
            >
              <Home size={18} />
              Go Home
            </Button>
          </div>
          
          <p className="mt-12 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
            TS PRICE MANAGER | RECOVERY MODULE
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
