import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Last-resort recovery UI: if a render throws anywhere below, show a small
// panel with a reload and a copy-details action instead of a blank window.
//
// Deliberately *not* internationalized and dependency-free: this is the fallback
// for when the app (i18n included) may itself be the thing that broke, so it
// must not rely on app runtime state.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopy = () => {
    const { error } = this.state;
    if (!error) return;
    const details = `${error.message}\n\n${error.stack ?? ''}`;
    void navigator.clipboard?.writeText(details);
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="h-screen flex flex-col items-center justify-center gap-4 bg-base text-text p-8 text-center select-text"
      >
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-subtext text-sm max-w-md break-words">{error.message}</p>
        <div className="flex gap-2">
          <button
            onClick={this.handleReload}
            className="px-3 py-1.5 rounded bg-blue text-base text-sm font-medium hover:opacity-90"
          >
            Reload
          </button>
          <button
            onClick={this.handleCopy}
            className="px-3 py-1.5 rounded bg-surface0 text-text text-sm hover:bg-surface1"
          >
            Copy error details
          </button>
        </div>
      </div>
    );
  }
}
