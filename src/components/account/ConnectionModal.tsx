import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useAccountStore } from '../../stores/account-store';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Button, Modal } from '../../shared/ui';
import { AccountCard } from './AccountCard';

export function ConnectionModal() {
  const { t } = useTranslation('account');
  const { open, close } = useUiStore(
    useShallow(s => ({ open: s.connectionOpen, close: s.closeConnection })),
  );
  const { repoPath, remoteUrl, remoteHost, remoteProtocol } = useRepoStore(
    useShallow(s => ({
      repoPath: s.repoPath,
      remoteUrl: s.remoteUrl,
      remoteHost: s.remoteHost,
      remoteProtocol: s.remoteProtocol,
    })),
  );
  const persistent = useAccountStore(s => s.persistent);

  if (!open || !remoteHost || !repoPath) return null;

  return (
    <Modal
      title={t('connection.title')}
      subtitle={remoteUrl ? <span className="font-mono break-all">{remoteUrl}</span> : remoteHost}
      width="w-[75%] max-w-lg"
      onClose={close}
      footer={
        <Button variant="secondary" size="sm" onClick={close}>
          {t('common:done')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <AccountCard onSignIn={close} />
        {remoteProtocol === 'https' && !persistent && (
          <p className="text-yellow text-xs">{t('section.notPersistent')}</p>
        )}
      </div>
    </Modal>
  );
}
