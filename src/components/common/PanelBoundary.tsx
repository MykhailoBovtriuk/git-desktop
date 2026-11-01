import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { logApi } from '../../api/log-api';
import { useCopy } from '../../hooks/use-copy';
import { openLogEntry } from '../../stores/error-toast';
import { Button, ErrorBoundary } from '../../shared/ui';

export function reportRenderError(error: Error, componentStack: string): Promise<string | null> {
  return logApi.report('ui-crash', error.message, `${error.stack ?? ''}\n${componentStack}`);
}

function PanelFallback({
  error,
  logId,
  reset,
}: {
  error: Error;
  logId: string | null;
  reset: () => void;
}) {
  const { t } = useTranslation('common');
  const { copied, copy } = useCopy();
  return (
    <div
      role="alert"
      className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center select-text"
    >
      <p className="text-text text-sm font-medium">{t('panelFailed')}</p>
      <p className="text-subtext text-xs max-w-md break-words">{error.message}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={reset}>
          {t('retry')}
        </Button>
        {logId && (
          <Button size="sm" variant="surface" onClick={() => openLogEntry(logId)}>
            {t('logs:showInLogs')}
          </Button>
        )}
        <Button
          size="sm"
          variant="surface"
          onClick={() => copy(`${error.message}\n\n${error.stack ?? ''}`)}
        >
          {copied ? t('logs:copied') : t('copyDetails')}
        </Button>
      </div>
    </div>
  );
}

export function PanelBoundary({ children }: { children: ReactNode }) {
  const [logId, setLogId] = useState<string | null>(null);
  return (
    <ErrorBoundary
      onError={(error, stack) => void reportRenderError(error, stack).then(setLogId)}
      fallback={(error, reset) => <PanelFallback error={error} logId={logId} reset={reset} />}
    >
      {children}
    </ErrorBoundary>
  );
}
