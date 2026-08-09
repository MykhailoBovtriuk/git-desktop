import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../stores/ui-store';
import { Button, Modal } from '../../shared/ui';

export function ConfirmDialog() {
  const { t } = useTranslation('common');
  const { confirmRequest, resolveConfirm } = useUiStore(
    useShallow(s => ({ confirmRequest: s.confirmRequest, resolveConfirm: s.resolveConfirm })),
  );

  if (!confirmRequest) return null;

  return (
    <Modal
      title={confirmRequest.title}
      titleVariant={confirmRequest.danger ? 'danger' : 'default'}
      level="high"
      onClose={() => resolveConfirm(false)}
    >
      <p className="text-subtext text-sm whitespace-pre-wrap">{confirmRequest.message}</p>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={() => resolveConfirm(false)}>
          {t('common:cancel')}
        </Button>
        <Button
          variant={confirmRequest.danger ? 'danger' : 'primary'}
          onClick={() => resolveConfirm(true)}
        >
          {confirmRequest.confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
