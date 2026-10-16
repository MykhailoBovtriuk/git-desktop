import { useEffect } from 'react';
import { updateApi } from '../api/update-api';
import { useUpdateStore } from '../stores/update-store';
import { useSettingsStore } from '../stores/settings-store';

export const STARTUP_CHECK_DELAY_MS = 3000;

export function useUpdateCheck() {
  useEffect(() => updateApi.onProgress(p => useUpdateStore.getState().setProgress(p)), []);

  useEffect(() => {
    if (!useSettingsStore.getState().autoCheckUpdates) return;
    const id = setTimeout(
      () => void useUpdateStore.getState().check({ silent: true }),
      STARTUP_CHECK_DELAY_MS,
    );
    return () => clearTimeout(id);
  }, []);
}
