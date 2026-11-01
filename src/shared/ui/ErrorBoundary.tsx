import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, componentStack: string) => void;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
    this.props.onError?.(error, info.componentStack ?? '');
  }

  private reset = () => this.setState({ error: null });

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
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="h-screen flex flex-col items-center justify-center gap-4 bg-base text-text p-8 text-center select-text"
      >
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-subtext text-sm max-w-md break-words">{error.message}</p>
        <div className="flex gap-2">
          <Button onClick={this.handleReload}>Reload</Button>
          <Button variant="surface" onClick={this.handleCopy}>
            Copy error details
          </Button>
        </div>
      </div>
    );
  }
}
