import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logApi } from '../../api/log-api';
import { useLogStore } from '../../stores/log-store';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Button, SegmentedControl } from '../../shared/ui';
import { LOG_RETENTIONS, type LogRetention, type LogStats } from '../../types';
import { SettingsSection } from './SettingsSection';
import { formatBytes } from '../../lib/format-bytes';

/** Retention lives in the main process, which writes the files before any window asks. */
export function LogsSection() {
  const { t } = useTranslation('logs');
  const requestConfirm = useUiStore(s => s.requestConfirm);
  const clearLog = useLogStore(s => s.clear);
  const entryCount = useLogStore(s => s.entries.length);
  // Size, clearing and the folder are the open repository's; how long logs are
  // kept applies to all of them.
  const repoPath = useRepoStore(s => s.repoPath);
  const [retention, setRetention] = useState<LogRetention | null>(null);
  const [stats, setStats] = useState<LogStats | null>(null);

  const refreshStats = useCallback(() => {
    if (!repoPath) return setStats(null);
    void logApi
      .stats(repoPath)
      .then(setStats)
      .catch(() => {});
  }, [repoPath]);

  useEffect(() => {
    void logApi
      .getRetention()
      .then(setRetention)
      .catch(() => {});
  }, []);

  // The figure follows operations finished while Settings is open.
  useEffect(refreshStats, [refreshStats, entryCount]);

  const change = async (next: LogRetention) => {
    if (next === retention) return;
    if (next === 'forever' || next === 'session') {
      const ok = await requestConfirm({
        title: t(`settings.${next}Title`),
        message: t(`settings.${next}Message`),
        confirmLabel: t(`settings.${next}Confirm`),
        danger: next === 'session',
      });
      if (!ok) return;
    }
    await logApi.setRetention(next);
    setRetention(next);
    refreshStats();
  };

  const clear = async () => {
    const ok = await requestConfirm({
      title: t('settings.clearTitle'),
      message: t('settings.clearMessage'),
      confirmLabel: t('settings.clearConfirm'),
      danger: true,
    });
    if (!ok) return;
    await clearLog().catch(() => {});
    refreshStats();
  };

  return (
    <>
      <SettingsSection title={t('settings.keepTitle')} description={t('settings.hint')}>
        {retention && (
          <SegmentedControl
            label={t('settings.keepTitle')}
            value={retention}
            onChange={(value: LogRetention) => void change(value).catch(() => {})}
            options={LOG_RETENTIONS.map(value => ({
              value,
              label: t(`settings.retention.${value}`),
            }))}
          />
        )}
      </SettingsSection>
      {/* Size, clearing and the folder belong to the open repository. */}
      {repoPath && (
        <SettingsSection title={t('settings.repoTitle')} description={t('settings.repoHint')}>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-subtext text-xs">
                {t('settings.usage', { size: formatBytes(stats.bytes), count: stats.entries })}
              </span>
            )}
            {retention !== 'session' && (
              <Button
                variant="surface"
                size="sm"
                onClick={() => void logApi.openFolder(repoPath).catch(() => {})}
              >
                {t('settings.openFolder')}
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              onClick={() => void clear()}
              disabled={!stats?.entries}
            >
              {t('settings.clear')}
            </Button>
          </div>
        </SettingsSection>
      )}
    </>
  );
}
