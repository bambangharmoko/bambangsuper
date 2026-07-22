import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
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
    console.error("Uncaught error:", error, errorInfo);
    
    // Chunk load error detection (Vite/Rollup dynamic import failure)
    const isChunkLoadError = 
      error.name === 'ChunkLoadError' ||
      (error.message && error.message.toLowerCase().includes('failed to fetch dynamically imported module')) ||
      (error.message && error.message.toLowerCase().includes('importing a module script failed'));

    if (isChunkLoadError) {
      const reloadCount = parseInt(sessionStorage.getItem('chunk_failed_reload') || '0', 10);
      
      // Auto reload ONCE to try fetching the new chunks
      if (reloadCount < 1) {
        sessionStorage.setItem('chunk_failed_reload', (reloadCount + 1).toString());
        window.location.reload();
        return;
      }
    }
  }

  private handleReload = () => {
    sessionStorage.removeItem('chunk_failed_reload');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-center">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm flex flex-col items-center max-w-md w-full">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-xl font-bold mb-2">Terjadi Kesalahan</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Aplikasi mengalami masalah saat memuat halaman ini. Hal ini mungkin karena koneksi terputus atau ada pembaruan sistem.
            </p>
            
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Muat Ulang Aplikasi
            </button>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-6 w-full rounded-md bg-muted p-4 text-left text-xs font-mono overflow-auto max-h-32 text-muted-foreground">
                {this.state.error.toString()}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
