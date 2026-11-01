import i18n from 'i18next';
import { useLogStore } from './log-store';
import { useUiStore } from './ui-store';
import { errorLogId, errorMessage } from '../lib/error-message';
import type { Toast } from '../types';

export function openLogEntry(id: string): void {
  useLogStore.getState().setFocus(id);
  useUiStore.getState().openRightPanel('logs');
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
