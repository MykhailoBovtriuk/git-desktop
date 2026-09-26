import { useEffect } from 'react';
import { updateApi } from '../api/update-api';
import { useUpdateStore } from '../stores/update-store';
import { useSettingsStore } from '../stores/settings-store';

/** Long enough to stay out of the first paint and the repository's first load. */
export const STARTUP_CHECK_DELAY_MS = 3000;

export function useUpdateCheck() {
  // Progress is pushed whether or not the modal is open, so the subscription
  // lives for the app's lifetime.
  useEffect(() => updateApi.onProgress(p => useUpdateStore.getState().setProgress(p)), []);

  // Read once rather than subscribed: switching the setting on later is not
  // a request to check right now; the button in Settings is.
  useEffect(() => {
    if (!useSettingsStore.getState().autoCheckUpdates) return;
    const id = setTimeout(
      () => void useUpdateStore.getState().check({ silent: true }),
      STARTUP_CHECK_DELAY_MS,
    );
    return () => clearTimeout(id);
  }, []);
}
