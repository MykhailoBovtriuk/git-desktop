import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './shared/ui';
import { logApi } from './api/log-api';
import { reportRenderError } from './components/common/PanelBoundary';
import { errorMessage } from './lib/error-message';
import './styles/globals.css';

// Errors outside rendering (handlers, effects, promises) never reach a boundary.
window.addEventListener('error', e => {
  void logApi.report('ui-unhandled', e.message || errorMessage(e.error), e.error?.stack);
});
window.addEventListener('unhandledrejection', e => {
  void logApi.report('ui-unhandled', errorMessage(e.reason), e.reason?.stack);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary onError={(error, stack) => void reportRenderError(error, stack)}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
