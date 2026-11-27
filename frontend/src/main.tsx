import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LandscapeGuard } from "./components/LandscapeGuard";
import "./index.css";

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(_error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack || "" });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#070B16] text-white">
          <div className="max-w-xl w-full rounded-2xl bg-slate-900 border border-rose-500/50 p-6 space-y-4">
            <div className="text-xs font-extrabold uppercase tracking-widest text-rose-400">
              Runtime Render Error
            </div>
            <h1 className="text-xl font-black">Something went wrong rendering the stage</h1>
            <pre className="text-xs bg-slate-950 p-3 rounded-xl border border-white/10 text-rose-200 overflow-auto max-h-60 whitespace-pre-wrap">
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack || ""}
              {this.state.componentStack}
            </pre>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.clear();
                  sessionStorage.clear();
                } catch {}
                window.location.reload();
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
            >
              Reset Local Cache &amp; Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <LandscapeGuard>
        <App />
      </LandscapeGuard>
    </AppErrorBoundary>
  </StrictMode>,
);
