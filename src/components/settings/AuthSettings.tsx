import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { gitApi } from '../../api/git-api';
import { appApi } from '../../api/app-api';
import { Badge, Button } from '../../shared/ui';
import type { AuthStatus } from '../../types';

// Must stay inside the allowlist in electron/ipc/app.ts, or the click is refused.
const DOCS_URL = 'https://docs.github.com/en/authentication';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-subtext text-xs shrink-0">{label}</span>
      <span className="text-text text-xs text-right min-w-0 truncate">{value}</span>
    </div>
  );
}

interface AuthSettingsProps {
  /** Opened from an authentication error, so the details are what the user came for. */
  defaultExpanded?: boolean;
}

export function AuthSettings({ defaultExpanded = false }: AuthSettingsProps) {
  const { t } = useTranslation('settings');
  const repoPath = useRepoStore(s => s.repoPath);
  const addToast = useUiStore(s => s.addToast);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [helpers, setHelpers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const load = useCallback(() => {
    Promise.all([gitApi.getAuthStatus(), gitApi.getAllowedHelpers()])
      .then(([s, h]) => {
        setStatus(s);
        setHelpers(h);
      })
      .catch(() => {});
  }, []);

  useEffect(load, [load, repoPath]);

  const enableHelper = async () => {
    const value = helpers[0];
    if (!value) return;
    setBusy(true);
    try {
      await gitApi.setCredentialHelper(value);
      addToast({
        variant: 'success',
        title: t('auth.title'),
        message: t('auth.helperSet', { value }),
      });
      load();
    } catch (err: unknown) {
      addToast({
        variant: 'error',
        title: t('auth.title'),
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const openDocs = () => {
    appApi.openExternal(DOCS_URL).catch((err: unknown) => {
      addToast({
        variant: 'error',
        title: t('auth.title'),
        message: err instanceof Error ? err.message : String(err),
      });
    });
  };

  if (!status) return <p className="text-subtext text-xs">{t('common:loading')}</p>;

  // Something the user can act on: an HTTPS remote with nowhere to keep the
  // password will fail on the first push.
  const needsAttention = status.isHttps && !status.credentialHelper;

  const summary = !status.remoteUrl
    ? t('auth.summaryNoRemote')
    : status.isHttps
      ? status.credentialHelper
        ? t('auth.summaryHttps', { helper: status.credentialHelper })
        : t('auth.summaryHttpsNoHelper')
      : t('auth.summarySsh');

  return (
    <div className="flex flex-col gap-3">
      {/* Collapsed by default: these rows are diagnostics, and diagnostics that
          are always green are noise. They expand on demand, and automatically
          when the user arrives here from a failed push. */}
      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="flex items-center gap-2 text-xs text-left hover:bg-surface0 rounded px-2 py-1.5 -mx-2 transition-colors"
      >
        <span className="text-subtext shrink-0">{expanded ? '▼' : '▶'}</span>
        <span className={needsAttention ? 'text-yellow' : 'text-text'}>{summary}</span>
      </button>

      {!expanded && needsAttention && helpers.length > 0 && (
        <Button
          variant="primary"
          size="sm"
          className="self-start"
          disabled={busy}
          onClick={enableHelper}
        >
          {t('auth.enableHelper')}
        </Button>
      )}

      {expanded && (
        <div className="bg-mantle rounded p-3">
          <Row
            label={t('auth.remote')}
            value={
              repoPath ? (
                status.remoteUrl ? (
                  <>
                    <Badge variant="ref">{status.isHttps ? 'HTTPS' : 'SSH'}</Badge>{' '}
                    <span className="font-mono">{status.remoteUrl}</span>
                  </>
                ) : (
                  t('auth.noRemote')
                )
              ) : (
                t('auth.noRepo')
              )
            }
          />
          <Row
            label={t('auth.helper')}
            value={
              status.credentialHelper ? (
                <span className="font-mono">{status.credentialHelper}</span>
              ) : (
                <span className="text-yellow">{t('auth.helperMissing')}</span>
              )
            }
          />
          {/* An SSH remote picks its key from ~/.ssh/config by the URL. Saying so
            beats leaving the row out, which read as "not configured". */}
          {!status.isHttps && status.remoteUrl && (
            <Row label={t('auth.sshKey')} value={t('auth.sshKeyFromConfig')} />
          )}
          {repoPath && (
            <Row
              label={t('auth.signing')}
              value={
                status.signingReady ? (
                  <span className="text-green">{t('auth.signingOn')}</span>
                ) : (
                  t('auth.signingOff')
                )
              }
            />
          )}
        </div>
      )}

      {expanded && !status.credentialHelper && helpers.length > 0 && (
        <div className="flex flex-col gap-1">
          <Button variant="primary" size="sm" disabled={busy} onClick={enableHelper}>
            {t('auth.enableHelper')}
          </Button>
          <p className="text-subtext text-xs">
            {t('auth.enableHelperHint', { value: helpers[0] })}
          </p>
        </div>
      )}

      {expanded && (
        <Button variant="secondary" size="sm" className="self-start" onClick={openDocs}>
          {t('auth.docs')}
        </Button>
      )}
    </div>
  );
}
