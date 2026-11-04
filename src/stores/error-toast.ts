import i18n from 'i18next';
import { useLogStore } from './log-store';
import { useUiStore } from './ui-store';
import { accountApi } from '../api/account-api';
import { errorLogId, errorMessage } from '../lib/error-message';
import type { Toast } from '../types';

export function openLogEntry(id: string): void {
  useLogStore.getState().setFocus(id);
  const ui = useUiStore.getState();
  // The logs panel is hidden under Settings and sits behind the connection dialog.
  ui.closeOverlays();
  ui.closeConnection();
  ui.openRightPanel('logs');
}

export function showInLogs(err: unknown): Toast['details'] {
  const id = errorLogId(err);
  return id ? { label: i18n.t('logs:showInLogs'), onClick: () => openLogEntry(id) } : undefined;
}

export function showErrorToast(title: string, err: unknown): void {
  useUiStore.getState().addToast({
    variant: 'error',
    title,
    message: errorMessage(err),
    details: showInLogs(err),
  });
}

export function requestOrgAccess(repoPath: string | null, failedTitle: string): void {
  void accountApi.openOrgAccess(repoPath).catch((e: unknown) => showErrorToast(failedTitle, e));
}
