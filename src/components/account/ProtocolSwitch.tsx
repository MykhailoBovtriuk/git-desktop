import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useBusy } from '../../hooks/use-busy';
import { SegmentedControl } from '../../shared/ui';
import { showErrorToast } from '../../stores/error-toast';
import type { SwitchableProtocol } from '../../types';

export function ProtocolSwitch({ onSwitched }: { onSwitched?: (to: SwitchableProtocol) => void }) {
  const { t } = useTranslation('account');
  const { repoPath, remoteProtocol, switchRemoteProtocol } = useRepoStore(
    useShallow(s => ({
      repoPath: s.repoPath,
      remoteProtocol: s.remoteProtocol,
      switchRemoteProtocol: s.switchRemoteProtocol,
    })),
  );
  const [busy, track] = useBusy();

  if (!repoPath || (remoteProtocol !== 'ssh' && remoteProtocol !== 'https')) return null;

  const switchTo = (to: SwitchableProtocol) => {
    if (busy || to === remoteProtocol) return;
    void track(() => switchRemoteProtocol(to))
      .then(() => onSwitched?.(to))
      .catch((err: unknown) => showErrorToast(t('connection.switchFailed'), err));
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-text text-xs">{t('connection.protocol')}</p>
        <p className="text-subtext text-xs">{t('connection.protocolHint')}</p>
      </div>
      <SegmentedControl
        label={t('connection.protocol')}
        value={remoteProtocol}
        onChange={switchTo}
        options={[
          { value: 'ssh', label: 'SSH' },
          { value: 'https', label: 'HTTPS' },
        ]}
        className={busy ? 'shrink-0 opacity-50 pointer-events-none' : 'shrink-0'}
      />
    </div>
  );
}
