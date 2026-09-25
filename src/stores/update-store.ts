import { create } from 'zustand';
import { updateApi } from '../api/update-api';
import { useSettingsStore } from './settings-store';
import { useRepoStore } from './repo-store';
import { errorMessage } from '../lib/error-message';
import type { UpdateCheckResult, UpdatePhase, UpdateProgress } from '../types';

/**
 * Where the update conversation stands.
 *
 * Not persisted: the main process owns every fact here — which release exists,
 * what was downloaded, whether this build can install anything at all. What
 * the user decided (skip this one, check automatically) lives in the settings
 * store instead, because that is a preference rather than a state.
 *
 * Errors are kept as the message the main process sent — 'offline',
 * 'rate-limited', 'no-asset' and friends are tokens the UI translates. Keeping
 * translation out of here is what lets the same error read differently in a
 * modal and in Settings.
 */
interface UpdateState {
  phase: UpdatePhase;
  result: UpdateCheckResult | null;
  progress: UpdateProgress | null;
  downloadedVersion: string | null;
  error: string | null;
  modalOpen: boolean;
  /** Set before aborting, so the rejected download reads as a cancellation. */
  cancelRequested: boolean;

  check: (opts?: { silent?: boolean; force?: boolean }) => Promise<void>;
  setProgress: (progress: UpdateProgress) => void;
  startDownload: (version: string) => Promise<void>;
  cancelDownload: () => Promise<void>;
  install: () => Promise<void>;
  openModal: () => void;
  /** Close the modal, keep what was found. */
  later: () => void;
  /** Close it and do not mention this version again. */
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

    // Asking explicitly is an answer to an earlier "skip": the button means
    // "tell me about it", so it takes the version off the list.
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
      // A check nobody asked for has no business reporting that the network is
      // down; it simply found nothing this time.
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
        // Cancelling is not a failure: it lands back where the download started.
        set({
          phase: get().result?.latest ? 'available' : 'idle',
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
    // The main process cannot see a push halfway through; quitting under one
    // would be rude at best.
    if (useRepoStore.getState().busyOperation) {
      set({ error: 'repo-busy' });
      return;
    }
    try {
      await updateApi.install();
    } catch (err) {
      set({ phase: 'error', error: errorMessage(err) });
    }
  },

  openModal: () => set({ modalOpen: true }),

  later: () => set({ modalOpen: false }),

  skip: () => {
    const version = get().result?.latest?.version;
    if (version) useSettingsStore.getState().setSkippedVersion(version);
    set({ modalOpen: false });
  },
}));
