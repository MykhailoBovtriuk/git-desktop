import { create } from 'zustand';
import { updateApi } from '../api/update-api';
import { useSettingsStore } from './settings-store';
import { useRepoStore } from './repo-store';
import { errorMessage } from '../lib/error-message';
import type { UpdateCheckResult, UpdatePhase, UpdateProgress } from '../types';

interface UpdateState {
  phase: UpdatePhase;
  result: UpdateCheckResult | null;
  progress: UpdateProgress | null;
  downloadedVersion: string | null;
  error: string | null;
  modalOpen: boolean;
  cancelRequested: boolean;

  check: (opts?: { silent?: boolean; force?: boolean }) => Promise<void>;
  setProgress: (progress: UpdateProgress) => void;
  startDownload: (version: string) => Promise<void>;
  cancelDownload: () => Promise<void>;
  install: () => Promise<void>;
  later: () => void;
  skip: () => void;
}

export const useUpdateStore = create<UpdateState>()((set, get) => ({
  phase: 'idle',
  result: null,
  progress: null,
  downloadedVersion: null,
  error: null,
  modalOpen: false,
  cancelRequested: false,

  check: async ({ silent = false, force = false } = {}) => {
    const phase = get().phase;
    if (phase === 'checking' || phase === 'downloading') return;

    if (force && useSettingsStore.getState().skippedVersion) {
      useSettingsStore.getState().setSkippedVersion(null);
    }

    set({ phase: 'checking', error: null });
    try {
      const result = await updateApi.check(useSettingsStore.getState().includePrereleases, force);
      const available = result.status === 'available' && result.latest !== null;
      const skipped = useSettingsStore.getState().skippedVersion;
      set(s => ({
        result,
        phase: available ? 'available' : 'idle',
        error: null,
        modalOpen: available && result.latest?.version !== skipped ? true : s.modalOpen,
      }));
    } catch (err) {
      if (silent) {
        set({ phase: 'idle', error: null });
        return;
      }
      set({ phase: 'error', error: errorMessage(err) });
    }
  },

  setProgress: progress => set({ progress }),

  startDownload: async version => {
    if (get().phase === 'downloading') return;
    set({ phase: 'downloading', progress: null, error: null, cancelRequested: false });

    try {
      const downloaded = await updateApi.download(version);
      set({ phase: 'ready', downloadedVersion: downloaded.version, progress: null });
    } catch (err) {
      if (get().cancelRequested) {
        set({
          phase: get().result?.status === 'available' ? 'available' : 'idle',
          progress: null,
          error: null,
          cancelRequested: false,
        });
        return;
      }
      set({ phase: 'error', error: errorMessage(err), progress: null });
    }
  },

  cancelDownload: async () => {
    set({ cancelRequested: true });
    await updateApi.cancelDownload().catch(() => {});
  },

  install: async () => {
    if (useRepoStore.getState().busyCount > 0) {
      set({ error: 'repo-busy' });
      return;
    }
    try {
      await updateApi.install();
    } catch (err) {
      set({ phase: 'error', error: errorMessage(err) });
    }
  },

  later: () => set({ modalOpen: false }),

  skip: () => {
    const version = get().result?.latest?.version;
    if (version) useSettingsStore.getState().setSkippedVersion(version);
    set({ modalOpen: false });
  },
}));
